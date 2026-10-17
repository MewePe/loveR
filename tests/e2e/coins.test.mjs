// Coin system: paywall, slip top-ups, purchases (incl. concurrency), author earnings and withdrawals.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, form, png, uuid } from './helpers.mjs';

let db, ids, users, share, novelId, comicId;
const anon = new Client();
const ch = {};
let ep1;

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db, { reader: 'READER', author: 'AUTHOR', author2: 'AUTHOR', admin: 'ADMIN' }));
    novelId = uuid();
    comicId = uuid();
    await db.query(`INSERT INTO writer_profiles (user_id, first_name, last_name, status, bank_name, bank_account_name, bank_account_number)
                    VALUES (?, 'E2E', 'Author', 'APPROVED', 'kbank', 'E2E Author', '1234567890')`, [ids.author]);
    await db.query(`INSERT INTO novels (id, title, status, author_id) VALUES (?, 'E2E Novel', 'PUBLISHED', ?)`, [novelId, ids.author]);
    await db.query(`INSERT INTO comics (id, title, status, author_id) VALUES (?, 'E2E Comic', 'PUBLISHED', ?)`, [comicId, ids.author]);
    const [s] = await db.query('SELECT author_share_percent FROM system_settings WHERE id = "1"');
    share = s[0].author_share_percent;
});

after(async () => {
    if (db) {
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

const earning = (price) => Math.round(price * share) / 100;
const coinsOf = async (client) => (await client.get('/api/coins')).json?.coins;

test('author creates free and priced chapters/episodes', async () => {
    let res = await users.author.post(`/api/novels/${novelId}/chapters`, { title: 'Ch1', content: 'FREE-CH1', price: 0 });
    ch.free = res.json?.id;
    res = await users.author.post(`/api/novels/${novelId}/chapters`, { title: 'Ch2', content: 'SECRET-CH2', price: 200 });
    ch.p200 = res.json?.id;
    res = await users.author.post(`/api/novels/${novelId}/chapters`, { title: 'Ch3', content: 'SECRET-CH3', price: 150 });
    ch.p150 = res.json?.id;
    assert.ok(ch.free && ch.p200 && ch.p150);
    res = await users.author.post(`/api/comics/${comicId}/episodes`, { title: 'Ep1', price: 30, pages: [] });
    ep1 = res.json?.id;
    assert.ok(ep1);
});

test('negative price is rejected', async () => {
    const res = await users.author.post(`/api/novels/${novelId}/chapters`, { title: 'Bad', content: 'x', price: -5 });
    assert.equal(res.status, 400);
});

test('paywall hides paid content everywhere', async () => {
    let res = await anon.get(`/read/${ch.free}`);
    assert.ok(res.text.includes('FREE-CH1'), 'free chapter readable');
    res = await anon.get(`/read/${ch.p200}`);
    assert.equal(res.status, 200);
    assert.ok(res.text.includes('ต้องปลดล็อก'), 'shows paywall');
    assert.ok(!res.text.includes('SECRET-CH2'), 'content not in HTML (incl. RSC payload)');
    res = await users.reader.get(`/api/chapters?chapterId=${ch.p200}`);
    assert.equal(res.json.locked, true);
    assert.equal(res.json.content, null);
    res = await users.reader.get(`/api/novels/${novelId}/chapters`);
    assert.ok(res.json.every((c) => !('content' in c)), 'chapter list has no content for readers');
    res = await users.author.get(`/api/novels/${novelId}/chapters`);
    assert.ok(res.json.some((c) => c.content === 'SECRET-CH2'), 'author sees content');
    res = await users.reader.get(`/api/comics/${comicId}/episodes/${ep1}`);
    assert.equal(res.json.locked, true);
    assert.deepEqual(res.json.pages, []);
    assert.equal((await users.reader.get(`/api/comics/${comicId}/episodes/${ep1}/pages`)).status, 402);
});

test('cannot buy without coins or without login', async () => {
    assert.equal((await users.reader.post('/api/purchases', { kind: 'chapter', id: ch.p200 })).status, 402);
    assert.equal((await anon.post('/api/purchases', { kind: 'chapter', id: ch.p200 })).status, 401);
});

test('top-up validation', async () => {
    assert.equal((await users.reader.post('/api/coins/topup', form({ amount: '5', slip: png() }))).status, 400);
    const fake = new Blob(['<html>evil</html>'], { type: 'image/png' });
    assert.equal((await users.reader.post('/api/coins/topup', form({ amount: '500', slip: fake }))).status, 415);
});

test('admin approves a top-up exactly once; rejected top-ups add nothing', async () => {
    assert.equal((await users.reader.post('/api/coins/topup', form({ amount: '500', slip: png() }))).status, 200);
    assert.equal((await users.reader.post('/api/coins/topup', form({ amount: '999', slip: png() }))).status, 200);
    assert.equal((await users.reader.get('/api/admin/topups')).status, 401, 'readers cannot list top-ups');

    const list = (await users.admin.get('/api/admin/topups')).json.filter((t) => t.user_id === ids.reader);
    const t500 = list.find((t) => t.amount === 500);
    const t999 = list.find((t) => t.amount === 999);
    const results = await Promise.all([
        users.admin.patch(`/api/admin/topups/${t500.id}`, { status: 'APPROVED' }),
        users.admin.patch(`/api/admin/topups/${t500.id}`, { status: 'APPROVED' }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    assert.equal((await users.admin.patch(`/api/admin/topups/${t999.id}`, { status: 'REJECTED', reason: 'slip not found' })).status, 200);

    const res = await users.reader.get('/api/coins');
    assert.equal(res.json.coins, 500);
    assert.ok(res.json.topups.some((t) => t.status === 'REJECTED' && t.rejection_reason === 'slip not found'));
});

test('purchases charge once, even when repeated or concurrent', async () => {
    let res = await users.reader.post('/api/purchases', { kind: 'chapter', id: ch.p200 });
    assert.equal(res.json.coins, 300);
    res = await users.reader.post('/api/purchases', { kind: 'chapter', id: ch.p200 });
    assert.equal(res.json.coins, 300, 'buying again is free');

    await Promise.all(Array.from({ length: 5 }, () => users.reader.post('/api/purchases', { kind: 'chapter', id: ch.p150 })));
    const [rows] = await db.query('SELECT COUNT(*) n FROM purchases WHERE user_id = ? AND chapter_id = ?', [ids.reader, ch.p150]);
    assert.equal(rows[0].n, 1);
    assert.equal(await coinsOf(users.reader), 150);

    res = await users.reader.post('/api/purchases', { kind: 'episode', id: ep1 });
    assert.equal(res.json.coins, 120);
});

test('bought content is readable; free/own content cannot be bought', async () => {
    assert.ok((await users.reader.get(`/read/${ch.p200}`)).text.includes('SECRET-CH2'));
    assert.equal((await users.reader.get(`/api/comics/${comicId}/episodes/${ep1}/pages`)).status, 200);
    assert.ok((await users.reader.get(`/novel/${novelId}`)).text.includes('ซื้อแล้ว'));
    assert.equal((await users.reader.post('/api/purchases', { kind: 'chapter', id: ch.free })).status, 400);
    assert.equal((await users.author.post('/api/purchases', { kind: 'chapter', id: ch.p200 })).status, 400);
});

test('author earnings use the configured share', async () => {
    const expected = Math.round((earning(200) + earning(150) + earning(30)) * 100) / 100;
    const res = await users.author.get('/api/author/earnings');
    assert.equal(res.json.earned, expected);
    assert.equal(res.json.balance, expected);
    assert.equal(res.json.this_month, expected);
    assert.equal(res.json.sales.length, 3);
});

test('withdrawal rules and payout flow', async () => {
    const balance = (await users.author.get('/api/author/earnings')).json.balance;
    assert.equal((await users.author.post('/api/author/withdrawals', { amount: 50 })).status, 400, 'below minimum');
    assert.equal((await users.author.post('/api/author/withdrawals', { amount: balance + 1 })).status, 400, 'over balance');
    assert.equal((await users.author2.post('/api/author/withdrawals', { amount: 100 })).status, 400, 'no approved profile');
    assert.equal((await users.reader.post('/api/author/withdrawals', { amount: 100 })).status, 401, 'readers cannot withdraw');

    // Two concurrent requests that together exceed the balance: only one may succeed
    const half = Math.floor(balance * 0.6);
    const results = await Promise.all([
        users.author.post('/api/author/withdrawals', { amount: half }),
        users.author.post('/api/author/withdrawals', { amount: half }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
    assert.equal((await users.author.get('/api/author/earnings')).json.balance, Math.round((balance - half) * 100) / 100);

    const pending = (await users.admin.get('/api/admin/withdrawals')).json.find((w) => w.user_id === ids.author && w.status === 'PENDING');
    assert.equal(pending.bank_account_number, '1234567890');
    assert.equal((await users.admin.patch(`/api/admin/withdrawals/${pending.id}`, form({ status: 'APPROVED' }))).status, 400, 'slip required');
    assert.equal((await users.admin.patch(`/api/admin/withdrawals/${pending.id}`, { status: 'REJECTED', reason: 'wrong account' })).status, 200);
    assert.equal((await users.author.get('/api/author/earnings')).json.balance, balance, 'rejected amount returns');

    assert.equal((await users.author.post('/api/author/withdrawals', { amount: 100 })).status, 200);
    const next = (await users.admin.get('/api/admin/withdrawals')).json.find((w) => w.user_id === ids.author && w.status === 'PENDING');
    assert.equal((await users.admin.patch(`/api/admin/withdrawals/${next.id}`, form({ status: 'APPROVED', slip: png() }))).status, 200);
    assert.equal((await users.admin.patch(`/api/admin/withdrawals/${next.id}`, { status: 'REJECTED' })).status, 409, 'paid withdrawal is final');
    assert.equal((await users.author.get('/api/author/earnings')).json.balance, Math.round((balance - 100) * 100) / 100);
});

test("authors can't touch other authors' episodes", async () => {
    const c2 = uuid();
    await db.query(`INSERT INTO comics (id, title, status, author_id) VALUES (?, 'E2E Comic 2', 'PUBLISHED', ?)`, [c2, ids.author2]);
    assert.equal((await users.author2.patch(`/api/comics/${c2}/episodes/${ep1}`, { title: 'HACKED', price: 0 })).status, 404);
    await users.author2.del(`/api/comics/${c2}/episodes/${ep1}`);
    const [rows] = await db.query('SELECT title, price FROM comic_episodes WHERE id = ?', [ep1]);
    assert.deepEqual({ ...rows[0] }, { title: 'Ep1', price: 30 });
    assert.equal((await users.author2.post(`/api/comics/${c2}/episodes/${ep1}/pages`, { imageUrls: ['/uploads/x.png'] })).status, 403);
    assert.equal((await users.reader.post('/api/chapters', { title: 'x', content: 'x', novelId })).status, 405, 'POST /api/chapters removed');
});

test('settings validation and reports', async () => {
    assert.equal((await users.admin.post('/api/admin/settings', { author_share_percent: 150 })).status, 400);
    // Sending one field must not wipe the others
    const [before] = await db.query('SELECT * FROM system_settings WHERE id = "1"');
    assert.equal((await users.admin.post('/api/admin/settings', { author_share_percent: before[0].author_share_percent })).status, 200);
    const [afterRows] = await db.query('SELECT * FROM system_settings WHERE id = "1"');
    assert.equal(afterRows[0].site_name, before[0].site_name);
    assert.equal(afterRows[0].payment_info, before[0].payment_info);

    assert.equal((await users.reader.post('/api/reports', { target_type: 'NOVEL', target_id: novelId, reason: 'e2e' })).status, 200);
    assert.equal((await users.reader.post('/api/reports', { target_type: 'NOVEL', target_id: novelId, reason: 'again' })).status, 400);
});
