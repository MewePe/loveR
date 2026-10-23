// Dashboard analytics (lib/analytics.ts): /api/admin/analytics and /api/author/analytics
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, uuid } from './helpers.mjs';

let db, ids, users;
const anon = new Client();
const c = {};
let before30d, before12m; // admin totals and today's buckets before this test adds data

const today = (series) => series[series.length - 1];

before(async () => {
    await ensureServer();
    db = await connectDb();
    // The admin is created first so the snapshot below already includes every test user
    ({ ids, clients: users } = await createUsers(db, { admin: 'ADMIN', reader: 'READER', other: 'READER', banned: 'READER', author: 'AUTHOR' }));
    before30d = (await users.admin.get('/api/admin/analytics')).json;
    before12m = (await users.admin.get('/api/admin/analytics?range=12m')).json;

    Object.assign(c, { novel: uuid(), comic: uuid(), ch: uuid(), ep: uuid(), old: uuid() });
    await db.query(`INSERT INTO novels (id, title, status, author_id, views) VALUES (?, 'E2E AN Novel', 'PUBLISHED', ?, 40)`, [c.novel, ids.author]);
    await db.query(`INSERT INTO comics (id, title, status, author_id, views) VALUES (?, 'E2E AN Comic', 'DRAFT', ?, 5)`, [c.comic, ids.author]);
    await db.query(`INSERT INTO chapters (id, title, content, chapter_order, novel_id, price) VALUES (?, 'AN1', 'x', 1, ?, 20)`, [c.ch, c.novel]);
    await db.query(`INSERT INTO comic_episodes (id, title, episode_order, comic_id, price) VALUES (?, 'AN EP', 1, ?, 0)`, [c.ep, c.comic]);
    // Two sales today, one 40 days ago (inside 12 months, outside 30 days)
    await db.query(`INSERT INTO purchases (id, user_id, chapter_id, item_title, author_id, price, author_earning, created_at) VALUES
        (?, ?, ?, 'AN1', ?, 20, 14, NOW()), (?, ?, ?, 'AN1', ?, 20, 14, NOW()), (?, ?, NULL, 'old', ?, 10, 7, NOW() - INTERVAL 40 DAY)`,
        [uuid(), ids.reader, c.ch, ids.author, uuid(), ids.other, c.ch, ids.author, c.old, ids.banned, ids.author]);
    await db.query(`INSERT INTO coin_topups (id, user_id, amount, slip_image, status) VALUES (?, ?, 300, 'x', 'APPROVED'), (?, ?, 999, 'x', 'PENDING'), (?, ?, 50, 'x', 'REJECTED')`,
        [uuid(), ids.reader, uuid(), ids.reader, uuid(), ids.other]);
    await db.query(`INSERT INTO ratings (id, user_id, novel_id, score) VALUES (?, ?, ?, 4), (?, ?, ?, 1)`, [uuid(), ids.reader, c.novel, uuid(), ids.banned, c.novel]);
    await db.query(`INSERT INTO comments (id, user_id, novel_id, body) VALUES (?, ?, ?, 'hi'), (?, ?, ?, 'spam')`, [uuid(), ids.reader, c.novel, uuid(), ids.banned, c.novel]);
    await db.query(`INSERT INTO bookmarks (id, user_id, novel_id) VALUES (?, ?, ?)`, [uuid(), ids.other, c.novel]);
    await db.query(`UPDATE users SET role = 'BANNED' WHERE id = ?`, [ids.banned]);
});

after(async () => {
    if (db) {
        await db.query('DELETE FROM purchases WHERE id = ?', [c.old]);
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

test('admin analytics is admin-only', async () => {
    assert.equal((await anon.get('/api/admin/analytics')).status, 403);
    assert.equal((await users.reader.get('/api/admin/analytics')).status, 403);
    assert.equal((await users.author.get('/api/admin/analytics')).status, 403);
});

test('admin series cover every day/month, oldest first, and count only approved top-ups', async () => {
    const res = (await users.admin.get('/api/admin/analytics')).json;
    assert.equal(res.series.length, 30);
    assert.match(today(res.series).bucket, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(res.series[0].bucket < today(res.series).bucket);

    const now = today(res.series), was = today(before30d.series);
    assert.equal(now.topup_amount - was.topup_amount, 300, 'pending and rejected do not count');
    assert.equal(now.sales_amount - was.sales_amount, 40);
    assert.equal(Math.round((now.platform_amount - was.platform_amount) * 100) / 100, 12);
    assert.equal(res.totals.topup_amount - before30d.totals.topup_amount, 300);
    assert.equal(res.totals.sales_amount - before30d.totals.sales_amount, 50, 'totals include the 40-day-old sale');
    assert.equal(res.totals.pending_topups - before30d.totals.pending_topups, 1);

    const year = (await users.admin.get('/api/admin/analytics?range=12m')).json;
    assert.equal(year.series.length, 12);
    assert.match(today(year.series).bucket, /^\d{4}-\d{2}$/);
    const sum = (s) => s.reduce((t, p) => t + p.sales_amount, 0);
    assert.equal(sum(year.series) - sum(before12m.series), 50, 'the 40-day-old sale is in the 12-month view');
    assert.equal((await users.admin.get('/api/admin/analytics?range=bogus')).json.series.length, 30, 'unknown range = 30 days');
});

test('author analytics shows only their own earnings and per-work stats', async () => {
    assert.equal((await anon.get('/api/author/analytics')).status, 401);
    const res = (await users.author.get('/api/author/analytics')).json;
    assert.equal(res.series.length, 30);
    assert.equal(today(res.series).earning, 28);
    assert.equal(today(res.series).sales, 2);
    assert.equal(res.series.reduce((t, p) => t + p.earning, 0), 28, 'the 40-day-old sale is outside 30 days');
    assert.equal((await users.author.get('/api/author/analytics?range=12m')).json.series.reduce((t, p) => t + p.earning, 0), 35);

    const novel = res.works.find((w) => w.id === c.novel);
    assert.deepEqual(
        { type: novel.type, items: novel.items, views: novel.views, sales: novel.sales, earning: novel.earning },
        { type: 'novel', items: 1, views: 40, sales: 2, earning: 28 });
    assert.equal(novel.rating_avg, 4, 'banned rating does not count');
    assert.equal(novel.rating_count, 1);
    assert.equal(novel.comments, 1, 'banned comment does not count');
    assert.equal(novel.bookmarks, 1);
    const comic = res.works.find((w) => w.id === c.comic);
    assert.equal(comic.status, 'DRAFT', 'drafts are listed for their author');
    assert.equal(comic.rating_avg, null);
    assert.equal(res.works[0].id, c.novel, 'most viewed first');

    const reader = (await users.reader.get('/api/author/analytics')).json;
    assert.equal(reader.works.length, 0);
    assert.ok(reader.series.every((p) => p.earning === 0));
});
