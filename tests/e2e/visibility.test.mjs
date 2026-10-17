// Unpublished content visibility and private comic page images.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, form, png, PNG, uuid, storagePath, publicPath } from './helpers.mjs';

let db, ids, users;
const anon = new Client();
const c = {};

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db,
        { reader: 'READER', reader2: 'READER', author: 'AUTHOR', author2: 'AUTHOR', admin: 'ADMIN' }, { coins: 1000 }));
    Object.assign(c, { draftNovel: uuid(), pubNovel: uuid(), draftComic: uuid(), pubComic: uuid(), comic2: uuid() });
    await db.query(`INSERT INTO novels (id, title, status, author_id) VALUES (?, 'E2E Draft Novel', 'DRAFT', ?), (?, 'E2E Pub Novel', 'PUBLISHED', ?)`,
        [c.draftNovel, ids.author, c.pubNovel, ids.author]);
    await db.query(`INSERT INTO comics (id, title, status, author_id) VALUES (?, 'E2E Draft Comic', 'DRAFT', ?), (?, 'E2E Pub Comic', 'PUBLISHED', ?), (?, 'E2E Comic2', 'PUBLISHED', ?)`,
        [c.draftComic, ids.author, c.pubComic, ids.author, c.comic2, ids.author2]);
    c.draftCh = (await users.author.post(`/api/novels/${c.draftNovel}/chapters`, { title: 'D1', content: 'DRAFT-SECRET', price: 0 })).json.id;
    c.paidCh = (await users.author.post(`/api/novels/${c.pubNovel}/chapters`, { title: 'P1', content: 'PAID-SECRET', price: 50 })).json.id;
    c.draftEp = (await users.author.post(`/api/comics/${c.draftComic}/episodes`, { title: 'DE', price: 0, pages: [] })).json.id;
});

after(async () => {
    if (db) {
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

test('draft novel is 404 for others, visible to author and admin', async () => {
    assert.equal((await anon.get(`/novel/${c.draftNovel}`)).status, 404);
    assert.equal((await users.reader.get(`/novel/${c.draftNovel}`)).status, 404);
    assert.equal((await users.author.get(`/novel/${c.draftNovel}`)).status, 200);
    assert.equal((await users.admin.get(`/novel/${c.draftNovel}`)).status, 200);
    const res = await anon.get(`/read/${c.draftCh}`);
    assert.equal(res.status, 404);
    assert.ok(!res.text.includes('DRAFT-SECRET'));
    assert.ok((await users.author.get(`/read/${c.draftCh}`)).text.includes('DRAFT-SECRET'));
});

test('draft novel is 404 in every API', async () => {
    assert.equal((await users.reader.get(`/api/novels/${c.draftNovel}`)).status, 404);
    assert.equal((await users.author.get(`/api/novels/${c.draftNovel}`)).status, 200);
    assert.equal((await users.reader.get(`/api/novels/${c.draftNovel}/chapters`)).status, 404);
    assert.equal((await users.reader.get(`/api/chapters?novelId=${c.draftNovel}`)).status, 404);
    const res = await users.reader.get(`/api/chapters?chapterId=${c.draftCh}`);
    assert.equal(res.status, 404);
    assert.ok(!res.text.includes('DRAFT-SECRET'));
});

test('public lists ignore ?status=', async () => {
    const novels = (await anon.get('/api/novels?status=DRAFT')).json;
    assert.ok(!novels.some((n) => n.id === c.draftNovel));
    assert.ok(novels.some((n) => n.id === c.pubNovel));
    const comics = (await anon.get('/api/comics?status=DRAFT')).json;
    assert.ok(!comics.some((x) => x.id === c.draftComic));
});

test('draft comic is 404 in pages and APIs', async () => {
    assert.equal((await anon.get(`/comic/${c.draftComic}`)).status, 404);
    assert.equal((await users.author.get(`/comic/${c.draftComic}`)).status, 200);
    assert.equal((await users.reader.get(`/comic/${c.draftComic}/read/${c.draftEp}`)).status, 404);
    assert.equal((await users.reader.get(`/api/comics/${c.draftComic}`)).status, 404);
    assert.equal((await users.reader.get(`/api/comics/${c.draftComic}/episodes`)).status, 404);
    assert.equal((await users.reader.get(`/api/comics/${c.draftComic}/episodes/${c.draftEp}`)).status, 404);
    assert.equal((await users.reader.get(`/api/comics/${c.draftComic}/episodes/${c.draftEp}/pages`)).status, 404);
    assert.equal((await users.author.get(`/comic/${c.pubComic}/read/${c.draftEp}`)).status, 404, 'episode must belong to the comic in the URL');
});

test('authors cannot set BANNED, invalid statuses, or un-ban', async () => {
    assert.equal((await users.author.patch(`/api/novels/${c.draftNovel}`, { status: 'BANNED' })).status, 400);
    assert.equal((await users.author.patch(`/api/novels/${c.draftNovel}`, { status: 'FOO' })).status, 400);
    await db.query('UPDATE novels SET status = "BANNED" WHERE id = ?', [c.draftNovel]);
    assert.equal((await users.author.patch(`/api/novels/${c.draftNovel}`, { status: 'PUBLISHED' })).status, 403);
    const [rows] = await db.query('SELECT status FROM novels WHERE id = ?', [c.draftNovel]);
    assert.equal(rows[0].status, 'BANNED');
    assert.equal((await users.author.patch(`/api/novels/${c.draftNovel}`, { title: 'Renamed' })).status, 200, 'other fields still editable');
    await db.query('UPDATE comics SET status = "BANNED" WHERE id = ?', [c.draftComic]);
    assert.equal((await users.author.patch(`/api/comics/${c.draftComic}`, { status: 'PUBLISHED' })).status, 403);
});

test('archived: buyers keep access, others get 404 and cannot buy', async () => {
    assert.equal((await users.reader.post('/api/purchases', { kind: 'chapter', id: c.paidCh })).status, 200);
    assert.equal((await users.author.patch(`/api/novels/${c.pubNovel}`, { status: 'ARCHIVED' })).status, 200);
    const buyer = await users.reader.get(`/read/${c.paidCh}`);
    assert.equal(buyer.status, 200);
    assert.ok(buyer.text.includes('PAID-SECRET'));
    const other = await users.reader2.get(`/read/${c.paidCh}`);
    assert.equal(other.status, 404);
    assert.ok(!other.text.includes('PAID-SECRET'));
    assert.equal((await users.reader2.post('/api/purchases', { kind: 'chapter', id: c.paidCh })).status, 404);
    assert.equal((await anon.get(`/novel/${c.pubNovel}`)).status, 404);
});

const pageUpload = () => form({ file: png(), purpose: 'comic-page' });

test('comic page uploads are private to the author', async () => {
    assert.equal((await users.reader.post('/api/upload', pageUpload())).status, 401, 'readers cannot upload pages');
    const res = await users.author.post('/api/upload', pageUpload());
    c.privUrl = res.json.url;
    assert.ok(c.privUrl.startsWith(`/api/media/comic-pages/${ids.author}/`));
    c.fileName = c.privUrl.split('/').pop();
    assert.ok(fs.existsSync(storagePath('comic-pages', ids.author, c.fileName)));
    assert.ok(!fs.existsSync(publicPath('uploads', c.fileName)));
    assert.equal((await anon.get(`/uploads/${c.fileName}`)).status, 404);
    const own = await users.author.get(c.privUrl);
    assert.equal(own.status, 200);
    assert.equal(own.headers.get('content-type'), 'image/png');
    assert.ok(own.buf.equals(PNG));
    assert.equal((await anon.get(c.privUrl)).status, 404, 'unattached file is private');
});

test('paid episode images only load for buyers', async () => {
    const res = await users.author.post(`/api/comics/${c.pubComic}/episodes`, { title: 'Paid', price: 30, pages: [c.privUrl] });
    assert.equal(res.status, 200);
    const paidEp = res.json.id;
    assert.equal((await anon.get(c.privUrl)).status, 404);
    assert.equal((await users.reader2.get(c.privUrl)).status, 404);
    assert.ok(!(await users.reader2.get(`/comic/${c.pubComic}/read/${paidEp}`)).text.includes(c.fileName), 'URL not exposed before purchase');

    assert.equal((await users.reader2.post('/api/purchases', { kind: 'episode', id: paidEp })).status, 200);
    const img = await users.reader2.get(c.privUrl);
    assert.equal(img.status, 200);
    assert.ok(img.buf.equals(PNG));
    assert.ok(img.headers.get('cache-control').startsWith('private'));
    assert.ok((await users.reader2.get(`/comic/${c.pubComic}/read/${paidEp}`)).text.includes(c.fileName));
});

test('page URLs are validated', async () => {
    let res = await users.author2.post(`/api/comics/${c.comic2}/episodes`, { title: 'Steal', price: 0, pages: [c.privUrl] });
    assert.equal(res.status, 400, "can't attach another author's private page");
    res = await users.author2.post(`/api/comics/${c.comic2}/episodes`, { title: 'Ext', price: 0, pages: ['https://evil.example/x.png'] });
    assert.equal(res.status, 400, 'external URLs rejected');
    res = await users.author2.post(`/api/comics/${c.comic2}/episodes`, { title: 'Legacy', price: 0, pages: ['/uploads/legacy.png'] });
    assert.equal(res.status, 200, 'legacy /uploads still accepted');
    assert.equal((await users.author.get(`/api/media/comic-pages/${ids.author}/..%2F..%2F.env`)).status, 404);
    assert.equal((await users.author.get(`/api/media/comic-pages/..%2F..%2Fpublic/${c.fileName}`)).status, 404);
});

test('free episode private images are public', async () => {
    const freeEp = (await users.author.post(`/api/comics/${c.pubComic}/episodes`, { title: 'Free', price: 0, pages: [] })).json.id;
    const url = (await users.author.post('/api/upload', pageUpload())).json.url;
    assert.equal((await users.author.post(`/api/comics/${c.pubComic}/episodes/${freeEp}/pages`, { imageUrls: [url] })).status, 200);
    assert.equal((await anon.get(url)).status, 200);
});
