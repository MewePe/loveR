// Maintenance mode. Toggles the global setting (restored afterwards), so the runner uses --test-concurrency=1.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, sleep } from './helpers.mjs';

const CACHE_WAIT_MS = 11_000; // middleware caches the setting for 10s

let db, ids, users, original;
const anon = new Client();

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db, { reader: 'READER', admin: 'ADMIN' }));
    const [rows] = await db.query('SELECT maintenance_mode FROM system_settings WHERE id = "1"');
    original = !!rows[0].maintenance_mode;
});

after(async () => {
    if (db) {
        await db.query('UPDATE system_settings SET maintenance_mode = ? WHERE id = "1"', [original]);
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

test('maintenance mode blocks everyone except admins and /login', async () => {
    assert.equal((await users.admin.post('/api/admin/settings', { maintenance_mode: true })).status, 200);
    await sleep(CACHE_WAIT_MS);

    const page = await anon.get('/');
    assert.equal(page.status, 503);
    assert.ok(page.text.includes('ระบบปิดปรับปรุง'));
    assert.equal((await users.reader.get('/api/coins')).status, 503);
    assert.equal((await anon.get('/login')).status, 200);
    assert.equal((await users.admin.get('/')).status, 200);
});

test('site is back after turning it off', async () => {
    assert.equal((await users.admin.post('/api/admin/settings', { maintenance_mode: false })).status, 200);
    await sleep(CACHE_WAIT_MS);
    assert.equal((await anon.get('/')).status, 200);
});
