// Content check by API (lib/moderation.ts): the author labels a story ทั่วไป or 18+, every new/edited chapter or
// episode is checked against it, and the admin queue decides what the check couldn't. The API result is faked with
// the x-moderation-mock header (MOCK_HEADER), so no real Gemini call and no real unsafe content is needed.
// moderation-gemini.test.mjs calls the real API with harmless text.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, form, png, sleep, uuid, MOCK_HEADER } from './helpers.mjs';

let db, ids, users;
const anon = new Client();
const s = {};

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db, { author: 'AUTHOR', trusted: 'AUTHOR', reader: 'READER', admin: 'ADMIN' }));
    Object.assign(s, { general: uuid(), mature: uuid(), relabel: uuid(), comic: uuid(), trustedNovel: uuid() });
    await db.query(`INSERT INTO novels (id, title, status, author_id, is_mature) VALUES
        (?, 'E2E MD General', 'PUBLISHED', ?, 0), (?, 'E2E MD Mature', 'PUBLISHED', ?, 1),
        (?, 'E2E MD Relabel', 'PUBLISHED', ?, 0), (?, 'E2E MD Trusted', 'PUBLISHED', ?, 0)`,
    [s.general, ids.author, s.mature, ids.author, s.relabel, ids.author, s.trustedNovel, ids.trusted]);
    await db.query(`INSERT INTO comics (id, title, status, author_id, is_mature) VALUES (?, 'E2E MD Comic', 'PUBLISHED', ?, 0)`, [s.comic, ids.author]);
    await db.query('INSERT INTO bookmarks (id, user_id, novel_id) VALUES (?, ?, ?)', [uuid(), ids.reader, s.general]);
});

after(async () => {
    if (db) {
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

// Call with the API result faked as `mock`
async function as(client, mock, fn) {
    client.extraHeaders[MOCK_HEADER] = mock;
    try { return await fn(); } finally { client.extraHeaders[MOCK_HEADER] = 'safe'; }
}
const postChapter = (novelId, mock, title = `MD ${mock}`, client = users.author) =>
    as(client, mock, () => client.post(`/api/novels/${novelId}/chapters`, { title, content: `เนื้อหาทดสอบ ${title}`, price: 0 }));

const itemStatus = async (table, id) => (await db.query(`SELECT moderation_status FROM ${table} WHERE id = ?`, [id]))[0][0].moderation_status;
const checksOf = async (column, id) => (await db.query(`SELECT * FROM moderation_checks WHERE ${column} = ? ORDER BY created_at`, [id]))[0];
const notes = async (userId, type) => (await db.query('SELECT message, link FROM notifications WHERE user_id = ? AND type = ? ORDER BY created_at', [userId, type]))[0];

// Background checks run after the response; wait for them to finish
async function settled(column, id) {
    for (let i = 0; i < 50; i++) {
        const rows = await checksOf(column, id);
        if (rows.length > 0 && rows.every((r) => r.status !== 'CHECKING')) return rows;
        await sleep(200);
    }
    throw new Error(`moderation check of ${id} did not finish`);
}

test('creating a story requires choosing ทั่วไป or 18+', async () => {
    const missing = await users.author.post('/api/novels', { title: 'E2E MD no level', description: 'x' });
    assert.equal(missing.status, 400);
    assert.match(missing.json.error, /ระดับเนื้อหา/);
    assert.equal((await users.author.post('/api/comics', { title: 'E2E MD bad level', isMature: 'yes' })).status, 400);
    const ok = await users.author.post('/api/novels', { title: 'E2E MD level ok', description: 'x', isMature: false });
    assert.equal(ok.status, 200);
});

test('a chapter that matches its label is published automatically', async () => {
    const res = await postChapter(s.general, 'safe', 'MD safe');
    assert.equal(res.status, 200);
    assert.equal(res.json.moderation.status, 'APPROVED');
    assert.equal(res.json.moderation.background, false);
    s.safeCh = res.json.id;
    const [check] = await checksOf('chapter_id', s.safeCh);
    assert.equal(check.verdict, 'SAFE');
    assert.equal(check.status, 'CLEARED');
    assert.equal(check.source, 'SUBMIT');
    const page = await anon.get(`/read/${s.safeCh}`);
    assert.equal(page.status, 200);
    assert.ok(page.text.includes('เนื้อหาทดสอบ MD safe'));
    assert.equal((await notes(ids.reader, 'NEW_CHAPTER')).length, 1, 'bookmarker hears about the published chapter');
});

test('18+ content in a story labelled ทั่วไป waits for an admin and is hidden from readers', async () => {
    const res = await postChapter(s.general, 'mature', 'MD held');
    assert.equal(res.json.moderation.status, 'PENDING');
    assert.match(res.json.moderation.message, /18\+/);
    s.heldCh = res.json.id;
    assert.equal(await itemStatus('chapters', s.heldCh), 'PENDING');
    const [check] = await checksOf('chapter_id', s.heldCh);
    assert.equal(check.verdict, 'MATURE');
    assert.equal(check.status, 'PENDING');

    // Readers: 404 everywhere, left out of lists, no notification yet
    assert.equal((await users.reader.get(`/read/${s.heldCh}`)).status, 404);
    assert.equal((await users.reader.get(`/api/chapters?chapterId=${s.heldCh}`)).status, 404);
    assert.ok(!(await users.reader.get(`/api/novels/${s.general}/chapters`)).json.some((c) => c.id === s.heldCh));
    assert.ok(!(await users.reader.get(`/api/chapters?novelId=${s.general}`)).json.some((c) => c.id === s.heldCh));
    assert.ok(!(await users.reader.get(`/novel/${s.general}`)).text.includes('MD held'));
    assert.ok(!(await users.reader.get(`/read/${s.safeCh}`)).text.includes(s.heldCh), 'not in the episode picker or prev/next');
    assert.equal((await users.reader.post('/api/purchases', { kind: 'chapter', id: s.heldCh })).status, 404);
    assert.equal((await notes(ids.reader, 'NEW_CHAPTER')).length, 1);

    // The author still sees it, with its status
    const own = await users.author.get(`/read/${s.heldCh}`);
    assert.equal(own.status, 200);
    assert.ok(own.text.includes('รอแอดมินตรวจ'));
    const list = (await users.author.get(`/api/novels/${s.general}/chapters`)).json;
    assert.equal(list.find((c) => c.id === s.heldCh).moderation_status, 'PENDING');

    // The admin queue has it, with the analysis in Thai; admins were notified
    const counts = (await users.admin.get('/api/admin/counts')).json;
    assert.ok(counts.moderation >= 1);
    const queue = (await users.admin.get('/api/admin/moderation?status=PENDING')).json;
    const item = queue.items.find((i) => i.chapter_id === s.heldCh);
    assert.ok(item, 'in the queue');
    assert.equal(item.verdict, 'MATURE');
    assert.equal(item.declared_mature, false);
    assert.match(item.analysis.summary, /เนื้อหา 18\+/);
    assert.equal(item.item_title, 'MD held');
    assert.ok((await notes(ids.admin, 'ADMIN_MODERATION')).some((n) => n.message.includes('MD held')));
    assert.equal((await users.reader.get('/api/admin/moderation')).status, 403);
});

test('18+ content in an 18+ story is published', async () => {
    const res = await postChapter(s.mature, 'mature');
    assert.equal(res.json.moderation.status, 'APPROVED');
    assert.equal((await checksOf('chapter_id', res.json.id))[0].status, 'CLEARED');
});

test('explicit and illegal content is blocked even in an 18+ story', async () => {
    for (const mock of ['explicit', 'illegal']) {
        const res = await postChapter(s.mature, mock);
        assert.equal(res.json.moderation.status, 'BLOCKED', mock);
        assert.equal(await itemStatus('chapters', res.json.id), 'BLOCKED');
        assert.equal((await users.reader.get(`/read/${res.json.id}`)).status, 404);
        if (mock === 'explicit') s.explicitCh = res.json.id;
    }
});

test('sexual content involving characters who look like children is blocked whatever the label', async () => {
    for (const novel of [s.general, s.mature]) {
        const res = await postChapter(novel, 'minor');
        assert.equal(res.json.moderation.status, 'BLOCKED');
        assert.equal((await checksOf('chapter_id', res.json.id))[0].verdict, 'MINOR');
    }
});

test('when the API is down the chapter waits for an admin', async () => {
    const res = await postChapter(s.general, 'error', 'MD api down');
    assert.equal(res.status, 200, 'saving still works');
    assert.equal(res.json.moderation.status, 'PENDING');
    assert.match(res.json.moderation.message, /ขัดข้อง/);
    const [check] = await checksOf('chapter_id', res.json.id);
    assert.equal(check.verdict, 'ERROR');
    assert.equal(check.status, 'PENDING');
    assert.match(JSON.parse(check.analysis).summary, /API/);
    assert.equal((await users.reader.get(`/read/${res.json.id}`)).status, 404);
    s.errorCh = res.json.id;

    // Gemini's own filter refusing to answer (it also does that to harmless text) waits for an admin too
    const refused = await postChapter(s.general, 'refused');
    assert.equal(refused.json.moderation.status, 'PENDING');
    assert.equal((await checksOf('chapter_id', refused.json.id))[0].verdict, 'REFUSED');
});

test('comic pages are checked and the problem pages are reported to the admin', async () => {
    const urls = [];
    for (let i = 0; i < 3; i++) urls.push((await users.author.post('/api/upload', form({ file: png(), purpose: 'comic-page' }))).json.url);
    const res = await as(users.author, 'explicit:2', () => users.author.post(`/api/comics/${s.comic}/episodes`, { title: 'MD comic', price: 0, pages: urls }));
    assert.equal(res.status, 200);
    assert.equal(res.json.moderation.status, 'BLOCKED');
    s.blockedEp = res.json.id;
    assert.equal((await users.reader.get(`/comic/${s.comic}/read/${s.blockedEp}`)).status, 404);
    assert.equal((await users.reader.get(`/api/comics/${s.comic}/episodes/${s.blockedEp}/pages`)).status, 404);
    assert.equal((await anon.get(urls[1])).status, 404, 'page images of a blocked episode are not served');
    assert.ok(!(await users.reader.get(`/api/comics/${s.comic}/episodes`)).json.some((e) => e.id === s.blockedEp));

    const item = (await users.admin.get('/api/admin/moderation?status=PENDING')).json.items.find((i) => i.episode_id === s.blockedEp);
    assert.ok(item);
    assert.deepEqual(item.pages.map((p) => p.number), [1, 2, 3]);
    assert.deepEqual(item.analysis.issues.map((i) => i.page), [2]);
    assert.equal((await users.admin.get(item.pages[1].url)).status, 200, 'admin can open the page image');

    // Adding pages to a published episode checks them again
    const ok = await users.author.post(`/api/comics/${s.comic}/episodes`, { title: 'MD comic ok', price: 0, pages: [] });
    assert.equal(ok.json.moderation.status, 'APPROVED');
    const more = (await users.author.post('/api/upload', form({ file: png(), purpose: 'comic-page' }))).json.url;
    const added = await as(users.author, 'mature:1', () => users.author.post(`/api/comics/${s.comic}/episodes/${ok.json.id}/pages`, { imageUrls: [more] }));
    assert.equal(added.json.moderation.status, 'PENDING');
    assert.equal(await itemStatus('comic_episodes', ok.json.id), 'PENDING');
    // Only a price change is not checked again
    const price = await users.author.patch(`/api/comics/${s.comic}/episodes/${ok.json.id}`, { price: 5 });
    assert.equal(price.json.moderation, null);
});

test('admin approves: the chapter is published, the author and bookmarkers are notified, and it is logged', async () => {
    const item = (await users.admin.get('/api/admin/moderation')).json.items.find((i) => i.chapter_id === s.heldCh);
    assert.equal((await users.admin.patch(`/api/admin/moderation/${item.id}`, { action: 'nope' })).status, 400);
    assert.equal((await users.reader.patch(`/api/admin/moderation/${item.id}`, { action: 'approve' })).status, 403);
    const res = await users.admin.patch(`/api/admin/moderation/${item.id}`, { action: 'approve' });
    assert.equal(res.status, 200);
    assert.equal(await itemStatus('chapters', s.heldCh), 'APPROVED');
    assert.equal((await users.reader.get(`/read/${s.heldCh}`)).status, 200);
    assert.ok((await notes(ids.author, 'MODERATION_APPROVED')).some((n) => n.message.includes('MD held')));
    assert.ok((await notes(ids.reader, 'NEW_CHAPTER')).some((n) => n.link === `/read/${s.heldCh}`));
    const [logs] = await db.query("SELECT * FROM admin_logs WHERE admin_id = ? AND action = 'MODERATION_APPROVE'", [ids.admin]);
    assert.equal(logs.length, 1);
    assert.equal((await users.admin.patch(`/api/admin/moderation/${item.id}`, { action: 'approve' })).status, 409, 'only once');
    assert.ok(!(await users.admin.get('/api/admin/moderation')).json.items.some((i) => i.id === item.id), 'left the queue');
    assert.ok((await users.admin.get('/api/admin/moderation?status=APPROVED')).json.items.some((i) => i.id === item.id));
});

test('approving a severe result needs a reason', async () => {
    const item = (await users.admin.get('/api/admin/moderation')).json.items.find((i) => i.chapter_id === s.explicitCh);
    const res = await users.admin.patch(`/api/admin/moderation/${item.id}`, { action: 'approve' });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /เหตุผล/);
    assert.equal(await itemStatus('chapters', s.explicitCh), 'BLOCKED');
});

test('admin rejects with a reason; editing the chapter sends it back for a check', async () => {
    const item = (await users.admin.get('/api/admin/moderation')).json.items.find((i) => i.chapter_id === s.errorCh);
    assert.equal((await users.admin.patch(`/api/admin/moderation/${item.id}`, { action: 'reject' })).status, 400, 'reason required');
    assert.equal((await users.admin.patch(`/api/admin/moderation/${item.id}`, { action: 'reject', reason: 'มีคำหยาบรุนแรงหลายจุด' })).status, 200);
    assert.equal(await itemStatus('chapters', s.errorCh), 'REJECTED');
    assert.ok((await notes(ids.author, 'MODERATION_REJECTED')).some((n) => n.message.includes('มีคำหยาบรุนแรงหลายจุด')));
    const own = (await users.author.get(`/api/novels/${s.general}/chapters`)).json.find((c) => c.id === s.errorCh);
    assert.equal(own.moderation_note, 'มีคำหยาบรุนแรงหลายจุด');

    // Price-only edits keep it as it is; a text edit is checked again
    const samePatch = { title: 'MD api down', content: 'เนื้อหาทดสอบ MD api down', price: 3 };
    assert.equal((await users.author.patch(`/api/novels/${s.general}/chapters/${s.errorCh}`, samePatch)).json.moderation, null);
    assert.equal(await itemStatus('chapters', s.errorCh), 'REJECTED');
    const fixed = await users.author.patch(`/api/novels/${s.general}/chapters/${s.errorCh}`, { ...samePatch, content: 'แก้ไขแล้ว' });
    assert.equal(fixed.json.moderation.status, 'APPROVED');
    const checks = await checksOf('chapter_id', s.errorCh);
    assert.deepEqual(checks.map((c) => [c.source, c.status]), [['SUBMIT', 'REJECTED'], ['EDIT', 'CLEARED']]);
});

test('admin can relabel the story 18+ and approve; the author then cannot switch it back', async () => {
    const res = await postChapter(s.relabel, 'mature');
    assert.equal(res.json.moderation.status, 'PENDING');
    const item = (await users.admin.get('/api/admin/moderation')).json.items.find((i) => i.chapter_id === res.json.id);
    assert.equal(item.story_mature, false);
    assert.equal((await users.admin.patch(`/api/admin/moderation/${item.id}`, { action: 'mark_mature' })).status, 200);
    assert.equal(await itemStatus('chapters', res.json.id), 'APPROVED');
    assert.equal((await db.query('SELECT is_mature FROM novels WHERE id = ?', [s.relabel]))[0][0].is_mature, 1);
    assert.ok((await notes(ids.author, 'MODERATION_APPROVED')).some((n) => n.message.includes('18+')));
    const back = await users.author.patch(`/api/novels/${s.relabel}`, { isMature: false });
    assert.equal(back.status, 400);
    assert.match(back.json.error, /18\+/);
});

test('an author with 10 clean chapters publishes at once and the check runs in the background', async () => {
    // 10 chapters that already passed the check automatically
    for (let i = 1; i <= 10; i++) {
        const ch = uuid();
        await db.query(`INSERT INTO chapters (id, title, content, chapter_order, novel_id, price) VALUES (?, ?, 'x', ?, ?, 0)`, [ch, `Old ${i}`, i, s.trustedNovel]);
        await db.query(`INSERT INTO moderation_checks (id, item_type, chapter_id, story_id, author_id, source, verdict, status)
            VALUES (?, 'chapter', ?, ?, ?, 'SUBMIT', 'SAFE', 'CLEARED')`, [uuid(), ch, s.trustedNovel, ids.trusted]);
    }

    const safe = await postChapter(s.trustedNovel, 'safe', 'TR safe', users.trusted);
    assert.equal(safe.json.moderation.status, 'APPROVED');
    assert.equal(safe.json.moderation.background, true);
    assert.equal((await settled('chapter_id', safe.json.id))[0].status, 'CLEARED');

    // API down in the background: stays up, an admin looks at it
    const down = await postChapter(s.trustedNovel, 'error', 'TR down', users.trusted);
    assert.equal(down.json.moderation.status, 'APPROVED');
    assert.equal((await settled('chapter_id', down.json.id))[0].status, 'PENDING');
    assert.equal(await itemStatus('chapters', down.json.id), 'APPROVED');

    // Wrong label found in the background: hidden again, the author is told
    const held = await postChapter(s.trustedNovel, 'mature', 'TR mature', users.trusted);
    assert.equal(held.json.moderation.status, 'APPROVED', 'published straight away');
    assert.equal((await settled('chapter_id', held.json.id))[0].status, 'PENDING');
    assert.equal(await itemStatus('chapters', held.json.id), 'PENDING');
    assert.equal((await anon.get(`/read/${held.json.id}`)).status, 404);
    assert.ok((await notes(ids.trusted, 'MODERATION_HELD')).some((n) => n.message.includes('TR mature')));

    // That was a problem, so the author is no longer trusted
    const next = await postChapter(s.trustedNovel, 'minor', 'TR minor', users.trusted);
    assert.equal(next.json.moderation.background, false);
    assert.equal(next.json.moderation.status, 'BLOCKED');
});

test('sexual content involving minors is blocked in the background for trusted authors too', async () => {
    const novel = uuid(), author = ids.trusted;
    await db.query(`INSERT INTO novels (id, title, status, author_id, is_mature) VALUES (?, 'E2E MD Trusted 18', 'PUBLISHED', ?, 1)`, [novel, author]);
    // Make the author trusted again: clear the problems from the previous test
    await db.query("UPDATE moderation_checks SET status = 'APPROVED' WHERE author_id = ? AND status = 'PENDING'", [author]);
    await db.query("DELETE FROM moderation_checks WHERE author_id = ? AND verdict = 'MINOR'", [author]);
    const res = await postChapter(novel, 'minor', 'TR minor 18', users.trusted);
    assert.equal(res.json.moderation.background, true);
    await settled('chapter_id', res.json.id);
    assert.equal(await itemStatus('chapters', res.json.id), 'BLOCKED');
});

test('readers can report a wrong label: the chapter goes back to the admin queue', async () => {
    const reader = users.reader;
    assert.equal((await anon.post('/api/moderation/report', { item_type: 'chapter', item_id: s.safeCh })).status, 401);
    assert.equal((await reader.post('/api/moderation/report', { item_type: 'nope', item_id: s.safeCh })).status, 400);
    assert.equal((await reader.post('/api/moderation/report', { item_type: 'chapter', item_id: s.explicitCh })).status, 404, 'hidden chapters cannot be reported');
    assert.equal((await users.author.post('/api/moderation/report', { item_type: 'chapter', item_id: s.safeCh })).status, 400, 'not your own');

    const res = await reader.post('/api/moderation/report', { item_type: 'chapter', item_id: s.safeCh });
    assert.equal(res.status, 200);
    assert.equal(res.json.queued, true);
    const report = (await settled('chapter_id', s.safeCh)).find((c) => c.source === 'READER_REPORT');
    assert.equal(report.status, 'PENDING', 'reports always reach an admin');
    assert.equal(report.reporter_id, ids.reader);
    assert.equal(await itemStatus('chapters', s.safeCh), 'APPROVED', 'still readable while an admin looks');
    assert.equal((await reader.post('/api/moderation/report', { item_type: 'chapter', item_id: s.safeCh })).json.queued, false, 'already queued');
    const item = (await users.admin.get('/api/admin/moderation')).json.items.find((i) => i.id === report.id);
    assert.equal(item.reporter_name, 'E2E reader');

    // The re-check finds 18+ content in a story labelled ทั่วไป: hidden until an admin decides
    const other = (await postChapter(s.general, 'safe', 'MD reported')).json.id;
    const res2 = await as(reader, 'mature', () => reader.post('/api/moderation/report', { item_type: 'chapter', item_id: other }));
    assert.equal(res2.json.queued, true);
    await settled('chapter_id', other);
    assert.equal(await itemStatus('chapters', other), 'PENDING');

    // The reader page has the button for readers, not for the author
    assert.ok((await reader.get(`/read/${s.safeCh}`)).text.includes('รายงานว่าติดป้ายผิด'));
    assert.ok(!(await users.author.get(`/read/${s.safeCh}`)).text.includes('รายงานว่าติดป้ายผิด'));
});
