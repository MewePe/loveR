// Notifications (lib/notifications.ts, /api/notifications*) for every event that creates one, plus comment replies.
// Admin notifications go to every ADMIN in the database; the ones caused by test users disappear with them
// (notifications.actor_id ON DELETE CASCADE), so real admins are left with nothing.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, form, png, uuid } from './helpers.mjs';

let db, ids, users;
const anon = new Client();
const c = {};

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db,
        { reader: 'READER', other: 'READER', applicant: 'READER', author: 'AUTHOR', admin: 'ADMIN' }, { coins: 1000 }));
    Object.assign(c, { novel: uuid(), draft: uuid(), comic: uuid(), paid: uuid() });
    await db.query(`INSERT INTO novels (id, title, status, author_id) VALUES (?, 'E2E NT Novel', 'PUBLISHED', ?), (?, 'E2E NT Draft', 'DRAFT', ?)`,
        [c.novel, ids.author, c.draft, ids.author]);
    await db.query(`INSERT INTO comics (id, title, status, author_id) VALUES (?, 'E2E NT Comic', 'PUBLISHED', ?)`, [c.comic, ids.author]);
    await db.query(`INSERT INTO chapters (id, title, content, chapter_order, novel_id, price) VALUES (?, 'NT Paid', 'secret', 1, ?, 30)`, [c.paid, c.novel]);
    await db.query(`INSERT INTO writer_profiles (user_id, first_name, last_name, bank_name, bank_account_number, bank_account_name, status)
        VALUES (?, 'E2E', 'Author', 'kbank', '1234567890', 'E2E Author', 'APPROVED')`, [ids.author]);
});

after(async () => {
    if (db) {
        await db.query('DELETE FROM writer_profiles WHERE user_id IN (?)', [Object.values(ids || {})]);
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

// Newest notifications of one type for a user, straight from the API
async function latest(client, type) {
    const res = await client.get('/api/notifications?limit=20');
    assert.equal(res.status, 200);
    return res.json.items.filter((n) => n.type === type);
}

test('notifications require login', async () => {
    assert.equal((await anon.get('/api/notifications')).status, 401);
    assert.equal((await anon.get('/api/notifications/count')).status, 401);
    assert.equal((await anon.post('/api/notifications/read-all')).status, 401);
});

test('bookmarkers hear about new chapters and episodes of published stories only', async () => {
    await users.reader.post('/api/bookmarks', { content_type: 'novel', content_id: c.novel });
    await users.reader.post('/api/bookmarks', { content_type: 'comic', content_id: c.comic });
    await db.query('INSERT INTO bookmarks (id, user_id, novel_id) VALUES (?, ?, ?)', [uuid(), ids.reader, c.draft]);

    const ch = await users.author.post(`/api/novels/${c.novel}/chapters`, { title: 'NT Chapter 2', content: 'x', price: 0 });
    assert.equal(ch.status, 200);
    const [n] = await latest(users.reader, 'NEW_CHAPTER');
    assert.match(n.message, /E2E NT Novel.*NT Chapter 2/);
    assert.equal(n.link, `/read/${ch.json.id}`);
    assert.equal(n.is_read, false);

    const ep = await users.author.post(`/api/comics/${c.comic}/episodes`, { title: 'NT Episode 1', price: 0 });
    assert.equal(ep.status, 200);
    assert.equal((await latest(users.reader, 'NEW_CHAPTER'))[0].link, `/comic/${c.comic}/read/${ep.json.id}`);

    assert.equal((await users.author.post(`/api/novels/${c.draft}/chapters`, { title: 'Draft chapter', content: 'x', price: 0 })).status, 200);
    assert.equal((await latest(users.reader, 'NEW_CHAPTER')).length, 2, 'nothing for a draft novel');
    assert.equal((await latest(users.other, 'NEW_CHAPTER')).length, 0, 'nothing without a bookmark');
    assert.equal((await latest(users.author, 'NEW_CHAPTER')).length, 0, 'not the author');
});

test('comment replies: one level deep, on the same story', async () => {
    const top = await users.reader.post('/api/comments', { content_type: 'novel', content_id: c.novel, body: 'first!' });
    assert.equal(top.status, 200);
    c.topComment = top.json.id;

    const reply = await users.other.post('/api/comments', { content_type: 'novel', content_id: c.novel, body: 'agreed', parent_id: c.topComment });
    assert.equal(reply.status, 200);
    assert.equal(reply.json.comment.body, 'agreed');

    assert.equal((await users.other.post('/api/comments', { content_type: 'novel', content_id: c.novel, body: 'deep', parent_id: reply.json.id })).status, 400,
        'cannot reply to a reply');
    assert.equal((await users.other.post('/api/comments', { content_type: 'comic', content_id: c.comic, body: 'x', parent_id: c.topComment })).status, 404,
        'parent must be on the same story');

    const list = (await anon.get(`/api/comments?content_type=novel&content_id=${c.novel}`)).json;
    assert.equal(list.total, 1, 'paging counts top-level comments');
    assert.equal(list.total_with_replies, 2);
    assert.equal(list.comments[0].replies.length, 1);
    assert.equal(list.comments[0].replies[0].body, 'agreed');
    assert.ok(!('user_id' in list.comments[0].replies[0]), 'no user ids leak');

    // Deleting the parent removes its replies
    const temp = await users.other.post('/api/comments', { content_type: 'comic', content_id: c.comic, body: 'temp' });
    await users.reader.post('/api/comments', { content_type: 'comic', content_id: c.comic, body: 'temp reply', parent_id: temp.json.id });
    assert.equal((await users.other.del(`/api/comments/${temp.json.id}`)).status, 200);
    assert.equal((await anon.get(`/api/comments?content_type=comic&content_id=${c.comic}`)).json.total_with_replies, 0);
});

test('comment notifications: replies to the commenter, everything to the author, never to yourself', async () => {
    const replies = await latest(users.reader, 'COMMENT_REPLY');
    assert.ok(replies.some((n) => /E2E other ตอบกลับความคิดเห็นของคุณ/.test(n.message) && n.link === `/novel/${c.novel}#comments`));

    const authorComments = await latest(users.author, 'NEW_COMMENT');
    assert.ok(authorComments.some((n) => n.message.includes('E2E reader') && n.message.includes('first!')));
    assert.ok(authorComments.some((n) => n.message.includes('E2E other') && n.message.includes('agreed')));

    // The author replying to a reader notifies the reader once, and not the author
    const before = (await latest(users.author, 'NEW_COMMENT')).length;
    await users.author.post('/api/comments', { content_type: 'novel', content_id: c.novel, body: 'thanks', parent_id: c.topComment });
    assert.ok((await latest(users.reader, 'COMMENT_REPLY')).some((n) => n.message.startsWith('E2E author')));
    assert.equal((await latest(users.author, 'NEW_COMMENT')).length, before);
    assert.ok(!(await latest(users.other, 'COMMENT_REPLY')).some((n) => n.message.startsWith('E2E author')),
        'other people who replied in the thread are not notified');
});

test('first rating notifies the author anonymously; changing it does not', async () => {
    assert.equal((await users.reader.req('PUT', '/api/ratings', { content_type: 'novel', content_id: c.novel, score: 4 })).status, 200);
    let ratings = await latest(users.author, 'NEW_RATING');
    assert.equal(ratings.length, 1);
    assert.match(ratings[0].message, /★★★★ /);
    assert.ok(!ratings[0].message.includes('E2E reader'), 'raters stay anonymous');

    await users.reader.req('PUT', '/api/ratings', { content_type: 'novel', content_id: c.novel, score: 5 });
    ratings = await latest(users.author, 'NEW_RATING');
    assert.equal(ratings.length, 1);
});

test('a sale notifies the author once', async () => {
    assert.equal((await users.reader.post('/api/purchases', { kind: 'chapter', id: c.paid })).status, 200);
    assert.equal((await users.reader.post('/api/purchases', { kind: 'chapter', id: c.paid })).status, 200, 'already owned');
    const sales = await latest(users.author, 'PURCHASE');
    assert.equal(sales.length, 1);
    assert.match(sales[0].message, /NT Paid.*30 เหรียญ/);
    assert.equal(sales[0].link, '/author?tab=earnings');
});

test('top-ups: admins hear about slips, the reader hears the decision', async () => {
    assert.equal((await users.other.post('/api/coins/topup', form({ amount: '200', slip: png() }))).status, 200);
    assert.equal((await users.other.post('/api/coins/topup', form({ amount: '300', slip: png() }))).status, 200);
    const slips = await latest(users.admin, 'ADMIN_TOPUP');
    assert.ok(slips.some((n) => n.message.includes('E2E other') && n.message.includes('200')));
    assert.equal(slips[0].link, '/admin?tab=payments');

    const [rows] = await db.query('SELECT id, amount FROM coin_topups WHERE user_id = ? ORDER BY amount', [ids.other]);
    await users.admin.patch(`/api/admin/topups/${rows[0].id}`, { status: 'APPROVED' });
    await users.admin.patch(`/api/admin/topups/${rows[1].id}`, { status: 'REJECTED', reason: 'blurry slip' });
    assert.match((await latest(users.other, 'TOPUP_APPROVED'))[0].message, /200 เหรียญ/);
    assert.match((await latest(users.other, 'TOPUP_REJECTED'))[0].message, /300 บาท.*blurry slip/);
});

test('writer applications: admins hear about them, the applicant hears the decision', async () => {
    const application = form({
        first_name: 'E2E', last_name: 'Applicant', id_card_number: '1234567890123', address: 'x', province: 'x',
        district: 'x', sub_district: 'x', postal_code: '10000', phone_number: '0800000000',
    });
    assert.equal((await users.applicant.post('/api/author/profile', application)).status, 200);
    const requests = await latest(users.admin, 'ADMIN_WRITER_REQUEST');
    assert.ok(requests.some((n) => n.message.includes('E2E applicant')));

    await users.admin.patch(`/api/admin/writers/${ids.applicant}`, { status: 'REJECTED', reason: 'unclear ID' });
    assert.match((await latest(users.applicant, 'WRITER_REJECTED'))[0].message, /unclear ID/);
    await users.admin.patch(`/api/admin/writers/${ids.applicant}`, { status: 'APPROVED' });
    assert.equal((await latest(users.applicant, 'WRITER_APPROVED'))[0].link, '/author');
});

test('withdrawals: admins hear about requests, the author hears the outcome', async () => {
    await db.query(`INSERT INTO purchases (id, user_id, chapter_id, item_title, author_id, price, author_earning) VALUES (?, ?, ?, 'NT seed', ?, 500, 500)`,
        [uuid(), ids.other, c.paid, ids.author]);
    assert.equal((await users.author.post('/api/author/withdrawals', { amount: 100 })).status, 200);
    assert.ok((await latest(users.admin, 'ADMIN_WITHDRAWAL')).some((n) => n.message.includes('E2E author') && n.message.includes('100.00')));

    const [first] = await db.query('SELECT id FROM withdrawals WHERE user_id = ? AND status = "PENDING"', [ids.author]);
    await users.admin.patch(`/api/admin/withdrawals/${first[0].id}`, { status: 'REJECTED', reason: 'wrong account' });
    assert.match((await latest(users.author, 'WITHDRAWAL_REJECTED'))[0].message, /100\.00.*wrong account/);

    await users.author.post('/api/author/withdrawals', { amount: 120 });
    const [second] = await db.query('SELECT id FROM withdrawals WHERE user_id = ? AND status = "PENDING"', [ids.author]);
    assert.equal((await users.admin.patch(`/api/admin/withdrawals/${second[0].id}`, form({ status: 'APPROVED', slip: png() }))).status, 200);
    const [paid] = await latest(users.author, 'WITHDRAWAL_APPROVED');
    assert.match(paid.message, /120\.00/);
    assert.equal(paid.link, '/author?tab=wallet');
});

test('reports notify admins', async () => {
    assert.equal((await users.reader.post('/api/reports', { target_type: 'NOVEL', target_id: c.novel, reason: 'e2e spam report' })).status, 200);
    const [n] = await latest(users.admin, 'ADMIN_REPORT');
    assert.match(n.message, /นิยาย.*e2e spam report/);
    assert.equal(n.link, '/admin?tab=reports');
});

test('unread count, mark one read (own only), mark all read', async () => {
    const count = (await users.reader.get('/api/notifications/count')).json.unread;
    assert.ok(count >= 4);
    const list = (await users.reader.get('/api/notifications')).json;
    assert.equal(list.unread, count);
    assert.ok(list.items.every((n, i, all) => i === 0 || new Date(all[i - 1].created_at) >= new Date(n.created_at)), 'newest first');

    const target = list.items.find((n) => !n.is_read);
    assert.equal((await users.other.patch(`/api/notifications/${target.id}`)).status, 404, "can't touch someone else's");
    assert.equal((await users.reader.patch(`/api/notifications/${target.id}`)).status, 200);
    assert.equal((await users.reader.get('/api/notifications/count')).json.unread, count - 1);

    assert.equal((await users.reader.post('/api/notifications/read-all')).status, 200);
    assert.equal((await users.reader.get('/api/notifications/count')).json.unread, 0);
    assert.ok((await users.other.get('/api/notifications/count')).json.unread > 0, "other users' notifications untouched");
});

test('admin notifications caused by a deleted user go away with them', async () => {
    const temp = await createUsers(db, { temp: 'READER' });
    await temp.clients.temp.post('/api/reports', { target_type: 'NOVEL', target_id: c.novel, reason: 'e2e temp report' });
    const hasTempReport = async () => (await latest(users.admin, 'ADMIN_REPORT')).some((n) => n.message.includes('e2e temp report'));
    assert.ok(await hasTempReport());
    await cleanupUsers(db, [temp.ids.temp]);
    assert.ok(!(await hasTempReport()));
});

test('the notifications page loads', async () => {
    assert.equal((await users.reader.get('/notifications')).status, 200);
});
