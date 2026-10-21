// Sign-up rate limit (lib/registerThrottle.ts): 10 attempts per IP per hour.
// Top-up rate limit (/api/coins/topup): 10 requests per user per 24 hours, on top of the 3-PENDING cap.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, form, png, uuid } from './helpers.mjs';

let db, ids, users;
const testIps = [];
const tag = uuid().slice(0, 8);
const registeredEmails = [];

// Each test uses its own fake client IP so limits don't leak between tests (or onto the developer's own sign-ups)
function clientFromNewIp() {
    const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}-${uuid().slice(0, 6)}`;
    testIps.push(ip);
    return new Client({ 'x-forwarded-for': ip });
}

function register(client, n) {
    const email = `e2e-signup-${tag}-${n}@test.local`;
    registeredEmails.push(email);
    return client.post('/api/register', { name: 'E2E signup', email, password: 'longenough1' });
}

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db, { reader: 'READER' }));
});

after(async () => {
    if (db) {
        await db.query('DELETE FROM register_attempts WHERE ip IN (?)', [testIps.length ? testIps : ['-']]);
        const [rows] = await db.query('SELECT id FROM users WHERE email IN (?)', [registeredEmails.length ? registeredEmails : ['-']]);
        await cleanupUsers(db, [...Object.values(ids || {}), ...rows.map((r) => r.id)]);
        await db.end();
    }
});

test('11th sign-up from one IP within an hour is rejected; other IPs are unaffected', async () => {
    const client = clientFromNewIp();
    for (let i = 0; i < 10; i++) {
        assert.equal((await register(client, i)).status, 201, `sign-up ${i + 1}`);
    }
    assert.equal((await register(client, 10)).status, 429);
    assert.equal((await register(clientFromNewIp(), 11)).status, 201, 'a different IP can still sign up');
});

test('existing-email attempts count too (no account probing past the limit)', async () => {
    const client = clientFromNewIp();
    const email = registeredEmails[0];
    for (let i = 0; i < 10; i++) {
        const res = await client.post('/api/register', { name: 'x', email, password: 'longenough1' });
        assert.equal(res.status, 409, `attempt ${i + 1}`);
    }
    const res = await client.post('/api/register', { name: 'x', email, password: 'longenough1' });
    assert.equal(res.status, 429, 'blocked before revealing whether the email exists');
});

test('invalid input does not use up the limit', async () => {
    const client = clientFromNewIp();
    for (let i = 0; i < 12; i++) {
        assert.equal((await client.post('/api/register', { name: 'x', email: 'not-an-email', password: 'longenough1' })).status, 400);
    }
    assert.equal((await register(client, 'after-invalid')).status, 201);
});

test('the sign-up limit expires after the window', async () => {
    const client = clientFromNewIp();
    const ip = testIps.at(-1);
    for (let i = 0; i < 10; i++) {
        await db.query('INSERT INTO register_attempts (ip, created_at) VALUES (?, NOW() - INTERVAL 61 MINUTE)', [ip]);
    }
    assert.equal((await register(client, 'after-window')).status, 201, 'attempts older than an hour are ignored');
});

test('top-ups are limited per user per day, counting every status', async () => {
    const insert = (status, age) => db.query(
        `INSERT INTO coin_topups (id, user_id, amount, slip_image, status, created_at) VALUES (?, ?, 100, '/x', ?, NOW() - INTERVAL ${age} HOUR)`,
        [uuid(), ids.reader, status]);
    // Old requests don't count towards today's limit
    for (let i = 0; i < 10; i++) await insert('REJECTED', 25);
    assert.equal((await users.reader.post('/api/coins/topup', form({ amount: '100', slip: png() }))).status, 200);

    // 1 real request + 9 rejected ones today = 10 → the next one is refused even though only 1 is PENDING
    for (let i = 0; i < 9; i++) await insert('REJECTED', 1);
    const res = await users.reader.post('/api/coins/topup', form({ amount: '100', slip: png() }));
    assert.equal(res.status, 429);
    const [rows] = await db.query('SELECT COUNT(*) AS n FROM coin_topups WHERE user_id = ? AND status = "PENDING"', [ids.reader]);
    assert.equal(Number(rows[0].n), 1, 'the refused request was not saved');
});
