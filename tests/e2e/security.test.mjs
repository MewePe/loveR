// Security regressions: XSS, bans, private documents, image proxy, URL and registration validation.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, form, png, PNG, uuid, publicPath } from './helpers.mjs';

let db, ids, emails, users, novelId, chapterId;
const anon = new Client();
const registeredEmail = `e2e-register-${uuid().slice(0, 8)}@test.local`;

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, emails, clients: users } = await createUsers(db, { reader: 'READER', reader2: 'READER', author: 'AUTHOR', admin: 'ADMIN' }));
    novelId = uuid();
    await db.query(`INSERT INTO writer_profiles (user_id, first_name, last_name, status, bank_name, bank_account_name, bank_account_number)
                    VALUES (?, 'E2E', 'Author', 'APPROVED', 'kbank', 'E2E Author', '1234567890')`, [ids.author]);
    await db.query(`INSERT INTO novels (id, title, status, author_id) VALUES (?, 'E2E Novel', 'PUBLISHED', ?)`, [novelId, ids.author]);
});

after(async () => {
    if (db) {
        const [reg] = await db.query('SELECT id FROM users WHERE email = ?', [registeredEmail]);
        await cleanupUsers(db, [...Object.values(ids || {}), ...reg.map((u) => u.id)]);
        await db.end();
    }
});

test('chapter content is rendered as text, not HTML (stored XSS)', async () => {
    const payload = '<img src=x onerror="fetch(\'/api/purchases\')">\nบรรทัดที่สอง <script>alert(1)</script>';
    chapterId = (await users.author.post(`/api/novels/${novelId}/chapters`, { title: 'XSS', content: payload, price: 0 })).json.id;
    const res = await users.reader.get(`/read/${chapterId}`);
    assert.ok(!res.text.includes('<img src=x onerror'));
    assert.ok(!res.text.includes('<script>alert(1)</script>'));
    assert.ok(res.text.includes('&lt;img src=x onerror'), 'shown escaped');
    assert.ok(res.text.includes('บรรทัดที่สอง'));
});

test('role changes are validated', async () => {
    assert.equal((await users.admin.patch(`/api/admin/users/${ids.reader}`, { role: 'WRITER' })).status, 400);
    assert.equal((await users.admin.patch(`/api/admin/users/${ids.admin}`, { role: 'READER' })).status, 400, 'no self-demotion');
    assert.equal((await users.admin.patch(`/api/admin/users/${uuid()}`, { role: 'READER' })).status, 404);
});

test('banning ends sessions and blocks login; writer approval does not un-ban', async () => {
    assert.equal((await users.reader.get('/api/coins')).status, 200);
    assert.equal((await users.admin.patch(`/api/admin/users/${ids.reader}`, { role: 'BANNED' })).status, 200);
    const [rows] = await db.query('SELECT role FROM users WHERE id = ?', [ids.reader]);
    assert.equal(rows[0].role, 'BANNED');
    assert.equal((await users.reader.get('/api/coins')).status, 401, 'existing session ends');
    assert.ok(!(await users.reader.get('/api/auth/session')).json?.user);
    assert.equal(await new Client().login(emails.reader), false, 'cannot log in again');

    await db.query(`INSERT INTO writer_profiles (user_id, first_name, last_name, status) VALUES (?, 'B', 'B', 'PENDING')`, [ids.reader]);
    await users.admin.patch(`/api/admin/writers/${ids.reader}`, { status: 'APPROVED' });
    const [still] = await db.query('SELECT role FROM users WHERE id = ?', [ids.reader]);
    assert.equal(still[0].role, 'BANNED');

    await users.admin.patch(`/api/admin/users/${ids.reader}`, { role: 'READER' });
    assert.ok(await users.reader.login(emails.reader), 'unbanned user can log in');
});

test('top-up slips are private to the owner and admins', async () => {
    assert.equal((await users.reader.post('/api/coins/topup', form({ amount: '100', slip: png() }))).status, 200);
    const [rows] = await db.query('SELECT slip_image FROM coin_topups WHERE user_id = ?', [ids.reader]);
    const url = rows[0].slip_image;
    assert.ok(url.startsWith(`/api/media/private/topup-slips/${ids.reader}/`));
    assert.ok(!fs.existsSync(publicPath('uploads', 'slips', url.split('/').pop())));
    const own = await users.reader.get(url);
    assert.equal(own.status, 200);
    assert.ok(own.buf.equals(PNG));
    assert.equal((await users.admin.get(url)).status, 200);
    assert.equal((await users.reader2.get(url)).status, 404);
    assert.equal((await anon.get(url)).status, 404);
});

test('ID card / bank book scans are private', async () => {
    const res = await users.author.post('/api/author/profile', form({ first_name: 'E2E', id_card_image: png(), bank_book_image: png() }));
    assert.equal(res.status, 200);
    const [rows] = await db.query('SELECT id_card_image, bank_book_image FROM writer_profiles WHERE user_id = ?', [ids.author]);
    assert.ok(rows[0].id_card_image.startsWith(`/api/media/private/writer-docs/${ids.author}/`));
    assert.equal((await users.author.get(rows[0].id_card_image)).status, 200);
    assert.equal((await users.admin.get(rows[0].bank_book_image)).status, 200);
    assert.equal((await users.reader2.get(rows[0].id_card_image)).status, 404);
    assert.equal((await anon.get(rows[0].id_card_image)).status, 404);
});

test('payout slips are private; private media rejects path tricks', async () => {
    await db.query(`INSERT INTO purchases (id, user_id, chapter_id, item_title, author_id, price, author_earning) VALUES (?, ?, ?, 'x', ?, 200, 140)`,
        [uuid(), ids.reader2, chapterId, ids.author]);
    assert.equal((await users.author.post('/api/author/withdrawals', { amount: 100 })).status, 200);
    const [wd] = await db.query('SELECT id FROM withdrawals WHERE user_id = ?', [ids.author]);
    assert.equal((await users.admin.patch(`/api/admin/withdrawals/${wd[0].id}`, form({ status: 'APPROVED', slip: png() }))).status, 200);
    const [rows] = await db.query('SELECT slip_image FROM withdrawals WHERE id = ?', [wd[0].id]);
    assert.ok(rows[0].slip_image.startsWith(`/api/media/private/withdrawal-slips/${ids.author}/`));
    assert.equal((await users.author.get(rows[0].slip_image)).status, 200);
    assert.equal((await users.reader2.get(rows[0].slip_image)).status, 404);
    assert.equal((await users.admin.get(`/api/media/private/..%2F..%2F/${ids.author}/x.png`)).status, 404);
    assert.equal((await users.admin.get(`/api/media/private/writer-docs/${ids.author}/..%2F..%2F..%2F.env`)).status, 404);
});

test('image optimizer is not an open proxy', async () => {
    const res = await anon.get(`/_next/image?url=${encodeURIComponent('https://example.com/x.png')}&w=64&q=75`);
    assert.equal(res.status, 400);
});

test('cover and avatar URLs must be local uploads', async () => {
    assert.equal((await users.author.post('/api/novels', { title: 'T', description: 'd', coverImage: 'https://evil.example/t.gif' })).status, 400);
    assert.equal((await users.author.patch(`/api/novels/${novelId}`, { coverImage: 'javascript:alert(1)' })).status, 400);
    assert.equal((await users.author.patch(`/api/novels/${novelId}`, { coverImage: '/uploads/abc.png' })).status, 200);
    assert.equal((await users.reader2.patch('/api/profile', { image: 'https://evil.example/a.png' })).status, 400);
    assert.equal((await users.reader2.patch('/api/profile', { name: '' })).status, 400);
    assert.equal((await users.reader2.patch('/api/profile', { name: 'New Name', image: '/uploads/me.png' })).status, 200);
});

test('registration validates input', async () => {
    assert.equal((await anon.post('/api/register', { name: 'x', email: 'not-an-email', password: 'longenough' })).status, 400);
    assert.equal((await anon.post('/api/register', { name: 'x', email: registeredEmail, password: 'short' })).status, 400);
    assert.equal((await anon.post('/api/register', { name: 'x', email: registeredEmail, password: 'longenough1' })).status, 201);
});

test('upload endpoint requires login and real images', async () => {
    assert.equal((await anon.post('/api/upload', form({ file: png() }))).status, 401);
    const fake = new Blob(['<script>alert(1)</script>'], { type: 'image/png' });
    assert.equal((await users.reader.post('/api/upload', form({ file: fake }))).status, 415);
});
