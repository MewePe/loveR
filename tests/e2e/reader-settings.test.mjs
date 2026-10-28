// Novel reader display settings ("Aa" panel): /api/reader-settings and how the reader page renders them
// (lib/readerSettings.ts, components/reader/ReaderSettings.tsx). Not on the comic reader.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, uuid } from './helpers.mjs';

let db, ids, users;
const anon = new Client();
const c = {};
const custom = { size: 4, leading: 'loose', font: 'loopless', theme: 'sepia', width: 'wide' };

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db, { reader: 'READER', author: 'AUTHOR' }));
    Object.assign(c, { novel: uuid(), ch: uuid(), comic: uuid(), ep: uuid() });
    await db.query(`INSERT INTO novels (id, title, status, author_id) VALUES (?, 'E2E RS Novel', 'PUBLISHED', ?)`, [c.novel, ids.author]);
    await db.query(`INSERT INTO chapters (id, title, content, chapter_order, novel_id) VALUES (?, 'RS1', 'เนื้อหา', 1, ?)`, [c.ch, c.novel]);
    await db.query(`INSERT INTO comics (id, title, status, author_id) VALUES (?, 'E2E RS Comic', 'PUBLISHED', ?)`, [c.comic, ids.author]);
    await db.query(`INSERT INTO comic_episodes (id, title, episode_order, comic_id) VALUES (?, 'RS EP', 1, ?)`, [c.ep, c.comic]);
});

after(async () => {
    if (db) {
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

test('settings need a login', async () => {
    assert.equal((await anon.get('/api/reader-settings')).status, 401);
    assert.equal((await anon.req('PUT', '/api/reader-settings', custom)).status, 401);
    assert.equal((await anon.del('/api/reader-settings')).status, 401);
});

test('only complete, whitelisted settings are saved', async () => {
    assert.deepEqual((await users.reader.get('/api/reader-settings')).json, { settings: null });
    const bad = [
        { ...custom, size: 7 }, { ...custom, size: -1 }, { ...custom, size: '2' }, { ...custom, leading: 'huge' },
        { ...custom, font: 'comic-sans' }, { ...custom, theme: 'blue' }, { ...custom, width: 99 },
        { size: 2 }, { ...custom, extra: 1 }, null, 'size=2',
    ];
    for (const body of bad) {
        assert.equal((await users.reader.req('PUT', '/api/reader-settings', body)).status, 400, JSON.stringify(body));
    }
    assert.equal((await users.reader.req('PUT', '/api/reader-settings', custom)).status, 200);
    assert.deepEqual((await users.reader.get('/api/reader-settings')).json.settings, custom);
    const [rows] = await db.query('SELECT reader_settings FROM users WHERE id = ?', [ids.reader]);
    assert.deepEqual(JSON.parse(rows[0].reader_settings), custom);
    assert.deepEqual((await users.author.get('/api/reader-settings')).json, { settings: null }, 'per account');
});

test('the reader page renders the saved settings for logged-in readers', async () => {
    const page = (await users.reader.get(`/read/${c.ch}`)).text;
    assert.match(page, /--reader-size:24px/);
    assert.match(page, /--reader-leading:2\.3/);
    assert.match(page, /--reader-width:64rem/);
    assert.ok(page.includes('data-reader-font="loopless"'));
    assert.ok(page.includes('data-reader-theme="sepia"'));
    assert.ok(!page.includes('document.currentScript.parentElement'), 'no browser preload needed');
    assert.ok(page.includes('aria-label="ตั้งค่าการอ่าน"'));
});

test('anonymous readers get the defaults plus the localStorage preload script', async () => {
    const page = (await anon.get(`/read/${c.ch}`)).text;
    assert.match(page, /--reader-size:20px/);
    assert.ok(page.includes('data-reader-font="looped"'));
    assert.ok(page.includes('loveread:reader-settings'));
    assert.ok(page.includes('document.currentScript.parentElement'));
});

test('a corrupted stored value falls back to the defaults', async () => {
    await db.query('UPDATE users SET reader_settings = ? WHERE id = ?', ['{"size":99,"font":"x","theme":"sepia"', ids.author]);
    const page = (await users.author.get(`/read/${c.ch}`)).text;
    assert.equal((await users.author.get(`/read/${c.ch}`)).status, 200);
    assert.match(page, /--reader-size:20px/);
    assert.deepEqual((await users.author.get('/api/reader-settings')).json.settings, { size: 2, leading: 'normal', font: 'looped', theme: 'white', width: 'normal' });
});

test('reset clears the saved settings', async () => {
    assert.equal((await users.reader.del('/api/reader-settings')).status, 200);
    assert.deepEqual((await users.reader.get('/api/reader-settings')).json, { settings: null });
    assert.match((await users.reader.get(`/read/${c.ch}`)).text, /--reader-size:20px/);
});

test('the comic reader has no reading settings', async () => {
    const page = (await anon.get(`/comic/${c.comic}/read/${c.ep}`)).text;
    assert.ok(!page.includes('ตั้งค่าการอ่าน'));
    assert.ok(!page.includes('reader-root'));
});
