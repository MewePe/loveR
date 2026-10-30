import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { v4 as uuid } from 'uuid';
import { coverFromFile, generateComicPage, generateCover, generateSlip, randomFrom } from './art';
import { assertLocalDatabase, backupDatabase, dbConfig } from './backup';
import {
    AUTHORS, AuthorKey, CATEGORY_NAMES, CHAPTER_TITLES, CategorySlug, COMMENTS, DEMO_EMAIL_DOMAIN, DEMO_PASSWORD, DemoStory, NARRATION, READER_NAMES,
    REPLIES, STORIES, SUPPORT_MESSAGES,
} from './data';

dotenv.config({ quiet: true });

// Presentation data, spread over the last 3 months: see the "ข้อมูลตัวอย่าง" section of CLAUDE.md.
// Written straight to the database, so nothing goes through the content check, sends notifications or touches a real
// user: demo readers only act on demo stories. Everything is one transaction, and scripts/demo/remove.ts finds it
// all again from the demo email domain plus the manifest. Runs are repeatable: only the dates follow today.

const ROOT = process.cwd();
const UPLOADS = path.join(ROOT, 'public', 'uploads');
const MANIFEST = path.join(ROOT, 'storage', 'demo-manifest.json');
const USER_COVERS = path.join(ROOT, 'demo-covers');
const PHOTOS = path.join(ROOT, 'demo-data', 'photos');
const READERS = READER_NAMES.length;
const DAY = 86_400_000;
const NOW = Date.now();
const random = randomFrom('loveread-demo');

const between = (a: number, b: number) => a + random() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const chance = (p: number) => random() < p;
const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)];
const daysAgo = (days: number) => NOW - days * DAY;
const clampNow = (time: number) => Math.min(time, NOW - 60_000);
const localDate = (time: number) => {
    const d = new Date(time);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type Row = (string | number | Date | null)[];

// Rows go in batches: a single INSERT of everything would exceed max_allowed_packet
async function insert(conn: mysql.Connection, table: string, columns: string[], rows: Row[]) {
    for (let i = 0; i < rows.length; i += 500) {
        await conn.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ?`, [rows.slice(i, i + 500)]);
    }
}

function chapterHtml(story: DemoStory, order: number) {
    const lines = NARRATION[story.categories[0]].concat(NARRATION[story.categories[1] ?? story.categories[0]]);
    const text = (line: string) => line.replace(/\{lead\}/g, story.lead).replace(/\{place\}/g, story.place).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const start = (order * 3 + story.key.length) % lines.length;
    const paragraphs = Array.from({ length: 9 }, (_, i) => `<p>${text(lines[(start + i * 5) % lines.length])}</p>`);
    if (order === 1) paragraphs[0] = `<p><strong>${story.place}</strong></p>${paragraphs[0]}`;
    paragraphs.splice(5, 0, '<p data-align="center">* * *</p>');
    return paragraphs.join('');
}

// The pages add "บทที่ N" themselves, so the title is only the name. Long stories go round the list again as a second part.
function itemTitle(story: DemoStory, order: number) {
    const titles = CHAPTER_TITLES[story.categories[0]];
    const name = titles[(order - 1) % titles.length];
    return order > titles.length ? `${name} (ภาคต่อ)` : name;
}

// How many days ago each chapter/episode came out: finished stories stopped a while ago, ongoing ones are still updating
function releaseDays(story: DemoStory) {
    const last = story.completed ? between(4, 16) : between(0.1, 6);
    return Array.from({ length: story.items }, (_, i) =>
        story.startedDaysAgo - ((story.startedDaysAgo - last) * i) / Math.max(1, story.items - 1));
}

// Covers: pictures dropped in demo-covers/ first (named after the story key, or given out in order to the rest),
// then the story's photo, otherwise a generated one
async function makeCovers() {
    const files = existsSync(USER_COVERS) ? readdirSync(USER_COVERS).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort() : [];
    const chosen = new Map<string, string>();
    const named = (key: string) => files.find((f) => path.parse(f).name.toLowerCase() === key);
    for (const story of STORIES) {
        const file = named(story.key);
        if (file) chosen.set(story.key, file);
    }
    const spare = files.filter((f) => ![...chosen.values()].includes(f));
    for (const story of STORIES) {
        if (!chosen.has(story.key) && spare.length) chosen.set(story.key, spare.shift()!);
    }

    mkdirSync(UPLOADS, { recursive: true });
    const urls = new Map<string, string>();
    const generated = new Map<string, number>();
    for (const story of STORIES) {
        const author = AUTHORS.find((a) => a.key === story.author)!;
        const own = chosen.get(story.key);
        const category = story.categories[0];
        const index = generated.get(category) ?? 0;
        if (!own && !story.photo) generated.set(category, index + 1);
        const image = own ? await coverFromFile(path.join(USER_COVERS, own))
            : story.photo ? await coverFromFile(path.join(PHOTOS, `${story.photo}.jpg`))
                : await generateCover(story, author.name, index);
        const filename = `demo-${story.key}.jpg`;
        writeFileSync(path.join(UPLOADS, filename), image);
        urls.set(story.key, `/uploads/${filename}`);
    }
    return urls;
}

async function main() {
    assertLocalDatabase();
    const conn = await mysql.createConnection({ ...dbConfig(), charset: 'utf8mb4' });
    const writtenDirs: string[] = [];
    let coversWritten = false;
    try {
        const [existing] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS n FROM users WHERE email LIKE ?', [`%@${DEMO_EMAIL_DOMAIN}`]);
        if (existing[0].n > 0) throw new Error('มีข้อมูลตัวอย่างอยู่แล้ว ลบก่อนด้วย npm run demo:remove');
        const [settings] = await conn.query<mysql.RowDataPacket[]>('SELECT author_share_percent FROM system_settings LIMIT 1');
        const share = (settings[0]?.author_share_percent ?? 70) / 100;

        const usernames = [...AUTHORS.map((a) => a.username), ...READER_NAMES.map((_, i) => `demo_reader_${i + 1}`)];
        const [taken] = await conn.query<mysql.RowDataPacket[]>('SELECT username FROM users WHERE username IN (?)', [usernames]);
        if (taken.length) throw new Error(`username ซ้ำกับผู้ใช้จริง: ${taken.map((t) => t.username).join(', ')}`);

        console.log('กำลังสำรองฐานข้อมูล...');
        const backup = await backupDatabase(conn, 'before-demo-seed');
        console.log(`สำรองแล้ว: ${backup}`);

        console.log('กำลังสร้างปกและรูป...');
        coversWritten = true;
        const covers = await makeCovers();
        const password = await bcrypt.hash(DEMO_PASSWORD, 10);

        await conn.beginTransaction();

        // Categories this database doesn't have yet are ours to remove later
        const [catRows] = await conn.query<mysql.RowDataPacket[]>('SELECT id, slug FROM categories');
        const categoryIds = new Map<string, string>(catRows.map((c) => [c.slug, c.id]));
        const createdCategories: string[] = [];
        for (const slug of Object.keys(CATEGORY_NAMES) as CategorySlug[]) {
            if (categoryIds.has(slug)) continue;
            const id = uuid();
            await conn.query('INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)', [id, CATEGORY_NAMES[slug], slug]);
            categoryIds.set(slug, id);
            createdCategories.push(id);
        }

        // ---------- users ----------
        const authorIds = new Map<AuthorKey, string>(AUTHORS.map((a) => [a.key, uuid()]));
        await insert(conn, 'users', ['id', 'name', 'email', 'password', 'role', 'coins', 'username', 'bio', 'created_at', 'updated_at'],
            AUTHORS.map((a) => {
                const joined = new Date(daysAgo(between(92, 110)));
                return [authorIds.get(a.key)!, a.name, `demo-${a.key}@${DEMO_EMAIL_DOMAIN}`, password, 'AUTHOR', 0, a.username, a.bio, joined, joined];
            }));
        await insert(conn, 'writer_profiles', ['user_id', 'first_name', 'last_name', 'status', 'bank_name', 'bank_account_name', 'bank_account_number'],
            AUTHORS.map((a) => [authorIds.get(a.key)!, a.name, '(ตัวอย่าง)', 'APPROVED', 'ธนาคารตัวอย่าง', a.name, '000-0-00000-0']));

        const readers = READER_NAMES.map((name, i) => ({
            id: uuid(), name, joined: daysAgo(i < 15 ? between(80, 92) : between(1, 85)), weight: Math.pow(random(), 2) * 2.2 + 0.25,
            likes: [pick(Object.keys(CATEGORY_NAMES)), pick(Object.keys(CATEGORY_NAMES)), pick(Object.keys(CATEGORY_NAMES))],
        }));

        // ---------- stories, chapters, comic pages ----------
        const novelRows: Row[] = [], comicRows: Row[] = [], novelCats: Row[] = [], comicCats: Row[] = [];
        const chapterRows: Row[] = [], episodeRows: Row[] = [], pageRows: Row[] = [];
        type Item = { id: string; title: string; price: number; released: number; views: number };
        const built = STORIES.map((story) => ({ story, id: uuid(), items: [] as Item[], created: daysAgo(story.startedDaysAgo), authorId: authorIds.get(story.author)! }));

        console.log('กำลังสร้างเรื่อง ตอน และหน้าการ์ตูน...');
        for (const b of built) {
            const { story, id } = b;
            const days = releaseDays(story);
            for (let i = 0; i < story.items; i++) {
                const order = i + 1;
                b.items.push({ id: uuid(), title: itemTitle(story, order), price: order > story.freeItems ? story.price : 0, released: daysAgo(days[i]), views: 0 });
            }
            const links = story.categories.map((slug, i) => [id, categoryIds.get(slug)!, i] as Row);
            (story.kind === 'novel' ? novelCats : comicCats).push(...links);

            if (story.kind === 'comic') {
                const dir = path.join(ROOT, 'storage', 'comic-pages', b.authorId);
                mkdirSync(dir, { recursive: true });
                writtenDirs.push(dir);
                for (const [i, item] of b.items.entries()) {
                    for (let page = 1; page <= 3; page++) {
                        const filename = `${uuid()}.jpg`;
                        writeFileSync(path.join(dir, filename), await generateComicPage(story, i + 1, page));
                        pageRows.push([uuid(), `/api/media/comic-pages/${b.authorId}/${filename}`, page, item.id]);
                    }
                }
            }
        }

        // ---------- views: one row per story per day, split over its chapters ----------
        const dailyRows: Row[] = [];
        for (const b of built) {
            const { story } = b;
            const scale = story.popularity * story.popularity * between(1.6, 2.4);
            let total = 0;
            for (let day = Math.floor(story.startedDaysAgo); day >= 0; day--) {
                const time = daysAgo(day);
                const age = story.startedDaysAgo - day;
                const newChapter = b.items.some((item) => Math.abs(item.released - time) < DAY) ? 1.5 : 1;
                const weekend = [0, 6].includes(new Date(time).getDay()) ? 1.3 : 1;
                // Grows for two weeks, then settles; finished stories fade slowly
                const curve = Math.min(1, 0.25 + age / 18) * (story.completed ? Math.max(0.35, 1 - age / 130) : 1);
                const partOfDay = day === 0 ? new Date(NOW).getHours() / 24 : 1;
                const views = Math.round(scale * curve * newChapter * weekend * between(0.75, 1.25) * partOfDay);
                if (views <= 0) continue;
                total += views;
                dailyRows.push([localDate(time), story.kind === 'novel' ? b.id : null, story.kind === 'comic' ? b.id : null, views]);
            }
            // Fewer readers make it to each later chapter; the story total stays the sum of its chapters
            const weights = b.items.map((_, i) => Math.pow(0.86, i));
            const sum = weights.reduce((a, c) => a + c, 0);
            let left = total;
            b.items.forEach((item, i) => {
                item.views = i === b.items.length - 1 ? left : Math.round((total * weights[i]) / sum);
                left -= item.views;
            });
            const last = new Date(b.items[b.items.length - 1].released);
            const common: Row = [b.id, story.title, story.description, covers.get(story.key)!, 'PUBLISHED', story.completed ? 1 : 0, story.mature ? 1 : 0,
                b.authorId, categoryIds.get(story.categories[0])!, total, new Date(b.created), last];
            (story.kind === 'novel' ? novelRows : comicRows).push(common);
            for (const [i, item] of b.items.entries()) {
                const date = new Date(item.released);
                if (story.kind === 'novel') chapterRows.push([item.id, item.title, chapterHtml(story, i + 1), 'HTML', i + 1, b.id, item.views, item.price, 'APPROVED', date, date]);
                else episodeRows.push([item.id, item.title, i + 1, b.id, item.views, item.price, 'APPROVED', date, date]);
            }
        }

        const storyColumns = ['id', 'title', 'description', 'cover_image', 'status', 'is_completed', 'is_mature', 'author_id', 'category_id', 'views', 'created_at', 'updated_at'];
        await insert(conn, 'novels', storyColumns, novelRows);
        await insert(conn, 'comics', storyColumns, comicRows);
        await insert(conn, 'novel_categories', ['novel_id', 'category_id', 'sort_order'], novelCats);
        await insert(conn, 'comic_categories', ['comic_id', 'category_id', 'sort_order'], comicCats);
        await insert(conn, 'chapters', ['id', 'title', 'content', 'content_format', 'chapter_order', 'novel_id', 'views', 'price', 'moderation_status', 'created_at', 'updated_at'], chapterRows);
        await insert(conn, 'comic_episodes', ['id', 'title', 'episode_order', 'comic_id', 'views', 'price', 'moderation_status', 'created_at', 'updated_at'], episodeRows);
        await insert(conn, 'comic_pages', ['id', 'image_url', 'page_order', 'episode_id'], pageRows);
        await insert(conn, 'story_views_daily', ['view_date', 'novel_id', 'comic_id', 'views'], dailyRows);

        // ---------- what each reader did ----------
        console.log('กำลังจำลองผู้อ่าน...');
        const bookmarkRows: Row[] = [], ratingRows: Row[] = [], historyRows: Row[] = [], readRows: Row[] = [], followRows: Row[] = [], commentRows: Row[] = [];
        const replyRows: Row[] = [];
        const spends = new Map<string, { time: number; amount: number }[]>();
        const purchaseRows: Row[] = [], supportRows: Row[] = [];
        const followed = new Set<string>();
        const commentsByStory = new Map<string, { id: string; time: number; user: string }[]>();

        for (const reader of readers) {
            const spending: { time: number; amount: number }[] = [];
            spends.set(reader.id, spending);
            const pool = built.filter((b) => b.created < NOW - DAY);
            const count = int(4, 7 + Math.round(reader.weight * 5));
            const chosen = new Set<(typeof built)[number]>();
            for (let tries = 0; tries < 80 && chosen.size < count; tries++) {
                const b = pick(pool);
                const fit = b.story.popularity / 10 * (b.story.categories.some((c) => reader.likes.includes(c)) ? 1 : 0.3);
                if (chance(fit)) chosen.add(b);
            }

            for (const b of chosen) {
                const { story, id: storyId } = b;
                const column = story.kind === 'novel' ? 'novel' : 'comic';
                const firstOpen = Math.max(b.created, reader.joined) + between(0, 10) * DAY;
                if (firstOpen >= NOW) continue;
                const reached = Math.max(1, Math.round(story.items * between(0.25, 1)));
                let lastRead: Item | null = null;
                let lastTime = firstOpen;
                const buyer = chance(0.3 + reader.weight * 0.3);

                for (let i = 0; i < reached; i++) {
                    const item = b.items[i];
                    const time = clampNow(Math.max(lastTime, item.released) + between(0.02, 2.5) * DAY);
                    if (item.price > 0) {
                        if (!buyer || !chance(0.82)) break;
                        spending.push({ time, amount: item.price });
                        purchaseRows.push([uuid(), reader.id, story.kind === 'novel' ? item.id : null, story.kind === 'comic' ? item.id : null,
                            item.title, b.authorId, item.price, Math.round(item.price * share * 100) / 100, new Date(time)]);
                    }
                    readRows.push([uuid(), reader.id, story.kind === 'novel' ? item.id : null, story.kind === 'comic' ? item.id : null, new Date(time)]);
                    lastRead = item;
                    lastTime = time;
                }
                if (!lastRead) continue;

                historyRows.push([uuid(), reader.id, column === 'novel' ? storyId : null, column === 'comic' ? storyId : null,
                    column === 'novel' ? lastRead.id : null, column === 'comic' ? lastRead.id : null, new Date(lastTime)]);
                const during = () => new Date(clampNow(between(firstOpen, lastTime + DAY)));
                if (chance(0.38)) bookmarkRows.push([uuid(), reader.id, column === 'novel' ? storyId : null, column === 'comic' ? storyId : null, during()]);
                if (chance(0.55)) {
                    const score = Math.max(1, Math.min(5, Math.round(story.quality + between(-1.4, 0.9))));
                    const when = during();
                    ratingRows.push([uuid(), reader.id, column === 'novel' ? storyId : null, column === 'comic' ? storyId : null, score, when, when]);
                }
                if (chance(0.28)) {
                    const id = uuid();
                    const when = clampNow(between(firstOpen, lastTime + DAY));
                    commentRows.push([id, reader.id, column === 'novel' ? storyId : null, column === 'comic' ? storyId : null, null, pick(COMMENTS), new Date(when)]);
                    if (!commentsByStory.has(storyId)) commentsByStory.set(storyId, []);
                    commentsByStory.get(storyId)!.push({ id, time: when, user: reader.id });
                }
                if (!followed.has(`${reader.id}:${b.authorId}`) && chance(0.42)) {
                    followed.add(`${reader.id}:${b.authorId}`);
                    followRows.push([reader.id, b.authorId, during()]);
                }
                if (buyer && chance(0.1)) {
                    const amount = pick([10, 20, 50, 100]);
                    const when = clampNow(between(firstOpen, lastTime + DAY));
                    spending.push({ time: when, amount });
                    supportRows.push([uuid(), reader.id, b.authorId, amount, Math.round(amount * share * 100) / 100, pick(SUPPORT_MESSAGES), new Date(when)]);
                }
            }
        }

        // Replies: other readers, and now and then the author
        for (const b of built) {
            const comments = commentsByStory.get(b.id) ?? [];
            for (const comment of comments) {
                if (!chance(0.3)) continue;
                const fromAuthor = chance(0.4);
                const user = fromAuthor ? b.authorId : pick(readers).id;
                if (user === comment.user) continue;
                const when = new Date(clampNow(comment.time + between(0.05, 3) * DAY));
                replyRows.push([uuid(), user, b.story.kind === 'novel' ? b.id : null, b.story.kind === 'comic' ? b.id : null, comment.id, pick(REPLIES), when]);
            }
        }

        // ---------- coins: every spend is covered by a top-up approved before it ----------
        const topupRows: Row[] = [];
        const slipFor = async (userId: string, amount: number) => {
            const dir = path.join(ROOT, 'storage', 'private', 'topup-slips', userId);
            mkdirSync(dir, { recursive: true });
            writtenDirs.push(dir);
            const filename = `${uuid()}.jpg`;
            writeFileSync(path.join(dir, filename), await generateSlip(amount));
            return `/api/media/private/topup-slips/${userId}/${filename}`;
        };
        const balances = new Map<string, number>();
        const lastTopup = new Map<string, number>();
        for (const reader of readers) {
            const spending = spends.get(reader.id)!.sort((a, b) => a.time - b.time);
            let balance = 0;
            for (const { time, amount } of spending) {
                if (balance < amount) {
                    const needed = amount - balance;
                    const top = [50, 100, 200, 300, 500, 1000].find((p) => p >= needed * between(1, 2.5)) ?? 1000;
                    const created = Math.max(reader.joined, time - between(0.05, 1.5) * DAY);
                    const approved = Math.min(time - 60_000, created + between(0.5, 6) * 3_600_000);
                    topupRows.push([uuid(), reader.id, top, await slipFor(reader.id, top), 'APPROVED', null, new Date(created), new Date(Math.max(created, approved))]);
                    balance += top;
                    lastTopup.set(reader.id, created);
                }
                balance -= amount;
            }
            balances.set(reader.id, balance);
        }
        // A few for the admin to work through in the presentation, and a rejected one for the history
        const active = readers.filter((r) => spends.get(r.id)!.length > 0).slice(0, 6);
        for (const [i, reader] of active.entries()) {
            const amount = pick([100, 200, 300]);
            const when = new Date(clampNow(NOW - between(0.1, 1.5) * DAY));
            topupRows.push(i < 4
                ? [uuid(), reader.id, amount, await slipFor(reader.id, amount), 'PENDING', null, when, when]
                : [uuid(), reader.id, amount, await slipFor(reader.id, amount), 'REJECTED', 'ยอดในสลิปไม่ตรงกับที่แจ้ง', when, when]);
        }

        await insert(conn, 'users', ['id', 'name', 'email', 'password', 'role', 'coins', 'username', 'birth_date', 'created_at', 'updated_at'],
            readers.map((r, i) => {
                const joined = new Date(r.joined);
                return [r.id, r.name, `demo-reader${i + 1}@${DEMO_EMAIL_DOMAIN}`, password, 'READER', balances.get(r.id)!, `demo_reader_${i + 1}`, `${1975 + (i % 25)}-0${(i % 9) + 1}-15`, joined, joined];
            }));
        await insert(conn, 'coin_topups', ['id', 'user_id', 'amount', 'slip_image', 'status', 'rejection_reason', 'created_at', 'updated_at'], topupRows);
        await insert(conn, 'purchases', ['id', 'user_id', 'chapter_id', 'episode_id', 'item_title', 'author_id', 'price', 'author_earning', 'created_at'], purchaseRows);
        await insert(conn, 'supports', ['id', 'user_id', 'author_id', 'amount', 'author_earning', 'message', 'created_at'], supportRows);
        await insert(conn, 'item_reads', ['id', 'user_id', 'chapter_id', 'episode_id', 'read_at'], readRows);
        await insert(conn, 'reading_history', ['id', 'user_id', 'novel_id', 'comic_id', 'chapter_id', 'episode_id', 'read_at'], historyRows);
        await insert(conn, 'bookmarks', ['id', 'user_id', 'novel_id', 'comic_id', 'created_at'], bookmarkRows);
        await insert(conn, 'ratings', ['id', 'user_id', 'novel_id', 'comic_id', 'score', 'created_at', 'updated_at'], ratingRows);
        await insert(conn, 'follows', ['follower_id', 'author_id', 'created_at'], followRows);
        const commentColumns = ['id', 'user_id', 'novel_id', 'comic_id', 'parent_id', 'body', 'created_at'];
        await insert(conn, 'comments', commentColumns, commentRows);
        await insert(conn, 'comments', commentColumns, replyRows);

        await conn.commit();
        writeFileSync(MANIFEST, JSON.stringify({ createdCategories, seededAt: new Date(NOW).toISOString() }, null, 2));

        console.log(`
เสร็จแล้ว
  นักเขียน ${AUTHORS.length} | ผู้อ่าน ${READERS} | เรื่อง ${built.length} | บท/ตอน ${chapterRows.length + episodeRows.length} | ซื้อตอน ${purchaseRows.length} | เติมเหรียญ ${topupRows.length} | คอมเมนต์ ${commentRows.length + replyRows.length} | ให้คะแนน ${ratingRows.length} | ติดตาม ${followRows.length}
  ล็อกอินตัวอย่าง (รหัสผ่าน ${DEMO_PASSWORD}): demo-plaifon@${DEMO_EMAIL_DOMAIN} (นักเขียน), demo-reader1@${DEMO_EMAIL_DOMAIN} (ผู้อ่าน)
  ลบทั้งหมด: npm run demo:remove`);
    } catch (error) {
        await conn.rollback().catch(() => {});
        // Nothing was committed, so what this run wrote belongs to nobody. A refused run wrote nothing, and the covers
        // that are there then belong to the demo data already in the database.
        for (const dir of new Set(writtenDirs)) rmSync(dir, { recursive: true, force: true });
        if (coversWritten) for (const story of STORIES) rmSync(path.join(UPLOADS, `demo-${story.key}.jpg`), { force: true });
        throw error;
    } finally {
        await conn.end();
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
