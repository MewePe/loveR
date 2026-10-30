// Rich text chapters (lib/chapterContent.ts): HTML from the editor is sanitized when saved and again when shown, old
// plain-text chapters still work, and the content check only ever sees plain text.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, uuid, MOCK_HEADER } from './helpers.mjs';

let db, ids, users;
const anon = new Client();
const s = {};

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db, { author: 'AUTHOR', reader: 'READER', admin: 'ADMIN' }));
    s.novel = uuid();
    await db.query(`INSERT INTO novels (id, title, status, author_id, is_mature) VALUES (?, 'E2E RT Novel', 'PUBLISHED', ?, 0)`, [s.novel, ids.author]);
});

after(async () => {
    if (db) {
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

const create = (content, extra = { contentFormat: 'HTML' }, title = 'RT') =>
    users.author.post(`/api/novels/${s.novel}/chapters`, { title, content, price: 0, ...extra });
const edit = (id, content, extra = { contentFormat: 'HTML' }, title = 'RT') =>
    users.author.patch(`/api/novels/${s.novel}/chapters/${id}`, { title, content, price: 0, ...extra });
const row = async (id) => (await db.query('SELECT content, content_format, moderation_status FROM chapters WHERE id = ?', [id]))[0][0];
const checks = async (id) => (await db.query('SELECT analysis FROM moderation_checks WHERE chapter_id = ? ORDER BY created_at', [id]))[0];
// The part of the reader page between the chapter body's opening tag and the report button / bottom navigation
const bodyOf = (html) => html.slice(html.indexOf('chapter-rich'), html.indexOf('บทก่อนหน้า'));

test('allowed formatting survives saving and reaches the reader', async () => {
    const html = '<p data-align="center"><strong>หนา</strong> <em>เอียง</em> <u>ใต้</u> <s>ฆ่า</s></p>'
        + '<p data-indent="2"><span data-color="red">แดง</span> <mark data-highlight="green">ไฮไลต์</mark></p>'
        + '<hr><ol><li><p>หนึ่ง</p></li></ol><ul><li><p>จุด</p></li></ul>';
    const res = await create(html);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    s.rich = res.json.id;
    assert.equal((await row(s.rich)).content_format, 'HTML');

    const page = (await users.reader.get(`/read/${s.rich}`)).text;
    for (const part of ['<p data-align="center">', '<strong>หนา</strong>', '<em>เอียง</em>', '<u>ใต้</u>', '<s>ฆ่า</s>', '<p data-indent="2">',
        '<span data-color="red">แดง</span>', '<mark data-highlight="green">ไฮไลต์</mark>', '<hr', '<ol>', '<ul>']) {
        assert.ok(page.includes(part), part);
    }
    assert.ok(!page.includes('&lt;strong&gt;'), 'not shown as text');
});

test('scripts, handlers, styles and unknown values are removed before saving', async () => {
    const res = await create(`<p onclick="steal()" style="font-size:90px;font-family:Comic Sans" class="x" data-align="justify" data-indent="99">ข้อความ</p>
        <script>alert(1)</script><style>body{display:none}</style><iframe src="https://evil.test"></iframe>
        <img src=x onerror="fetch('/api/purchases')"><svg onload="alert(1)"></svg><h1>หัวข้อ</h1>
        <span data-color="white" style="color:#fff">ซ่อน</span><mark data-highlight="evil">จุด</mark>
        <a href="javascript:alert(1)">ลิงก์ร้าย</a><a href="/api/purchases">ลิงก์ภายใน</a><a href="//evil.test">ไม่ระบุ scheme</a>
        <a href="data:text/html,x">ข้อมูล</a><a href="https://example.com/x" onclick="x()" target="_self">ลิงก์ดี</a>`);
    assert.equal(res.status, 200);
    const { content } = await row(res.json.id);
    for (const bad of ['<script', 'alert(1)', '<style', 'display:none', '<iframe', '<img', 'onerror', '<svg', 'onload', 'onclick', 'style=', 'class=',
        'javascript:', 'data:text', 'font-size', '<h1', 'data-align', 'data-indent', 'data-color', 'data-highlight="evil"', '/api/purchases', 'evil.test', '_self']) {
        assert.ok(!content.includes(bad), bad);
    }
    for (const text of ['ข้อความ', 'หัวข้อ', 'ซ่อน', 'ลิงก์ร้าย', 'ลิงก์ดี']) assert.ok(content.includes(text), text);
    assert.ok(content.includes('<a href="https://example.com/x" target="_blank" rel="noopener noreferrer nofollow ugc">ลิงก์ดี</a>'));
});

test('HTML already in the database is sanitized again before it is shown', async () => {
    const id = uuid();
    const evil = '<p>ปลอดภัย</p><script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">x</a>';
    await db.query(`INSERT INTO chapters (id, title, content, content_format, chapter_order, novel_id, moderation_status)
        VALUES (?, 'RT evil', ?, 'HTML', 900, ?, 'APPROVED')`, [id, evil, s.novel]);

    const body = bodyOf((await users.reader.get(`/read/${id}`)).text);
    assert.ok(body.includes('<p>ปลอดภัย</p>'));
    for (const bad of ['alert(', 'onerror', '<img']) assert.ok(!body.includes(bad), bad);

    const api = (await users.reader.get(`/api/chapters?chapterId=${id}`)).json;
    assert.equal(api.content, '<p>ปลอดภัย</p><span>x</span>');
    assert.equal(api.content_format, 'HTML');
    const list = (await users.author.get(`/api/novels/${s.novel}/chapters`)).json;
    assert.equal(list.find((c) => c.id === id).content, '<p>ปลอดภัย</p><span>x</span>', 'the editor gets the clean version too');
});

test('content pasted from Word arrives clean', async () => {
    const word = `<!--[if gte mso 9]><xml><o:OfficeDocumentSettings></o:OfficeDocumentSettings></xml><![endif]-->
        <p class="MsoNormal" style="mso-margin-top-alt:auto;font-family:'TH Sarabun New'"><b style="mso-bidi-font-weight:normal"><span lang="TH" style="font-size:22.0pt;color:#FF0000">สวัสดี</span></b><o:p></o:p></p>`;
    const { content } = await row((await create(word)).json.id);
    assert.equal(content.trim(), '<p><strong><span>สวัสดี</span></strong></p>');
});

test('old plain-text chapters stay plain text', async () => {
    const id = uuid();
    const text = 'บรรทัดแรก\nมี <b>แท็ก</b> & เครื่องหมาย\n\nย่อหน้าใหม่';
    await db.query(`INSERT INTO chapters (id, title, content, chapter_order, novel_id, moderation_status) VALUES (?, 'RT old', ?, 901, ?, 'APPROVED')`, [id, text, s.novel]);
    assert.equal((await row(id)).content_format, 'PLAIN', 'default for existing rows');

    const page = (await users.reader.get(`/read/${id}`)).text;
    assert.ok(page.includes('whitespace-pre-line'));
    assert.ok(page.includes('&lt;b&gt;แท็ก&lt;/b&gt;'), 'tags in old text are text');
    assert.equal((await users.reader.get(`/api/chapters?chapterId=${id}`)).json.content, text, 'unchanged');

    // Clients that don't know about the editor keep working, in the chapter's format
    assert.equal((await edit(id, `${text} เพิ่ม`, {}, 'RT old')).status, 200);
    assert.deepEqual([(await row(id)).content_format, (await row(id)).content], ['PLAIN', `${text} เพิ่ม`]);
});

test('an invalid format is refused and never stored', async () => {
    assert.equal((await create('x', { contentFormat: 'MARKDOWN' })).status, 400);
    assert.equal((await edit(s.rich, 'x', { contentFormat: '' })).status, 400);
});

test('the content check gets plain text, including link addresses', async () => {
    users.author.extraHeaders[MOCK_HEADER] = 'echo';
    try {
        const res = await create('<p><strong>เรื่อง</strong> &amp; <span data-color="red">สี</span></p><script>ซ่อน()</script><ul><li><p>ข้อ</p></li></ul>'
            + '<p><a href="https://casino.example/x">คลิก</a></p>', undefined, 'RT check');
        assert.equal(res.status, 200);
        assert.equal(res.json.moderation.status, 'APPROVED', 'the system works as before');
        const [check] = await checks(res.json.id);
        const sent = JSON.parse(check.analysis).summary;
        assert.ok(sent.includes('เรื่อง & สี\nข้อ\n\nคลิก (https://casino.example/x)'), sent);
        assert.ok(!/<[a-z/]/i.test(sent), 'no HTML');
        assert.ok(!sent.includes('ซ่อน()'), 'what readers would never see is not there either');
    } finally {
        users.author.extraHeaders[MOCK_HEADER] = 'safe';
    }
});

test('formatting alone needs no new check; changed words or links do', async () => {
    const id = (await create('<p>ข้อความเดิม</p><p>บรรทัดสอง</p>', undefined, 'RT recheck')).json.id;
    const count = async () => (await checks(id)).length;
    assert.equal(await count(), 1);
    assert.equal((await edit(id, '<p><strong>ข้อความเดิม</strong></p><p data-align="center"><span data-color="blue">บรรทัดสอง</span></p>', undefined, 'RT recheck')).json.moderation, null);
    assert.equal(await count(), 1);
    assert.ok((await row(id)).content.includes('<strong>'), 'the formatting was still saved');
    assert.ok((await edit(id, '<p>ข้อความใหม่</p><p>บรรทัดสอง</p>', undefined, 'RT recheck')).json.moderation);
    assert.equal(await count(), 2);
    assert.ok((await edit(id, '<p><a href="https://x.example">ข้อความใหม่</a></p><p>บรรทัดสอง</p>', undefined, 'RT recheck')).json.moderation, 'a link address counts as a change');
    assert.equal(await count(), 3);

    // An old chapter opened in the editor and saved without touching the words
    const old = uuid();
    await db.query(`INSERT INTO chapters (id, title, content, chapter_order, novel_id, moderation_status) VALUES (?, 'RT plain', 'หนึ่ง\n\nสอง', 902, ?, 'APPROVED')`, [old, s.novel]);
    assert.equal((await edit(old, '<p>หนึ่ง</p><p>สอง</p>', undefined, 'RT plain')).json.moderation, null);
    assert.deepEqual([(await row(old)).content_format, (await row(old)).moderation_status], ['HTML', 'APPROVED']);
});

test('the admin queue shows text, not tags', async () => {
    users.author.extraHeaders[MOCK_HEADER] = 'mature';
    try {
        const id = (await create('<p><strong>ตัวอย่างในคิว</strong> ต่อ</p>', undefined, 'RT queue')).json.id;
        const { items } = (await users.admin.get('/api/admin/moderation?status=PENDING')).json;
        assert.equal(items.find((i) => i.chapter_id === id).excerpt, 'ตัวอย่างในคิว ต่อ');
    } finally {
        users.author.extraHeaders[MOCK_HEADER] = 'safe';
    }
});

test('locked chapters still give nothing away', async () => {
    const res = await users.author.post(`/api/novels/${s.novel}/chapters`, { title: 'RT paid', content: '<p>ความลับของตอนนี้</p>', contentFormat: 'HTML', price: 10 });
    const id = res.json.id;
    assert.ok(!(await users.reader.get(`/read/${id}`)).text.includes('ความลับของตอนนี้'));
    assert.equal((await anon.get(`/api/chapters?chapterId=${id}`)).json.content, null);
});
