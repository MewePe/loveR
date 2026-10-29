// Public author profiles (/profile/[username], lib/authors.ts): who has one, editing it, follows and the
// notifications they bring, supports (coins sent to an author, lib/coins.ts supportAuthor), top fans,
// the works list, and author names linking to the profile.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, uuid } from './helpers.mjs';

let db, ids, users, share;
const anon = new Client();
const TAG = uuid().slice(0, 8);
const s = {}; // story ids
const extraUsers = []; // inserted directly (not logged in)
let username; // the author's username

const coinsOf = async (id) => (await db.query('SELECT coins FROM users WHERE id = ?', [id]))[0][0].coins;
const notes = async (userId, type) => (await db.query('SELECT message, link FROM notifications WHERE user_id = ? AND type = ? ORDER BY created_at', [userId, type]))[0];
const support = (client, authorId, body) => client.post(`/api/authors/${authorId}/support`, body);
const page = async (client, path) => (await client.get(path)).text;

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db, {
        author: 'AUTHOR', other: 'AUTHOR', reader: 'READER', fan: 'READER', racer: 'READER', spammer: 'READER', banned: 'READER', admin: 'ADMIN',
    }));
    const [settings] = await db.query('SELECT author_share_percent FROM system_settings WHERE id = "1"');
    share = Number(settings[0].author_share_percent);
    await db.query('UPDATE users SET coins = 1000 WHERE id IN (?)', [[ids.reader, ids.fan, ids.spammer, ids.banned]]);
    await db.query('UPDATE users SET coins = 100 WHERE id = ?', [ids.racer]);
    await db.query('UPDATE users SET name = ? WHERE id = ?', [`E2E PF ${TAG} Author`, ids.author]);
});

after(async () => {
    if (db) {
        await cleanupUsers(db, [...Object.values(ids || {}), ...extraUsers]);
        await db.end();
    }
});

test('authors get a username and can edit their public profile; bad input is rejected', async () => {
    const res = await users.author.get('/api/author/public-profile');
    assert.equal(res.status, 200);
    assert.match(res.json.username, /^user_[0-9a-f]{8,}$/, 'default username is not derived from the email');
    assert.ok(!res.json.username.includes('e2e'));

    username = `e2e_pf_${TAG}`;
    const ok = await users.author.patch('/api/author/public-profile', {
        username: `@E2E_PF_${TAG}`,
        bio: `แนะนำตัว ${TAG}\n<script>alert(1)</script>`,
        social_links: { facebook: 'https://facebook.com/e2e', website: 'https://example.com/me', x: '' },
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    assert.equal(ok.json.username, username, 'lowercased, @ stripped');

    const bad = async (body, status = 400) => assert.equal((await users.author.patch('/api/author/public-profile', body)).status, status, JSON.stringify(body));
    await bad({ username: 'ab' });
    await bad({ username: 'has-dash' });
    await bad({ username: 'มีภาษาไทย' });
    await bad({ social_links: { website: 'javascript:alert(1)' } });
    await bad({ social_links: { facebook: 'facebook.com/no-scheme' } });
    await bad({ social_links: 'nope' });
    await bad({ cover_image: 'https://evil.example/x.png' });
    await bad({ bio: 'x'.repeat(1001) });
    await bad({});

    const taken = (await users.other.get('/api/author/public-profile')).json.username;
    await bad({ username: taken }, 409);
    assert.equal((await users.reader.get('/api/author/public-profile')).status, 403, 'readers have no public profile');
    assert.equal((await anon.patch('/api/author/public-profile', { bio: 'x' })).status, 401);
});

test('author profile page; banned and unknown users are 404 (readers: profile-page.test.mjs)', async () => {
    const res = await anon.get(`/profile/${username}`);
    assert.equal(res.status, 200);
    assert.ok(res.text.includes(`E2E PF ${TAG} Author`));
    assert.ok(res.text.includes(`@${username}`));
    assert.ok(res.text.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && !res.text.includes('<script>alert(1)</script>'), 'bio is plain text');
    assert.ok(res.text.includes('href="https://facebook.com/e2e"'));
    assert.match(res.text, /rel="noopener noreferrer nofollow ugc"/);
    assert.ok(res.text.includes('/images/default-cover.svg'), 'default banner');

    const byId = await anon.get(`/profile/${ids.author}`);
    assert.ok([307, 308].includes(byId.status), `old links by id redirect (got ${byId.status})`);
    assert.ok(byId.headers.get('location').endsWith(`/profile/${username}`));
    assert.ok([307, 308].includes((await anon.get(`/profile/${username.toUpperCase()}`)).status), 'case-insensitive');

    const bannedId = uuid();
    extraUsers.push(bannedId);
    await db.query(`INSERT INTO users (id, name, email, role) VALUES (?, 'E2E PF banned', ?, 'BANNED')`, [bannedId, `e2e-pf-banned-${TAG}@test.local`]);
    for (const path of [`/profile/${bannedId}`, `/profile/nobody_${TAG}`, '/profile/x']) {
        const r = await anon.get(path);
        assert.equal(r.status, 404, path);
    }
    await db.query(`UPDATE users SET role = 'BANNED' WHERE id = ?`, [ids.other]);
    assert.equal((await anon.get(`/profile/${ids.other}`)).status, 404, 'banned authors are hidden');
    await db.query(`UPDATE users SET role = 'AUTHOR' WHERE id = ?`, [ids.other]);
});

test('follow / unfollow is idempotent and counted on the profile', async () => {
    const follow = (c, id = ids.author) => c.post(`/api/authors/${id}/follow`);
    let r = await follow(users.reader);
    assert.deepEqual([r.status, r.json.following, r.json.followers], [200, true, 1]);
    r = await follow(users.reader);
    assert.equal(r.json.followers, 1, 'following twice changes nothing');
    assert.equal((await follow(users.fan)).json.followers, 2);
    assert.equal((await follow(users.author, ids.other)).status, 200, 'authors can follow other authors');

    assert.equal((await follow(users.author)).status, 400, 'not yourself');
    assert.equal((await follow(users.reader, ids.fan)).status, 404, 'readers have no profile to follow');
    assert.equal((await follow(anon)).status, 401);

    const html = await page(anon, `/profile/${username}`);
    assert.match(html, />2<\/strong>\s*(<!-- -->)?\s*ผู้ติดตาม/);
    assert.match(html, />1<\/strong>\s*(<!-- -->)?\s*กำลังติดตาม/);

    r = await users.fan.del(`/api/authors/${ids.author}/follow`);
    assert.deepEqual([r.json.following, r.json.followers], [false, 1]);
    assert.equal((await users.fan.del(`/api/authors/${ids.author}/follow`)).json.followers, 1, 'unfollowing twice is fine');
});

test('followers hear about a new story once, and about new chapters (once even if they also bookmarked)', async () => {
    const created = await users.author.post('/api/novels', { title: `E2E PF ${TAG} Novel`, description: 'เรื่องย่อ', isCompleted: true, isMature: false });
    s.novel = created.json.id;
    assert.equal((await users.author.patch(`/api/novels/${s.novel}`, { status: 'PUBLISHED' })).status, 200);
    let n = await notes(ids.reader, 'NEW_STORY');
    assert.equal(n.length, 1);
    assert.equal(n[0].link, `/novel/${s.novel}`);
    assert.ok(n[0].message.includes(`E2E PF ${TAG} Author`) && n[0].message.includes('นิยาย'));
    assert.equal((await notes(ids.fan, 'NEW_STORY')).length, 0, 'unfollowed');

    await users.author.patch(`/api/novels/${s.novel}`, { status: 'DRAFT' });
    await users.author.patch(`/api/novels/${s.novel}`, { status: 'PUBLISHED' });
    assert.equal((await notes(ids.reader, 'NEW_STORY')).length, 1, 'not announced again');

    assert.equal((await users.reader.post('/api/bookmarks', { content_type: 'novel', content_id: s.novel })).status, 200);
    const ch = await users.author.post(`/api/novels/${s.novel}/chapters`, { title: 'บทแรก', content: 'x', price: 10 });
    assert.equal(ch.status, 200);
    s.chapter = ch.json.id;
    n = await notes(ids.reader, 'NEW_CHAPTER');
    assert.equal(n.length, 1, 'follower + bookmark = one notification');

    const comic = await users.author.post('/api/comics', { title: `E2E PF ${TAG} Comic`, description: 'x', isMature: false });
    s.comic = comic.json.id;
    await users.author.patch(`/api/comics/${s.comic}`, { status: 'PUBLISHED' });
    assert.equal((await notes(ids.reader, 'NEW_STORY')).length, 2, 'comics too');
    assert.equal((await users.author.patch(`/api/novels/${s.novel}`, { isCompleted: 'yes' })).status, 400);
});

test('support moves coins to the author at the current share and notifies them', async () => {
    const before = (await users.author.get('/api/author/earnings')).json;
    const beforeAdmin = (await users.admin.get('/api/admin/analytics')).json.totals;

    const r = await support(users.reader, ids.author, { amount: 50, message: `  ขอบคุณ ${TAG} <b>สู้ๆ</b>  ` });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.coins, 950);
    assert.equal(await coinsOf(ids.reader), 950);

    const [[row]] = await db.query('SELECT amount, author_earning, message FROM supports WHERE user_id = ? AND author_id = ?', [ids.reader, ids.author]);
    const expected = Math.round(50 * share) / 100;
    assert.equal(Number(row.author_earning), expected);
    assert.equal(row.message, `ขอบคุณ ${TAG} <b>สู้ๆ</b>`, 'trimmed, stored as plain text');

    const after = (await users.author.get('/api/author/earnings')).json;
    assert.equal(Math.round((after.earned - before.earned) * 100) / 100, expected, 'earned includes supports');
    assert.equal(Math.round((after.balance - before.balance) * 100) / 100, expected, 'withdrawable balance includes supports');
    assert.equal(Math.round((after.this_month - before.this_month) * 100) / 100, expected);
    assert.equal(after.supports[0].amount, 50);
    assert.equal(after.supports[0].supporter_name, 'E2E reader');

    const n = await notes(ids.author, 'SUPPORT');
    assert.equal(n.length, 1);
    assert.ok(n[0].message.includes('E2E reader') && n[0].message.includes('50 เหรียญ') && n[0].message.includes(`ขอบคุณ ${TAG}`));
    assert.equal(n[0].link, '/author?tab=earnings');

    const mine = (await users.reader.get('/api/coins')).json.supports;
    assert.equal(mine[0].amount, 50);
    assert.equal(mine[0].author_username, username);

    const afterAdmin = (await users.admin.get('/api/admin/analytics')).json.totals;
    assert.equal(afterAdmin.sales_amount - beforeAdmin.sales_amount, 50, 'admin dashboard counts supports as coins spent');
    assert.equal(Math.round((afterAdmin.platform_amount - beforeAdmin.platform_amount) * 100) / 100, Math.round((50 - expected) * 100) / 100);
});

test('support rejects bad amounts and messages without touching coins', async () => {
    const coins = await coinsOf(ids.reader);
    for (const amount of [0, -5, 1.5, 'abc', null, 10001]) {
        assert.equal((await support(users.reader, ids.author, { amount })).status, 400, `amount ${amount}`);
    }
    assert.equal((await support(users.reader, ids.author, { amount: 5, message: 'x'.repeat(201) })).status, 400);
    assert.equal((await support(users.reader, ids.author, { amount: 5, message: { a: 1 } })).status, 400);
    assert.equal((await support(users.author, ids.author, { amount: 5 })).status, 400, 'not yourself');
    assert.equal((await support(users.reader, ids.fan, { amount: 5 })).status, 404, 'readers cannot be supported');
    assert.equal((await support(users.reader, uuid(), { amount: 5 })).status, 404);
    assert.equal((await support(anon, ids.author, { amount: 5 })).status, 401);
    assert.equal((await support(users.reader, ids.author, { amount: 5000 })).status, 402, 'not enough coins');
    assert.equal(await coinsOf(ids.reader), coins, 'nothing charged');
});

test('parallel supports cannot overspend', async () => {
    // 100 coins, five requests of 30 at once: exactly three can succeed
    const results = await Promise.all(Array.from({ length: 5 }, () => support(users.racer, ids.author, { amount: 30 })));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 200, 200, 402, 402]);
    assert.equal(await coinsOf(ids.racer), 10);
    const [[{ n, total }]] = await db.query('SELECT COUNT(*) AS n, SUM(amount) AS total FROM supports WHERE user_id = ?', [ids.racer]);
    assert.equal(Number(n), 3);
    assert.equal(Number(total), 90);
});

test('supports are rate limited', async () => {
    for (let i = 0; i < 5; i++) assert.equal((await support(users.spammer, ids.author, { amount: 1 })).status, 200);
    assert.equal((await support(users.spammer, ids.author, { amount: 1 })).status, 429);
    assert.equal(await coinsOf(ids.spammer), 995);
});

test('top fans rank purchases + supports, top 10 only, banned users and the author left out', async () => {
    // fan buys the 10-coin chapter and sends 100; reader has sent 50; racer 90; spammer 5
    assert.equal((await users.fan.post('/api/purchases', { kind: 'chapter', id: s.chapter })).status, 200);
    assert.equal((await support(users.fan, ids.author, { amount: 100 })).status, 200);
    assert.equal((await support(users.banned, ids.author, { amount: 900 })).status, 200);
    await db.query(`UPDATE users SET role = 'BANNED' WHERE id = ?`, [ids.banned]);
    // The API never allows this; a row like it (e.g. from an old bug) must still not make the author their own fan
    await db.query('INSERT INTO supports (id, user_id, author_id, amount, author_earning) VALUES (?, ?, ?, 5000, 0)', [uuid(), ids.author, ids.author]);
    // Ten more small supporters (1-10 coins) so the list has to cut at ten
    for (let i = 1; i <= 10; i++) {
        const id = uuid();
        extraUsers.push(id);
        await db.query(`INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, 'READER')`, [id, `E2E PF fan${String(i).padStart(2, '0')}`, `e2e-pf-${TAG}-${i}@test.local`]);
        await db.query('INSERT INTO supports (id, user_id, author_id, amount, author_earning) VALUES (?, ?, ?, ?, ?)', [uuid(), id, ids.author, i, i / 2]);
    }

    const html = await page(anon, `/profile/${username}`);
    const section = html.slice(html.indexOf('id="fans-title"'));
    const fans = section.slice(section.indexOf('<ol'), section.indexOf('</ol>'));
    const order = ['E2E fan', 'E2E racer', 'E2E reader', 'E2E PF fan10', 'E2E PF fan09', 'E2E spammer'];
    const at = order.map((name) => fans.indexOf(`>${name}<`));
    assert.ok(at.every((i) => i >= 0), `all present: ${at}`);
    assert.deepEqual([...at].sort((a, b) => a - b), at, '110 > 90 > 50 > 10 > 9 > 5');
    assert.ok(!fans.includes('E2E banned'), 'banned supporter hidden');
    assert.ok(!fans.includes(`E2E PF ${TAG} Author<`), 'author not a fan of themselves');
    const listed = (fans.match(/<li/g) || []).length;
    assert.equal(listed, 10);
    for (const medal of ['เหรียญทอง', 'เหรียญเงิน', 'เหรียญทองแดง']) assert.ok(fans.includes(medal), medal);
    assert.ok(!fans.includes('E2E PF fan01') && !fans.includes('E2E PF fan02'), 'cut at ten');
});

test('works tabs list published stories with completion, categories and counts', async () => {
    await db.query('UPDATE novels SET views = 4321 WHERE id = ?', [s.novel]);
    await users.reader.post('/api/comments', { content_type: 'novel', content_id: s.novel, body: 'ชอบมาก' });
    const draft = (await users.author.post('/api/novels', { title: `E2E PF ${TAG} Draft`, description: 'x', isMature: false })).json.id;

    const html = await page(anon, `/profile/${username}?tab=novels`);
    assert.ok(html.includes(`E2E PF ${TAG} Novel`));
    assert.ok(!html.includes(`E2E PF ${TAG} Draft`), 'drafts are not public');
    assert.ok(html.includes('จบแล้ว'));
    assert.match(html, /1(<!-- -->)? (<!-- -->)?ตอน/);
    assert.ok(html.includes('4,321'));
    assert.match(html, /1(<!-- -->)? (<!-- -->)?คอมเมนต์/);
    assert.ok(!html.includes(`/novel/${draft}`));

    const comics = await page(anon, `/profile/${username}?tab=comics`);
    assert.ok(comics.includes(`E2E PF ${TAG} Comic`));
    assert.ok(!comics.includes(`E2E PF ${TAG} Novel<`));
});

test("author names link to the profile across the site", async () => {
    const href = `href="/profile/${username}"`;
    assert.ok((await page(anon, `/novel/${s.novel}`)).includes(href), 'story page');
    assert.ok((await page(anon, `/comic/${s.comic}`)).includes(href), 'comic page');
    const row = (await anon.get(`/api/novels?search=${encodeURIComponent(`E2E PF ${TAG}`)}`)).json[0];
    assert.equal(row.author_username, username);
    assert.ok((await page(users.reader, '/bookmarks')).length > 0);
    const bookmarks = (await users.reader.get('/api/bookmarks')).json;
    assert.equal((bookmarks.bookmarks ?? bookmarks).find((b) => b.content_id === s.novel).author_username, username);
    const comments = (await anon.get(`/api/comments?content_type=novel&content_id=${s.novel}`)).json.comments;
    assert.ok(comments.every((c) => c.author_username === null && !('user_id' in c)), 'only the story author gets a profile link');
});

test('migration gives every user without one a username and can run again', async () => {
    const id = uuid();
    extraUsers.push(id);
    await db.query(`INSERT INTO users (id, name, email, role) VALUES (?, 'E2E PF mig', ?, 'READER')`, [id, `e2e-pf-${TAG}-mig@test.local`]);
    const run = () => execSync('npx tsx scripts/add_author_profiles.ts', { stdio: 'pipe' });
    run();
    run();
    const [[u]] = await db.query('SELECT username FROM users WHERE id = ?', [id]);
    assert.equal(u.username, `user_${id.replace(/-/g, '').slice(0, 8)}`);
});
