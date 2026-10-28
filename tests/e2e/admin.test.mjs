// Admin dashboard APIs: pending counts, overview, users (filters, detail, ban/unban, coin adjustments), content
// (filters, stats, hide/ban), payment filters, transaction history and the admin audit log (lib/adminLog.ts).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, uuid } from './helpers.mjs';

let db, ids, emails, users;
const anon = new Client();
const c = {};
let countsBefore;

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, emails, clients: users } = await createUsers(db, { admin: 'ADMIN', reader: 'READER', author: 'AUTHOR', applicant: 'READER' }, { coins: 50 }));
    countsBefore = (await users.admin.get('/api/admin/counts')).json;

    const tag = uuid().slice(0, 8);
    Object.assign(c, { tag, novel: uuid(), hidden: uuid(), comic: uuid(), ch: uuid(), comment: uuid(), cat: uuid(), topup: uuid(), oldTopup: uuid(), wd: uuid() });
    await db.query(`INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)`, [c.cat, `E2E AD ${tag}`, `e2e-ad-${tag}`]);
    await db.query(`INSERT INTO novels (id, title, status, author_id, views) VALUES (?, ?, 'PUBLISHED', ?, 12), (?, ?, 'DRAFT', ?, 0)`,
        [c.novel, `E2E AD Novel ${tag}`, ids.author, c.hidden, `E2E AD Draft ${tag}`, ids.author]);
    await db.query(`INSERT INTO novel_categories (novel_id, category_id, sort_order) VALUES (?, ?, 0)`, [c.novel, c.cat]);
    await db.query(`INSERT INTO comics (id, title, status, author_id) VALUES (?, ?, 'PUBLISHED', ?)`, [c.comic, `E2E AD Comic ${tag}`, ids.author]);
    await db.query(`INSERT INTO chapters (id, title, content, chapter_order, novel_id, price) VALUES (?, 'AD1', 'x', 1, ?, 15)`, [c.ch, c.novel]);
    await db.query(`INSERT INTO purchases (id, user_id, chapter_id, item_title, author_id, price, author_earning) VALUES (?, ?, ?, 'AD1', ?, 15, 10.5)`,
        [uuid(), ids.reader, c.ch, ids.author]);
    await db.query(`INSERT INTO comments (id, user_id, novel_id, body) VALUES (?, ?, ?, 'author comment')`, [c.comment, ids.author, c.novel]);
    // Pending work: one of each
    await db.query(`INSERT INTO coin_topups (id, user_id, amount, slip_image, status) VALUES (?, ?, 100, '/x.png', 'PENDING'), (?, ?, 40, '/y.png', 'APPROVED')`,
        [c.topup, ids.reader, c.oldTopup, ids.reader]);
    await db.query(`UPDATE coin_topups SET created_at = NOW() - INTERVAL 10 DAY WHERE id = ?`, [c.oldTopup]);
    await db.query(`INSERT INTO withdrawals (id, user_id, amount, status) VALUES (?, ?, 100, 'PENDING')`, [c.wd, ids.author]);
    await db.query(`INSERT INTO writer_profiles (user_id, first_name, last_name, status) VALUES (?, 'A', 'P', 'PENDING')`, [ids.applicant]);
    await db.query(`INSERT INTO reports (id, reporter_id, target_id, target_type, reason, status) VALUES
        (?, ?, ?, 'NOVEL', 'bad novel', 'PENDING'), (?, ?, ?, 'COMMENT', 'rude comment', 'RESOLVED')`,
        [uuid(), ids.reader, c.novel, uuid(), ids.reader, c.comment]);
});

after(async () => {
    if (db) {
        await db.query('DELETE FROM writer_profiles WHERE user_id IN (?)', [Object.values(ids || {})]);
        await cleanupUsers(db, Object.values(ids || {}));
        await db.query('DELETE FROM categories WHERE id = ?', [c.cat]);
        await db.end();
    }
});

test('every admin endpoint is admin-only', async () => {
    const urls = ['/api/admin', '/api/admin/counts', '/api/admin/users', `/api/admin/users/${ids.reader}`, '/api/admin/content',
        '/api/admin/transactions', '/api/admin/logs'];
    for (const url of urls) {
        for (const client of [anon, users.reader, users.author]) {
            assert.ok([401, 403].includes((await client.get(url)).status), `${url} blocked`);
        }
    }
    assert.ok([401, 403].includes((await users.author.post(`/api/admin/users/${ids.reader}/coins`, { amount: 100, reason: 'x' })).status));
    const [rows] = await db.query('SELECT coins FROM users WHERE id = ?', [ids.reader]);
    assert.equal(rows[0].coins, 50);
});

test('pending counts drive the sidebar badges', async () => {
    const now = (await users.admin.get('/api/admin/counts')).json;
    // countsBefore was taken before the pending rows were inserted
    for (const key of ['topups', 'withdrawals', 'writers', 'reports']) {
        assert.equal(now[key] - countsBefore[key], 1, key);
    }
    assert.equal(now.moderation, 0, 'content check queue is a placeholder for now');
});

test('overview has the stat cards, top stories and recent activity', async () => {
    const o = (await users.admin.get('/api/admin')).json;
    for (const key of ['users', 'new_users_today', 'authors', 'stories', 'topup_month', 'platform_revenue', 'platform_revenue_month']) {
        assert.equal(typeof o[key], 'number', key);
    }
    assert.ok(o.new_users_today >= 4);
    assert.equal(o.stories, o.novels + o.comics);
    assert.ok(o.top_stories.length <= 5);
    for (let i = 1; i < o.top_stories.length; i++) assert.ok(o.top_stories[i - 1].views >= o.top_stories[i].views);
    assert.ok(o.activity.length > 0 && o.activity.length <= 10);
    assert.ok(o.activity.some((a) => a.kind === 'USER_REGISTER' || a.kind === 'TOPUP'));
});

test('user list filters by search, role and status, with coins and paging', async () => {
    const list = (q) => users.admin.get(`/api/admin/users?search=${encodeURIComponent(c.tag)}&${q}`).then((r) => r.json);
    // createUsers emails share one tag; search by that tag instead
    const tag = emails.reader.split('-').pop().split('@')[0];
    const all = (await users.admin.get(`/api/admin/users?search=${tag}`)).json;
    assert.equal(all.total, 4);
    assert.equal(all.pageSize, 20);
    const reader = all.users.find((u) => u.id === ids.reader);
    assert.equal(reader.coins, 50);
    assert.equal(reader.is_banned, false);
    assert.deepEqual((await users.admin.get(`/api/admin/users?search=${tag}&role=AUTHOR`)).json.users.map((u) => u.id), [ids.author]);
    assert.equal((await users.admin.get(`/api/admin/users?search=${tag}&status=banned`)).json.total, 0);
    assert.equal((await users.admin.get(`/api/admin/users?search=${tag}&page=2`)).json.users.length, 0);
    assert.equal((await list('')).total, 0, 'unrelated search finds nothing');
});

test('ban needs a reason, keeps the old role and unban restores it', async () => {
    const patch = (body) => users.admin.patch(`/api/admin/users/${ids.author}`, body);
    assert.equal((await patch({ action: 'ban' })).status, 400, 'reason required');
    assert.equal((await patch({ action: 'ban', reason: '   ' })).status, 400);
    assert.equal((await users.admin.patch(`/api/admin/users/${ids.admin}`, { action: 'ban', reason: 'x' })).status, 400, 'not yourself');
    assert.equal((await patch({ action: 'unban' })).status, 409, 'not banned yet');

    assert.equal((await patch({ action: 'ban', reason: 'สแปมลิงก์' })).status, 200);
    const [rows] = await db.query('SELECT role, role_before_ban, ban_reason, banned_at FROM users WHERE id = ?', [ids.author]);
    assert.equal(rows[0].role, 'BANNED');
    assert.equal(rows[0].role_before_ban, 'AUTHOR');
    assert.equal(rows[0].ban_reason, 'สแปมลิงก์');
    assert.ok(rows[0].banned_at);
    assert.equal(await new Client().login(emails.author), false, 'banned user cannot log in');

    const tag = emails.author.split('-').pop().split('@')[0];
    const banned = (await users.admin.get(`/api/admin/users?search=${tag}&status=banned&role=AUTHOR`)).json.users;
    assert.deepEqual(banned.map((u) => u.id), [ids.author], 'role filter uses the role before the ban');
    assert.equal(banned[0].ban_reason, 'สแปมลิงก์');

    const detail = (await users.admin.get(`/api/admin/users/${ids.author}`)).json;
    assert.equal(detail.user.base_role, 'AUTHOR');
    assert.equal(detail.user.role, 'BANNED');

    const res = await patch({ action: 'unban' });
    assert.equal(res.status, 200);
    assert.equal(res.json.role, 'AUTHOR');
    const [after] = await db.query('SELECT role, role_before_ban, ban_reason FROM users WHERE id = ?', [ids.author]);
    assert.deepEqual({ ...after[0] }, { role: 'AUTHOR', role_before_ban: null, ban_reason: null });
    assert.ok(await users.author.login(emails.author), 'can log in again');
});

test('role changes still accept { role } and are validated', async () => {
    assert.equal((await users.admin.patch(`/api/admin/users/${ids.applicant}`, { role: 'WRITER' })).status, 400);
    assert.equal((await users.admin.patch(`/api/admin/users/${ids.applicant}`, { action: 'nope' })).status, 400);
    assert.equal((await users.admin.patch(`/api/admin/users/${ids.applicant}`, { role: 'AUTHOR' })).status, 200);
    assert.equal((await users.admin.patch(`/api/admin/users/${ids.applicant}`, { role: 'READER' })).status, 200);
    assert.equal((await users.admin.patch(`/api/admin/users/${uuid()}`, { action: 'ban', reason: 'x' })).status, 404);
});

test('coin adjustments are validated, recorded and notified', async () => {
    const adjust = (body) => users.admin.post(`/api/admin/users/${ids.reader}/coins`, body);
    assert.equal((await adjust({ amount: 0, reason: 'x' })).status, 400);
    assert.equal((await adjust({ amount: 1.5, reason: 'x' })).status, 400);
    assert.equal((await adjust({ amount: '10', reason: 'x' })).status, 200, 'numeric strings are fine');
    assert.equal((await adjust({ amount: 100 })).status, 400, 'reason required');
    assert.equal((await adjust({ amount: 2_000_000, reason: 'x' })).status, 400);
    assert.equal((await adjust({ amount: -61, reason: 'too much' })).status, 400, 'cannot go below 0 (balance is 60)');
    assert.equal((await users.admin.post(`/api/admin/users/${uuid()}/coins`, { amount: 5, reason: 'x' })).status, 404);

    const add = await adjust({ amount: 100, reason: 'ชดเชยตอนเสีย' });
    assert.equal(add.status, 200);
    assert.equal(add.json.coins, 160);
    assert.equal((await adjust({ amount: -30, reason: 'คืนเกิน' })).json.coins, 130);
    const [rows] = await db.query('SELECT coins FROM users WHERE id = ?', [ids.reader]);
    assert.equal(rows[0].coins, 130);

    const detail = (await users.admin.get(`/api/admin/users/${ids.reader}`)).json;
    assert.deepEqual(detail.adjustments.map((a) => [a.amount, a.balance_after, a.reason]), [[-30, 130, 'คืนเกิน'], [100, 160, 'ชดเชยตอนเสีย'], [10, 60, 'x']]);
    assert.equal(detail.adjustments[0].admin_name, 'E2E admin');

    const notes = (await users.reader.get('/api/notifications?limit=20')).json.items.filter((n) => n.type === 'COINS_ADJUSTED');
    assert.equal(notes.length, 3);
    assert.match(notes[0].message, /หัก 30.*คืนเกิน/);
});

test('user detail has history, works and reports against the user', async () => {
    const reader = (await users.admin.get(`/api/admin/users/${ids.reader}`)).json;
    assert.equal(reader.user.email, emails.reader);
    assert.deepEqual(reader.topups.map((t) => t.status).sort(), ['APPROVED', 'PENDING']);
    assert.equal(reader.purchases.length, 1);
    assert.equal(reader.purchases[0].story_id, c.novel);
    assert.equal(reader.author_balance, null);
    assert.equal(reader.reports.length, 0);

    const author = (await users.admin.get(`/api/admin/users/${ids.author}`)).json;
    assert.deepEqual(author.works.map((w) => w.id).sort(), [c.novel, c.hidden, c.comic].sort());
    assert.equal(author.works.find((w) => w.id === c.novel).item_count, 1);
    assert.equal(author.author_balance.earned, 10.5);
    assert.deepEqual(author.reports.map((r) => r.target_type).sort(), ['COMMENT', 'NOVEL'], 'reports on their story and their comment');
    assert.ok(author.logs.some((l) => l.action === 'USER_BAN'), 'admin log entries about the user');
    assert.equal((await users.admin.get(`/api/admin/users/${uuid()}`)).status, 404);
});

test('content list filters by search, category and status and has per-story stats', async () => {
    const list = (q) => users.admin.get(`/api/admin/content?search=${c.tag}&${q}`).then((r) => r.json);
    const novels = await list('type=novels');
    assert.equal(novels.total, 2, 'every status is listed');
    const story = novels.items.find((s) => s.id === c.novel);
    assert.equal(story.item_count, 1);
    assert.equal(story.views, 12);
    assert.equal(story.sales, 1);
    assert.equal(story.revenue, 15);
    assert.equal(story.comments, 1);
    assert.equal(story.pending_reports, 1);
    assert.deepEqual(story.categories.map((x) => x.id), [c.cat]);

    assert.deepEqual((await list('type=novels&status=published')).items.map((s) => s.id), [c.novel]);
    assert.deepEqual((await list('type=novels&status=hidden')).items.map((s) => s.id), [c.hidden]);
    assert.equal((await list('type=novels&status=banned')).total, 0);
    assert.deepEqual((await list(`type=novels&categoryId=${c.cat}`)).items.map((s) => s.id), [c.novel]);
    assert.deepEqual((await list('type=comics')).items.map((s) => s.id), [c.comic]);
    const byAuthor = (await users.admin.get(`/api/admin/content?type=novels&search=${encodeURIComponent('E2E author')}`)).json;
    assert.ok(byAuthor.items.some((s) => s.id === c.novel), 'search matches the author name');
});

test('hiding and banning content need a reason and notify the author', async () => {
    const patch = (body) => users.admin.patch(`/api/admin/content/${c.comic}`, { type: 'comics', ...body });
    assert.equal((await patch({ status: 'BANNED' })).status, 400, 'reason required');
    assert.equal((await patch({ status: 'ARCHIVED', reason: '' })).status, 400);
    assert.equal((await patch({ status: 'GONE' })).status, 400);
    assert.equal((await users.admin.patch(`/api/admin/content/${uuid()}`, { type: 'comics', status: 'PUBLISHED' })).status, 404);

    assert.equal((await patch({ status: 'ARCHIVED', reason: 'ปกไม่เหมาะสม' })).status, 200);
    assert.equal((await patch({ status: 'BANNED', reason: 'ละเมิดลิขสิทธิ์' })).status, 200);
    const [rows] = await db.query('SELECT status FROM comics WHERE id = ?', [c.comic]);
    assert.equal(rows[0].status, 'BANNED');
    assert.equal((await users.admin.get(`/api/admin/content?type=comics&search=${c.tag}&status=banned`)).json.total, 1);

    const notes = (await users.author.get('/api/notifications?limit=20')).json.items.filter((n) => n.type === 'CONTENT_MODERATED');
    assert.equal(notes.length, 2);
    assert.match(notes[0].message, /ระงับ.*ละเมิดลิขสิทธิ์/);
    assert.match(notes[1].message, /ซ่อน.*ปกไม่เหมาะสม/);

    assert.equal((await patch({ status: 'PUBLISHED' })).status, 200, 'publishing back needs no reason');
});

test('top-up and withdrawal lists filter by status and date', async () => {
    const mine = (r) => r.json.filter((t) => t.user_id === ids.reader).map((t) => t.id);
    assert.deepEqual(mine(await users.admin.get('/api/admin/topups?status=PENDING')), [c.topup]);
    assert.deepEqual(mine(await users.admin.get('/api/admin/topups?status=APPROVED')), [c.oldTopup]);
    const today = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    assert.deepEqual(mine(await users.admin.get(`/api/admin/topups?from=${today}`)), [c.topup], 'the 10-day-old one is before `from`');
    assert.deepEqual(mine(await users.admin.get(`/api/admin/topups?from=${tomorrow()}`)), []);
    assert.equal(mine(await users.admin.get('/api/admin/topups?from=junk')).length, 2, 'bad dates are ignored');
    const wd = (await users.admin.get('/api/admin/withdrawals?status=PENDING')).json.filter((w) => w.user_id === ids.author);
    assert.deepEqual(wd.map((w) => w.id), [c.wd]);
    assert.equal((await users.admin.get('/api/admin/withdrawals?status=REJECTED')).json.filter((w) => w.user_id === ids.author).length, 0);
});

test('transaction history merges every kind of money movement', async () => {
    const tx = (q) => users.admin.get(`/api/admin/transactions?search=${encodeURIComponent('E2E reader')}&${q}`).then((r) => r.json);
    const all = await tx('');
    // Other test files' users are named "E2E reader" too, so only look at this file's rows
    const mine = all.items.filter((t) => t.user_id === ids.reader);
    const kinds = new Set(mine.map((t) => t.kind));
    for (const k of ['TOPUP', 'PURCHASE', 'ADJUSTMENT']) assert.ok(kinds.has(k), k);
    assert.ok(mine.some((t) => t.kind === 'ADJUSTMENT' && t.amount === -30), 'deductions are negative');
    for (let i = 1; i < all.items.length; i++) assert.ok(all.items[i - 1].created_at >= all.items[i].created_at, 'newest first');

    const adjustments = await tx('type=ADJUSTMENT');
    assert.ok(adjustments.items.every((t) => t.kind === 'ADJUSTMENT'));
    assert.deepEqual(Object.keys(adjustments.sums), ['ADJUSTMENT']);
    const pending = await tx('status=PENDING');
    assert.ok(pending.items.every((t) => t.status === 'PENDING'));
    assert.ok(pending.items.some((t) => t.id === c.topup));
    assert.equal((await tx(`from=${tomorrow()}`)).total, 0);
    const wd = (await users.admin.get('/api/admin/transactions?type=WITHDRAWAL&search=E2E%20author')).json.items;
    assert.ok(wd.some((t) => t.id === c.wd));
});

test('every admin action lands in the audit log', async () => {
    // Settings change (restored right after) and a report decision
    const [s] = await db.query('SELECT author_share_percent FROM system_settings WHERE id = "1"');
    assert.equal((await users.admin.post('/api/admin/settings', { author_share_percent: s[0].author_share_percent })).status, 200);
    const [r] = await db.query("SELECT id FROM reports WHERE target_id = ? AND status = 'PENDING'", [c.novel]);
    assert.equal((await users.admin.patch(`/api/admin/reports/${r[0].id}`, { status: 'IGNORED' })).status, 200);
    assert.equal((await users.admin.patch(`/api/admin/reports/${uuid()}`, { status: 'IGNORED' })).status, 404);
    // Top-up approval, writer approval
    assert.equal((await users.admin.patch(`/api/admin/topups/${c.topup}`, { status: 'APPROVED' })).status, 200);
    assert.equal((await users.admin.patch(`/api/admin/writers/${ids.applicant}`, { status: 'REJECTED', reason: 'ไม่ชัด' })).status, 200);
    // An admin deleting someone else's comment
    assert.equal((await users.admin.del(`/api/comments/${c.comment}`)).status, 200);

    const logs = (await users.admin.get(`/api/admin/logs?adminId=${ids.admin}`)).json;
    const actions = logs.logs.map((l) => l.action);
    for (const a of ['USER_BAN', 'USER_UNBAN', 'USER_ROLE', 'COINS_ADJUST', 'CONTENT_STATUS', 'SETTINGS_UPDATE', 'REPORT_STATUS', 'TOPUP_APPROVE', 'WRITER_REJECT', 'COMMENT_DELETE']) {
        assert.ok(actions.includes(a), a);
    }
    assert.ok(logs.logs.every((l) => l.admin_name === 'E2E admin'));
    for (let i = 1; i < logs.logs.length; i++) assert.ok(logs.logs[i - 1].created_at >= logs.logs[i].created_at, 'newest first');
    assert.ok(logs.admins.some((a) => a.id === ids.admin));

    const ban = logs.logs.find((l) => l.action === 'USER_BAN');
    assert.equal(ban.target_id, ids.author);
    assert.equal(ban.target_label, 'E2E author');
    assert.equal(ban.reason, 'สแปมลิงก์');
    const coins = (await users.admin.get(`/api/admin/logs?adminId=${ids.admin}&action=COINS_ADJUST`)).json;
    assert.equal(coins.total, 3);
    assert.ok(coins.logs.every((l) => l.action === 'COINS_ADJUST' && l.target_id === ids.reader));
    assert.match(coins.logs[0].detail, /-30 เหรียญ/);
    const about = (await users.admin.get(`/api/admin/logs?targetId=${c.comic}`)).json;
    assert.equal(about.total, 3, 'hide, ban, publish');
    assert.equal((await users.admin.get(`/api/admin/logs?adminId=${ids.admin}&from=${tomorrow()}`)).json.total, 0);
});

test('the admin page renders for admins', async () => {
    assert.equal((await users.admin.get('/admin?tab=users')).status, 200);
});

