// 18+ age gate (lib/ageGate.ts, POST /api/age-verification): 18+ stories and their chapters/episodes ask for a birth
// date (Buddhist-era year) before anything is shown, checked on the server so direct URLs and APIs are covered too.
// A pass is remembered in the account (users.birth_date) for logged-in readers and in a cookie for everyone.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, form, png, uuid } from './helpers.mjs';

let db, ids, users;
const s = {};
const GATE = 'data-testid="age-gate"';
const now = new Date();
const BE = 543;
// Birth date `years` years before today (+ `dayShift` days), as the API body (BE year)
function birth(years, dayShift = 0) {
    const d = new Date(now.getFullYear() - years, now.getMonth(), now.getDate() + dayShift);
    return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() + BE };
}

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db, { author: 'AUTHOR', reader: 'READER', admin: 'ADMIN' }));
    Object.assign(s, { novel: uuid(), general: uuid(), comic: uuid(), ch: uuid(), generalCh: uuid() });
    await db.query(`INSERT INTO novels (id, title, status, author_id, is_mature) VALUES
        (?, 'E2E AG Mature', 'PUBLISHED', ?, 1), (?, 'E2E AG General', 'PUBLISHED', ?, 0)`, [s.novel, ids.author, s.general, ids.author]);
    await db.query(`INSERT INTO chapters (id, title, content, chapter_order, novel_id, price) VALUES
        (?, 'AG chapter', 'AG-SECRET-TEXT', 1, ?, 0), (?, 'AG general chapter', 'AG-GENERAL-TEXT', 1, ?, 0)`, [s.ch, s.novel, s.generalCh, s.general]);
    await db.query(`INSERT INTO comics (id, title, status, author_id, is_mature) VALUES (?, 'E2E AG Comic', 'PUBLISHED', ?, 1)`, [s.comic, ids.author]);
    s.pageUrl = (await users.author.post('/api/upload', form({ file: png(), purpose: 'comic-page' }))).json.url;
    s.ep = (await users.author.post(`/api/comics/${s.comic}/episodes`, { title: 'AG episode', price: 0, pages: [s.pageUrl] })).json.id;
});

after(async () => {
    if (db) {
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

test('18+ stories and chapters show the age check instead of the content', async () => {
    const anon = new Client();
    const story = await anon.get(`/novel/${s.novel}`);
    assert.equal(story.status, 200);
    assert.ok(story.text.includes(GATE));
    assert.ok(story.text.includes('ปี พ.ศ.'));
    assert.ok(!story.text.includes('AG chapter'), 'chapter list hidden');

    const read = await anon.get(`/read/${s.ch}`);
    assert.ok(read.text.includes(GATE));
    assert.ok(!read.text.includes('AG-SECRET-TEXT'));
    assert.ok((await anon.get(`/comic/${s.comic}/read/${s.ep}`)).text.includes(GATE));
    assert.ok((await anon.get(`/comic/${s.comic}`)).text.includes(GATE));

    // Direct API/file access is checked on the server too
    const api = await anon.get(`/api/chapters?chapterId=${s.ch}`);
    assert.equal(api.status, 403);
    assert.equal(api.json.age_required, true);
    assert.equal((await anon.get(`/api/comics/${s.comic}/episodes/${s.ep}`)).status, 403);
    assert.equal((await anon.get(`/api/comics/${s.comic}/episodes/${s.ep}/pages`)).status, 403);
    assert.equal((await anon.get(s.pageUrl)).status, 404, 'page image');

    // Not viewed until passed
    assert.equal((await db.query('SELECT views FROM chapters WHERE id = ?', [s.ch]))[0][0].views, 0);
});

test('ทั่วไป stories have no age check and no 18+ badge', async () => {
    const anon = new Client();
    const story = await anon.get(`/novel/${s.general}`);
    assert.ok(!story.text.includes(GATE));
    assert.ok(!story.text.includes('เนื้อหาสำหรับผู้มีอายุ 18 ปีขึ้นไป'));
    assert.ok((await anon.get(`/read/${s.generalCh}`)).text.includes('AG-GENERAL-TEXT'));
});

test('invalid birth dates are rejected', async () => {
    const anon = new Client();
    for (const body of [{}, { day: 31, month: 2, year: 2540 }, { day: 1, month: 13, year: 2540 }, birth(-1), { day: 1, month: 1, year: 1990 }]) {
        assert.equal((await anon.post('/api/age-verification', body)).status, 400, JSON.stringify(body));
    }
});

test('under 18 is turned away and nothing is remembered', async () => {
    const anon = new Client();
    const res = await anon.post('/api/age-verification', birth(18, 1)); // 18th birthday is tomorrow
    assert.equal(res.status, 200);
    assert.equal(res.json.allowed, false);
    assert.equal(res.headers.getSetCookie().length, 0);
    assert.ok((await anon.get(`/read/${s.ch}`)).text.includes(GATE));

    const minor = await users.reader.post('/api/age-verification', birth(15));
    assert.equal(minor.json.allowed, false);
    assert.equal((await db.query('SELECT birth_date FROM users WHERE id = ?', [ids.reader]))[0][0].birth_date, null);
});

test('18 today passes; a guest is remembered by a cookie', async () => {
    const anon = new Client();
    const res = await anon.post('/api/age-verification', birth(18));
    assert.equal(res.json.allowed, true);
    assert.ok(anon.cookies['loveread-age-ok']);

    const read = await anon.get(`/read/${s.ch}`);
    assert.ok(!read.text.includes(GATE));
    assert.ok(read.text.includes('AG-SECRET-TEXT'));
    assert.equal((await anon.get(`/api/chapters?chapterId=${s.ch}`)).json.content, 'AG-SECRET-TEXT');
    assert.equal((await anon.get(s.pageUrl)).status, 200);
    const story = await anon.get(`/novel/${s.novel}`);
    assert.ok(story.text.includes('AG chapter'));
    assert.ok(story.text.includes('เนื้อหาสำหรับผู้มีอายุ 18 ปีขึ้นไป'), '18+ badge on the story page');
});

test('a logged-in reader is remembered in their account, on any browser', async () => {
    const b = birth(30);
    const res = await users.reader.post('/api/age-verification', b);
    assert.equal(res.json.allowed, true);
    const [[row]] = await db.query("SELECT DATE_FORMAT(birth_date, '%Y-%m-%d') AS d FROM users WHERE id = ?", [ids.reader]);
    assert.equal(row.d, `${b.year - BE}-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`);

    // A new browser (no cookie) logged in as the same reader
    const other = new Client();
    const [[{ email }]] = await db.query('SELECT email FROM users WHERE id = ?', [ids.reader]);
    assert.ok(await other.login(email));
    assert.ok(!other.cookies['loveread-age-ok']);
    assert.ok((await other.get(`/read/${s.ch}`)).text.includes('AG-SECRET-TEXT'));
});

test('the author and admins skip the age check', async () => {
    assert.ok((await users.author.get(`/read/${s.ch}`)).text.includes('AG-SECRET-TEXT'));
    assert.ok((await users.admin.get(`/read/${s.ch}`)).text.includes('AG-SECRET-TEXT'));
    assert.ok(!(await users.admin.get(`/novel/${s.novel}`)).text.includes(GATE));
});
