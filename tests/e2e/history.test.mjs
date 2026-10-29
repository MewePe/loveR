// Reading history (lib/readingHistory.ts, /api/history, /history): recorded by the reader pages after the access check.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, uuid } from './helpers.mjs';

let db, ids, users;
const anon = new Client();
const c = {};

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db, { reader: 'READER', other: 'READER', author: 'AUTHOR' }));
    Object.assign(c, { novel: uuid(), comic: uuid(), ch1: uuid(), ch2: uuid(), paid: uuid(), ep1: uuid() });
    await db.query(`INSERT INTO novels (id, title, status, author_id) VALUES (?, 'E2E HI Novel', 'PUBLISHED', ?)`, [c.novel, ids.author]);
    await db.query(`INSERT INTO chapters (id, title, content, chapter_order, novel_id, price) VALUES
        (?, 'HI Chapter 1', 'one', 1, ?, 0), (?, 'HI Chapter 2', 'two', 2, ?, 0), (?, 'HI Paid', 'secret', 3, ?, 10)`,
        [c.ch1, c.novel, c.ch2, c.novel, c.paid, c.novel]);
    await db.query(`INSERT INTO comics (id, title, status, author_id) VALUES (?, 'E2E HI Comic', 'PUBLISHED', ?)`, [c.comic, ids.author]);
    await db.query(`INSERT INTO comic_episodes (id, title, episode_order, comic_id, price) VALUES (?, 'HI Episode 1', 1, ?, 0)`, [c.ep1, c.comic]);
});

after(async () => {
    if (db) {
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

const history = async (client) => (await client.get('/api/history')).json;
const remove = (client, body) => client.del('/api/history', body);

test('history requires login', async () => {
    assert.equal((await anon.get('/api/history')).status, 401);
    assert.equal((await remove(anon, { all: true })).status, 401);
});

test('reading records the last chapter/episode per story, newest first', async () => {
    assert.equal((await users.reader.get(`/read/${c.ch1}`)).status, 200);
    assert.equal((await users.reader.get(`/comic/${c.comic}/read/${c.ep1}`)).status, 200);
    assert.equal((await users.reader.get(`/read/${c.ch2}`)).status, 200);

    const res = await history(users.reader);
    assert.equal(res.total, 2, 'one entry per story, not per chapter');
    const [novel, comic] = res.items;
    assert.equal(novel.content_type, 'novel');
    assert.equal(novel.content_id, c.novel);
    assert.equal(novel.last_item_id, c.ch2);
    assert.equal(novel.last_item_title, 'HI Chapter 2');
    assert.equal(comic.content_type, 'comic');
    assert.equal(comic.last_item_id, c.ep1);

    const profile = (await users.reader.get('/api/profile')).json;
    assert.equal(profile.stats.novelsRead, 1);
    assert.equal(profile.stats.comicsRead, 1);
});

test('locked chapters are not recorded', async () => {
    assert.equal((await users.other.get(`/read/${c.paid}`)).status, 200, 'paywall page');
    assert.equal((await history(users.other)).total, 0);
});

test('each user only sees their own history', async () => {
    assert.equal((await users.other.get(`/read/${c.ch1}`)).status, 200);
    const res = await history(users.other);
    assert.equal(res.total, 1);
    assert.equal(res.items[0].last_item_id, c.ch1);
    assert.equal((await history(users.reader)).items[0].last_item_id, c.ch2, "other users' reads don't touch mine");
});

test('stories that are no longer published drop out of the list', async () => {
    await db.query("UPDATE novels SET status = 'DRAFT' WHERE id = ?", [c.novel]);
    try {
        const res = await history(users.reader);
        assert.deepEqual(res.items.map((i) => i.content_type), ['comic']);
        assert.equal(res.total, 1);
    } finally {
        await db.query("UPDATE novels SET status = 'PUBLISHED' WHERE id = ?", [c.novel]);
    }
});

test('a deleted chapter keeps the entry with no last chapter', async () => {
    await db.query('DELETE FROM chapters WHERE id = ?', [c.ch2]);
    const novel = (await history(users.reader)).items.find((i) => i.content_type === 'novel');
    assert.equal(novel.last_item_id, null);
    assert.equal(novel.last_item_title, null);
});

test('remove one entry, then clear all', async () => {
    assert.equal((await remove(users.reader, { content_type: 'book', content_id: c.novel })).status, 400);
    assert.equal((await remove(users.reader, { content_type: 'novel', content_id: c.novel })).status, 200);
    assert.deepEqual((await history(users.reader)).items.map((i) => i.content_type), ['comic']);

    assert.equal((await remove(users.reader, { all: true })).status, 200);
    assert.equal((await history(users.reader)).total, 0);
    assert.equal((await history(users.other)).total, 1, "clearing doesn't touch other users");
    assert.equal((await users.reader.get('/api/profile')).json.stats.novelsRead, 0);
});

test('the history page moved to the profile tab', async () => {
    const old = await users.reader.get('/history');
    assert.ok([307, 308].includes(old.status));
    assert.ok(old.headers.get('location').endsWith('/profile?tab=history'));
    const own = await users.reader.get('/profile?tab=history');
    const target = own.headers.get('location').replace(/^https?:\/\/[^/]+/, '');
    assert.match(target, /^\/profile\/[a-z0-9_]+\?tab=history$/);
    assert.equal((await users.reader.get(target)).status, 200);
});
