// Home page (app/page.tsx, lib/home.ts): banner, latest updates, continue reading, top 10, completed stories,
// top authors, story cards (18+ / completed / chapter count / generated covers), the 18+ flag in the author API
// and the site footer. Views in the billions keep the test stories above real data.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, uuid } from './helpers.mjs';

let db, ids, users;
const anon = new Client();
const c = {};

// Rendered HTML without React's text separators, so "บทที่ {n}" reads as one string
const html = async (client, url = '/') => (await client.get(url)).text.replace(/<!-- -->/g, '');

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db, { author: 'AUTHOR', reader: 'READER' }));
    const tag = uuid().slice(0, 6);
    Object.assign(c, {
        tag, top: uuid(), mature: uuid(), done: uuid(), ch1: uuid(), ch2: uuid(), mch: uuid(), dch: uuid(),
        topTitle: `E2E HM Top ${tag}`, matureTitle: `E2E HM Mature ${tag}`, doneTitle: `E2E HM Done ${tag}`,
    });
    // The banner prefers stories with a cover, so the top one has one (the file doesn't need to exist)
    await db.query(`INSERT INTO novels (id, title, description, status, author_id, views, is_mature, is_completed, cover_image) VALUES
        (?, ?, 'เรื่องย่อทดสอบ', 'PUBLISHED', ?, 2000000003, 0, 0, '/uploads/e2e-home.png'),
        (?, ?, 'ลับ', 'PUBLISHED', ?, 2000000005, 1, 0, '/uploads/e2e-home.png'),
        (?, ?, 'จบ', 'PUBLISHED', ?, 2000000001, 0, 1, NULL)`,
        [c.top, c.topTitle, ids.author, c.mature, c.matureTitle, ids.author, c.done, c.doneTitle, ids.author]);
    await db.query(`INSERT INTO chapters (id, title, content, chapter_order, novel_id, created_at) VALUES
        (?, 'HM first', 'x', 1, ?, NOW() - INTERVAL 1 DAY), (?, 'HM newest', 'x', 2, ?, NOW()),
        (?, 'HM m1', 'x', 1, ?, NOW() - INTERVAL 2 DAY), (?, 'HM d1', 'x', 1, ?, NOW() - INTERVAL 3 DAY)`,
        [c.ch1, c.top, c.ch2, c.top, c.mch, c.mature, c.dch, c.done]);
    await db.query(`INSERT INTO reading_history (id, user_id, novel_id, chapter_id) VALUES (?, ?, ?, ?)`, [uuid(), ids.reader, c.top, c.ch1]);
});

after(async () => {
    if (db) {
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

test('the banner shows the most viewed stories but never 18+ ones, with a read-now link', async () => {
    const page = await html(anon);
    assert.match(page, new RegExp(`aria-label="1 จาก \\d+: ${c.topTitle}"`), 'top non-18+ story is the first slide');
    assert.ok(!new RegExp(`จาก \\d+: ${c.matureTitle}`).test(page), '18+ story is not a slide');
    assert.ok(page.includes(`href="/read/${c.ch1}"`), 'อ่านเลย opens the first chapter');
});

test('latest updates show the newest chapter of each story', async () => {
    const page = await html(anon);
    assert.ok(page.includes('อัปเดตล่าสุด'));
    assert.ok(page.includes('บทที่ 2: HM newest'));
    assert.ok(page.includes(`href="/read/${c.ch2}"`), 'the update card opens that chapter');
});

test('cards show the 18+ badge, completed badge, chapter count and a generated cover', async () => {
    const page = await html(anon);
    assert.ok(page.includes('>18+<'));
    assert.ok(page.includes('จบแล้ว'));
    assert.ok(page.includes('2 บท'), 'chapter count');
    assert.ok(page.includes('blur-'), '18+ cover is blurred');
    assert.match(page, /linear-gradient\(150deg, hsl\(\d+ 62% 30%\)/, 'stories without a cover get a generated one');
    assert.ok(page.includes('2B'), 'views are shown compactly (2B)');
});

test('top 10, completed stories and top authors sections', async () => {
    const page = await html(anon);
    assert.ok(page.includes('10 อันดับยอดนิยม'));
    assert.ok(page.includes('aria-label="อันดับ 1"'));
    assert.ok(page.includes('id="sec-completed"'));
    const completed = page.slice(page.indexOf('id="sec-completed"'), page.indexOf('id="sec-authors"'));
    assert.ok(completed.includes(c.doneTitle));
    assert.ok(!completed.includes(c.topTitle), 'only completed stories');
    assert.ok(page.includes('นักเขียนยอดนิยม'));
    const [rows] = await db.query('SELECT username FROM users WHERE id = ?', [ids.author]);
    assert.ok(page.includes(`href="/profile/${rows[0].username || ids.author}"`), 'author card links to the profile');
});

test('continue reading is only for logged-in readers with history', async () => {
    assert.ok(!(await html(anon)).includes('id="sec-continue"'));
    assert.ok(!(await html(users.author)).includes('id="sec-continue"'), 'no history, no section');
    const page = await html(users.reader);
    const section = page.slice(page.indexOf('id="sec-continue"'), page.indexOf('id="sec-updates"'));
    assert.ok(section.includes(c.topTitle));
    assert.ok(section.includes('บทที่ 1: HM first'));
    assert.ok(section.includes(`href="/read/${c.ch1}"`));
    assert.ok(section.includes('aria-valuenow="50"'), 'read 1 of 2 chapters');
});

test('the 18+ flag is set through the author API and validated', async () => {
    const created = await users.author.post('/api/novels', { title: `E2E HM New ${c.tag}`, isMature: true });
    assert.equal(created.status, 200);
    const [rows] = await db.query('SELECT is_mature FROM novels WHERE id = ?', [created.json.id]);
    assert.equal(rows[0].is_mature, 1);
    assert.equal((await users.author.patch(`/api/novels/${created.json.id}`, { isMature: 'yes' })).status, 400);
    assert.equal((await users.author.patch(`/api/novels/${created.json.id}`, { isMature: false })).status, 200);
    const [after] = await db.query('SELECT is_mature FROM novels WHERE id = ?', [created.json.id]);
    assert.equal(after[0].is_mature, 0);
    const list = (await anon.get(`/api/novels?search=${encodeURIComponent(c.matureTitle)}`)).json;
    const row = (Array.isArray(list) ? list : list.novels ?? list.items).find((s) => s.id === c.mature);
    assert.equal(row.is_mature, true);
    assert.equal(row.item_count, 1);
});

test('the footer is on normal pages but not on the reader or dashboards', async () => {
    assert.ok((await html(anon)).includes('สงวนลิขสิทธิ์'));
    assert.ok((await html(anon, '/ranking')).includes('สงวนลิขสิทธิ์'));
    assert.ok(!(await html(users.reader, `/read/${c.ch1}`)).includes('สงวนลิขสิทธิ์'));
});
