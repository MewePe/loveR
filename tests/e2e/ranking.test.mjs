// Rankings and recommendations (lib/ranking.ts): /ranking, ?sort= on the public list APIs,
// "similar stories" on the detail pages and "recommended for you" on the home page.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, uuid } from './helpers.mjs';

let db, ids, users;
const anon = new Client();
const c = {};
const TAG = uuid().slice(0, 8);
// Huge view counts so the test stories rank above any real data
const BIG = 2_000_000_000;

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db, { reader: 'READER', other: 'READER', banned: 'READER', author: 'AUTHOR' }));
    Object.assign(c, { cat: uuid(), a: uuid(), b: uuid(), d: uuid(), draft: uuid(), comic: uuid(), chA: uuid(), chB: uuid() });
    await db.query('INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)', [c.cat, `E2E RK ${TAG}`, `e2e-rk-${TAG}`]);
    // A: most viewed, B: best rated and most sold, D: most bookmarked, draft: must never show up
    await db.query(`INSERT INTO novels (id, title, status, author_id, category_id, views) VALUES
        (?, 'E2E RK ${TAG} A', 'PUBLISHED', ?, ?, ?), (?, 'E2E RK ${TAG} B', 'PUBLISHED', ?, ?, ?),
        (?, 'E2E RK ${TAG} D', 'PUBLISHED', ?, NULL, ?), (?, 'E2E RK ${TAG} Draft', 'DRAFT', ?, ?, ?)`,
        [c.a, ids.author, c.cat, BIG, c.b, ids.author, c.cat, BIG - 2, c.d, ids.author, BIG - 1, c.draft, ids.author, c.cat, BIG]);
    await db.query(`INSERT INTO chapters (id, title, content, chapter_order, novel_id, price) VALUES (?, 'A1', 'x', 1, ?, 10), (?, 'B1', 'x', 1, ?, 10)`,
        [c.chA, c.a, c.chB, c.b]);
    await db.query(`INSERT INTO purchases (id, user_id, chapter_id, item_title, author_id, price, author_earning) VALUES
        (?, ?, ?, 'B1', ?, 10, 7), (?, ?, ?, 'B1', ?, 10, 7)`, [uuid(), ids.reader, c.chB, ids.author, uuid(), ids.other, c.chB, ids.author]);
    await db.query(`INSERT INTO ratings (id, user_id, novel_id, score) VALUES (?, ?, ?, 5), (?, ?, ?, 4), (?, ?, ?, 3), (?, ?, ?, 1)`,
        [uuid(), ids.reader, c.b, uuid(), ids.other, c.b, uuid(), ids.reader, c.a, uuid(), ids.banned, c.b]);
    await db.query(`UPDATE users SET role = 'BANNED' WHERE id = ?`, [ids.banned]);
    await db.query(`INSERT INTO bookmarks (id, user_id, novel_id) VALUES (?, ?, ?), (?, ?, ?)`, [uuid(), ids.other, c.d, uuid(), ids.author, c.d]);
    await db.query(`INSERT INTO comics (id, title, status, author_id, category_id) VALUES (?, 'E2E RK ${TAG} Comic', 'PUBLISHED', ?, ?)`, [c.comic, ids.author, c.cat]);
});

after(async () => {
    if (db) {
        await cleanupUsers(db, Object.values(ids || {}));
        await db.query('DELETE FROM categories WHERE id = ?', [c.cat]);
        await db.end();
    }
});

const search = async (sort) => (await anon.get(`/api/novels?search=${encodeURIComponent(`E2E RK ${TAG}`)}&sort=${sort}`)).json;
// Position of each test story in a page, in the order it appears
const order = (html, keys) => keys.map((k) => ({ k, i: html.indexOf(`/novel/${c[k]}`) })).filter((x) => x.i >= 0).sort((x, y) => x.i - y.i).map((x) => x.k);

test('list API sorts and returns stats, never drafts', async () => {
    const byViews = await search('views');
    assert.deepEqual(byViews.map((n) => n.id), [c.a, c.d, c.b]);
    const b = byViews.find((n) => n.id === c.b);
    assert.equal(b.rating_avg, 4.5, 'banned rater does not count');
    assert.equal(b.rating_count, 2);
    assert.equal(b.sales, 2);
    assert.equal(byViews.find((n) => n.id === c.d).bookmarks, 2);

    assert.deepEqual((await search('rating')).map((n) => n.id), [c.b, c.a, c.d], 'unrated last');
    assert.equal((await search('nonsense')).length, 3, 'unknown sort falls back to newest');
});

test('/ranking orders by the chosen stat and skips drafts', async () => {
    const page = async (sort) => {
        const res = await anon.get(`/ranking?type=novel&sort=${sort}`);
        assert.equal(res.status, 200);
        return res.text;
    };
    const views = await page('views');
    assert.deepEqual(order(views, ['a', 'b', 'd']), ['a', 'd', 'b']);
    assert.ok(!views.includes(`/novel/${c.draft}`));
    assert.deepEqual(order(await page('sales'), ['a', 'b', 'd']).slice(0, 1), ['b']);
    assert.deepEqual(order(await page('bookmarks'), ['a', 'b', 'd']).slice(0, 1), ['d']);
    assert.equal((await anon.get('/ranking?type=comic&sort=rating')).status, 200);
    assert.equal((await anon.get('/ranking?type=bad&sort=bad')).status, 200, 'bad params fall back to defaults');
});

test('detail page shows similar stories from the same category first', async () => {
    const html = (await anon.get(`/novel/${c.a}`)).text;
    assert.ok(html.includes('เรื่องที่คล้ายกัน'));
    assert.ok(html.includes(`/novel/${c.b}`), 'same category');
    assert.ok(!html.includes(`/novel/${c.draft}`), 'no drafts');
    assert.ok(order(html, ['b', 'd'])[0] === 'b', 'same category before other popular stories');
});

test('home page recommends unread stories from the categories the user follows', async () => {
    assert.ok(!(await users.reader.get('/')).text.includes('แนะนำสำหรับคุณ'), 'no history yet');

    assert.equal((await users.reader.post('/api/bookmarks', { content_type: 'novel', content_id: c.a })).status, 200);
    const html = (await users.reader.get('/')).text;
    assert.ok(html.includes('แนะนำสำหรับคุณ'));
    const section = html.slice(html.indexOf('แนะนำสำหรับคุณ'), html.indexOf('นิยายยอดนิยม'));
    assert.ok(section.includes(`/novel/${c.b}`), 'same category as the bookmark');
    assert.ok(section.includes(`/comic/${c.comic}`), 'comics in that category too');
    assert.ok(!section.includes(`/novel/${c.a}`), 'not what they already bookmarked');
    assert.ok(!section.includes(`/novel/${c.draft}`), 'no drafts');

    const authorHome = (await users.author.get('/')).text;
    const authorSection = authorHome.includes('แนะนำสำหรับคุณ') ? authorHome.slice(authorHome.indexOf('แนะนำสำหรับคุณ'), authorHome.indexOf('นิยายยอดนิยม')) : '';
    assert.ok(!authorSection.includes(`/novel/${c.b}`), 'never their own work');
});
