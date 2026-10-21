// Comments and star ratings on novels/comics: posting, permissions, visibility, moderation and reports.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, uuid } from './helpers.mjs';

let db, ids, users;
const anon = new Client();
const c = {};

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db, { reader: 'READER', other: 'READER', author: 'AUTHOR', admin: 'ADMIN' }));
    Object.assign(c, { novel: uuid(), comic: uuid(), draft: uuid() });
    await db.query(`INSERT INTO novels (id, title, status, author_id) VALUES (?, 'E2E CM Novel', 'PUBLISHED', ?), (?, 'E2E CM Draft', 'DRAFT', ?)`,
        [c.novel, ids.author, c.draft, ids.author]);
    await db.query(`INSERT INTO comics (id, title, status, author_id) VALUES (?, 'E2E CM Comic', 'PUBLISHED', ?)`, [c.comic, ids.author]);
});

after(async () => {
    if (db) {
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

const list = (client, type, id, page = 1) => client.get(`/api/comments?content_type=${type}&content_id=${id}&page=${page}`);
const post = (client, type, id, body) => client.post('/api/comments', { content_type: type, content_id: id, body });
const rating = (client, type, id) => client.get(`/api/ratings?content_type=${type}&content_id=${id}`);
const rate = (client, type, id, score) => client.req('PUT', '/api/ratings', { content_type: type, content_id: id, score });

test('posting requires login; reading is public', async () => {
    assert.equal((await post(anon, 'novel', c.novel, 'hi')).status, 401);
    const res = await list(anon, 'novel', c.novel);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.comments, []);
    assert.equal(res.json.total, 0);
});

test('post and list comments, newest first, with author badge', async () => {
    assert.equal((await post(users.reader, 'novel', c.novel, '  first  ')).status, 200);
    assert.equal((await post(users.author, 'novel', c.novel, 'thanks for reading')).status, 200);
    assert.equal((await post(users.reader, 'comic', c.comic, 'comic comment')).status, 200);

    const res = await list(anon, 'novel', c.novel);
    assert.equal(res.json.total, 2);
    const [newest, oldest] = res.json.comments;
    assert.equal(newest.body, 'thanks for reading');
    assert.equal(newest.is_author, true);
    assert.equal(oldest.body, 'first', 'body is trimmed');
    assert.equal(oldest.is_author, false);
    assert.equal(oldest.can_delete, false, 'anonymous viewers cannot delete');
    assert.ok(!('user_id' in oldest) && !('email' in oldest), 'no user ids or emails leak');

    assert.equal((await list(anon, 'comic', c.comic)).json.total, 1, 'novel and comic comments are separate');
});

test('comment bodies are stored as plain text', async () => {
    const xss = '<img src=x onerror=alert(1)>';
    assert.equal((await post(users.other, 'novel', c.novel, xss)).status, 200);
    const found = (await list(anon, 'novel', c.novel)).json.comments.find((x) => x.body === xss);
    assert.ok(found, 'returned verbatim as text (UI renders it as text, never HTML)');
});

test('invalid comments are rejected', async () => {
    assert.equal((await post(users.reader, 'novel', c.novel, '   ')).status, 400);
    assert.equal((await post(users.reader, 'novel', c.novel, 'x'.repeat(1001))).status, 400);
    assert.equal((await post(users.reader, 'user', c.novel, 'hi')).status, 400);
    assert.equal((await post(users.reader, 'novel', uuid(), 'hi')).status, 404);
    assert.equal((await list(anon, 'chapter', c.novel)).status, 400);
});

test('unpublished content: 404 for others, allowed for the owner', async () => {
    assert.equal((await list(anon, 'novel', c.draft)).status, 404);
    assert.equal((await post(users.reader, 'novel', c.draft, 'hi')).status, 404);
    assert.equal((await post(users.author, 'novel', c.draft, 'note to self')).status, 200);
    assert.equal((await list(users.author, 'novel', c.draft)).json.total, 1);
});

test('delete permissions: commenter, content author and admin only', async () => {
    const comments = (await list(users.reader, 'novel', c.novel)).json.comments;
    const mine = comments.find((x) => x.body === 'first');
    const others = comments.find((x) => x.body.startsWith('<img'));
    assert.equal(mine.can_delete, true);
    assert.equal(mine.is_mine, true);
    assert.equal(others.can_delete, false);

    assert.equal((await users.reader.del(`/api/comments/${others.id}`)).status, 403);
    assert.equal((await anon.del(`/api/comments/${others.id}`)).status, 401);
    assert.equal((await users.author.del(`/api/comments/${others.id}`)).status, 200, 'author moderates their own work');
    assert.equal((await users.reader.del(`/api/comments/${mine.id}`)).status, 200);
    assert.equal((await users.reader.del(`/api/comments/${mine.id}`)).status, 404);
    assert.equal((await list(anon, 'novel', c.novel)).json.total, 1);
});

test('reporting a comment shows up for admin, who can delete it', async () => {
    const target = (await list(anon, 'novel', c.novel)).json.comments[0];
    const res = await users.reader.post('/api/reports', { target_type: 'COMMENT', target_id: target.id, reason: 'spam' });
    assert.equal(res.status, 200);
    assert.equal((await users.reader.post('/api/reports', { target_type: 'COMMENT', target_id: uuid(), reason: 'spam' })).status, 404);

    const report = (await users.admin.get('/api/admin/reports')).json.find((r) => r.target_id === target.id);
    assert.equal(report.target_type, 'COMMENT');
    assert.equal(report.target_title, 'thanks for reading');
    assert.equal(report.parent_type, 'NOVEL');
    assert.equal(report.parent_id, c.novel);

    assert.equal((await users.admin.del(`/api/comments/${target.id}`)).status, 200);
    assert.equal((await list(anon, 'novel', c.novel)).json.total, 0);
});

test('comment rate limit', async () => {
    const [before] = await db.query('SELECT COUNT(*) n FROM comments WHERE user_id = ? AND created_at > NOW() - INTERVAL 1 MINUTE', [ids.other]);
    let status = 200;
    for (let i = Number(before[0].n); i < 6 && status === 200; i++) {
        status = (await post(users.other, 'comic', c.comic, `spam ${i}`)).status;
    }
    assert.equal(status, 429);
});

test('comments by banned users are hidden', async () => {
    const shown = (await list(anon, 'comic', c.comic)).json.total;
    await db.query('UPDATE users SET role = "BANNED" WHERE id = ?', [ids.other]);
    assert.ok((await list(anon, 'comic', c.comic)).json.total < shown);
    await db.query('UPDATE users SET role = "READER" WHERE id = ?', [ids.other]);
});

test('ratings: rate, change, average and remove', async () => {
    const empty = (await rating(anon, 'novel', c.novel)).json;
    assert.deepEqual(empty, { average: null, count: 0, mine: null, can_rate: false });

    assert.equal((await rate(anon, 'novel', c.novel, 5)).status, 401);
    assert.equal((await rate(users.reader, 'novel', c.novel, 5)).status, 200);
    assert.equal((await rate(users.reader, 'novel', c.novel, 4)).status, 200, 'changing a rating');
    const res = await rate(users.other, 'novel', c.novel, 1);
    // (4 + 1) / 2
    assert.deepEqual(res.json, { average: 2.5, count: 2, mine: 1, can_rate: true });
    assert.deepEqual((await rating(users.reader, 'novel', c.novel)).json, { average: 2.5, count: 2, mine: 4, can_rate: true });

    const [rows] = await db.query('SELECT COUNT(*) n FROM ratings WHERE novel_id = ?', [c.novel]);
    assert.equal(rows[0].n, 2, 'one row per user');

    const removed = await users.other.del('/api/ratings', { content_type: 'novel', content_id: c.novel });
    assert.deepEqual(removed.json, { average: 4, count: 1, mine: null, can_rate: true });
    assert.equal((await rating(anon, 'comic', c.comic)).json.count, 0, 'novel and comic ratings are separate');
});

test('ratings: invalid scores, own work and unpublished content are rejected', async () => {
    for (const score of [0, 6, 3.5, '5', null]) {
        assert.equal((await rate(users.reader, 'novel', c.novel, score)).status, 400, `score ${score}`);
    }
    assert.equal((await rate(users.author, 'novel', c.novel, 5)).status, 403);
    assert.equal((await rating(users.author, 'novel', c.novel)).json.can_rate, false);
    assert.equal((await rate(users.reader, 'novel', c.draft, 5)).status, 404);
    assert.equal((await rating(anon, 'novel', c.draft)).status, 404);
    assert.equal((await rate(users.reader, 'novel', uuid(), 5)).status, 404);
});
