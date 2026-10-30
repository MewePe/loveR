// View counting (lib/views.ts): the reader pages add 1 to the chapter/episode and its novel/comic after the access check.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, uuid } from './helpers.mjs';

let db, ids, users;
const anon = new Client();
const c = {};

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db, { reader: 'READER', author: 'AUTHOR' }));
    Object.assign(c, { novel: uuid(), comic: uuid(), ch1: uuid(), ch2: uuid(), paid: uuid(), ep1: uuid(), paidEp: uuid() });
    await db.query(`INSERT INTO novels (id, title, status, author_id) VALUES (?, 'E2E VW Novel', 'PUBLISHED', ?)`, [c.novel, ids.author]);
    await db.query(`INSERT INTO chapters (id, title, content, chapter_order, novel_id, price) VALUES
        (?, 'VW Chapter 1', 'one', 1, ?, 0), (?, 'VW Chapter 2', 'two', 2, ?, 0), (?, 'VW Paid', 'secret', 3, ?, 10)`,
        [c.ch1, c.novel, c.ch2, c.novel, c.paid, c.novel]);
    await db.query(`INSERT INTO comics (id, title, status, author_id) VALUES (?, 'E2E VW Comic', 'PUBLISHED', ?)`, [c.comic, ids.author]);
    await db.query(`INSERT INTO comic_episodes (id, title, episode_order, comic_id, price) VALUES
        (?, 'VW Episode 1', 1, ?, 0), (?, 'VW Paid Episode', 2, ?, 10)`, [c.ep1, c.comic, c.paidEp, c.comic]);
});

after(async () => {
    if (db) {
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

const views = async (table, id) => {
    const [rows] = await db.query(`SELECT views FROM ${table} WHERE id = ?`, [id]);
    return Number(rows[0].views || 0);
};

test('reading a chapter counts for the chapter and its novel', async () => {
    assert.equal((await users.reader.get(`/read/${c.ch1}`)).status, 200);
    assert.equal((await anon.get(`/read/${c.ch1}`)).status, 200);
    assert.equal((await users.reader.get(`/read/${c.ch2}`)).status, 200);

    assert.equal(await views('chapters', c.ch1), 2, 'logged-in and anonymous readers both count');
    assert.equal(await views('chapters', c.ch2), 1);
    assert.equal(await views('novels', c.novel), 3, 'novel total is the sum of its chapter views');
});

test('reading an episode counts for the episode and its comic', async () => {
    assert.equal((await users.reader.get(`/comic/${c.comic}/read/${c.ep1}`)).status, 200);
    assert.equal(await views('comic_episodes', c.ep1), 1);
    assert.equal(await views('comics', c.comic), 1);
});

test('views are also counted per story per day', async () => {
    const daily = async (column, id) => {
        const [rows] = await db.query(`SELECT views, view_date = CURDATE() AS today FROM story_views_daily WHERE ${column} = ?`, [id]);
        return rows.map((r) => [Number(r.views), Number(r.today)]);
    };
    assert.deepEqual(await daily('novel_id', c.novel), [[3, 1]], 'one row for the day, not one per view');
    assert.deepEqual(await daily('comic_id', c.comic), [[1, 1]]);
});

test('paywall pages do not count', async () => {
    assert.equal((await users.reader.get(`/read/${c.paid}`)).status, 200, 'paywall page');
    assert.equal((await users.reader.get(`/comic/${c.comic}/read/${c.paidEp}`)).status, 200, 'paywall page');
    assert.equal(await views('chapters', c.paid), 0);
    assert.equal(await views('novels', c.novel), 3);
    assert.equal(await views('comic_episodes', c.paidEp), 0);
    assert.equal(await views('comics', c.comic), 1);
});

test('authors reading their own work do not count', async () => {
    assert.equal((await users.author.get(`/read/${c.paid}`)).status, 200);
    assert.equal((await users.author.get(`/comic/${c.comic}/read/${c.ep1}`)).status, 200);
    assert.equal(await views('chapters', c.paid), 0);
    assert.equal(await views('comic_episodes', c.ep1), 1);
});

test('author dashboard total uses the counted views', async () => {
    const stats = (await users.author.get('/api/author/stats')).json;
    assert.equal(stats.views, 4, 'novel 3 + comic 1');
});
