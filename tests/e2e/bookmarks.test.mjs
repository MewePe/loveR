// Bookmarks (ชั้นหนังสือ): add / check / list / remove, and unpublished content handling.
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
    Object.assign(c, { novel: uuid(), comic: uuid(), draft: uuid() });
    await db.query(`INSERT INTO novels (id, title, status, author_id) VALUES (?, 'E2E BM Novel', 'PUBLISHED', ?), (?, 'E2E BM Draft', 'DRAFT', ?)`,
        [c.novel, ids.author, c.draft, ids.author]);
    await db.query(`INSERT INTO comics (id, title, status, author_id) VALUES (?, 'E2E BM Comic', 'PUBLISHED', ?)`, [c.comic, ids.author]);
});

after(async () => {
    if (db) {
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

const check = (client, type, id) => client.get(`/api/bookmarks?content_type=${type}&content_id=${id}`);

test('requires login', async () => {
    assert.equal((await anon.get('/api/bookmarks')).status, 401);
    assert.equal((await anon.post('/api/bookmarks', { content_type: 'novel', content_id: c.novel })).status, 401);
});

test('add, check and list novel + comic bookmarks', async () => {
    assert.equal((await check(users.reader, 'novel', c.novel)).json.bookmarked, false);
    assert.equal((await users.reader.post('/api/bookmarks', { content_type: 'novel', content_id: c.novel })).status, 200);
    assert.equal((await users.reader.post('/api/bookmarks', { content_type: 'novel', content_id: c.novel })).status, 200, 'adding twice is fine');
    assert.equal((await users.reader.post('/api/bookmarks', { content_type: 'comic', content_id: c.comic })).status, 200);
    assert.equal((await check(users.reader, 'novel', c.novel)).json.bookmarked, true);

    const [rows] = await db.query('SELECT COUNT(*) n FROM bookmarks WHERE user_id = ?', [ids.reader]);
    assert.equal(rows[0].n, 2, 'no duplicate rows');

    const list = (await users.reader.get('/api/bookmarks')).json.bookmarks;
    const novel = list.find((b) => b.content_id === c.novel);
    assert.equal(novel.content_type, 'novel');
    assert.equal(novel.title, 'E2E BM Novel');
    assert.equal(novel.author_name, 'E2E author');
    assert.equal(list.find((b) => b.content_id === c.comic)?.content_type, 'comic');
});

test('invalid input and unpublished content are rejected', async () => {
    assert.equal((await users.reader.post('/api/bookmarks', { content_type: 'user', content_id: c.novel })).status, 400);
    assert.equal((await users.reader.post('/api/bookmarks', { content_type: 'novel', content_id: c.draft })).status, 404);
    assert.equal((await users.reader.post('/api/bookmarks', { content_type: 'novel', content_id: uuid() })).status, 404);
});

test('content that becomes unpublished drops out of the list', async () => {
    await db.query('UPDATE comics SET status = "BANNED" WHERE id = ?', [c.comic]);
    const list = (await users.reader.get('/api/bookmarks')).json.bookmarks;
    assert.ok(!list.some((b) => b.content_id === c.comic));
    assert.ok(list.some((b) => b.content_id === c.novel));
});

test('remove a bookmark', async () => {
    assert.equal((await users.reader.del('/api/bookmarks', { content_type: 'novel', content_id: c.novel })).status, 200);
    assert.equal((await check(users.reader, 'novel', c.novel)).json.bookmarked, false);
});
