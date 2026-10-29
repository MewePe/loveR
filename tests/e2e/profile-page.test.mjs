// One profile page for everyone (/profile/[username]): /profile redirects to your own, readers have a profile too
// (no works/fans/follow), owner-only tabs (bookmarks, history, wallet), editing at /profile/edit via PATCH
// /api/profile with a live @username check, the "pick a username" prompt and generated covers for works.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, uuid } from './helpers.mjs';

let db, ids, users;
const anon = new Client();
const TAG = uuid().slice(0, 8);
const s = {};
const usernameOf = async (id) => (await db.query('SELECT username FROM users WHERE id = ?', [id]))[0][0].username;
const path = (location) => location.replace(/^https?:\/\/[^/]+/, '');
// The page itself, without the Navbar/Footer (they have links like ประวัติการอ่าน too)
const main = (html) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const mainOf = async (client, url) => main((await client.get(url)).text);

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db, { reader: 'READER', other: 'READER', author: 'AUTHOR' }));
    // Usernames are given on the first visit (ensureUsername), like a new sign-up
    for (const key of ['reader', 'other', 'author']) await users[key].get('/api/profile');
    await db.query('UPDATE users SET name = ? WHERE id = ?', [`E2E PP Reader ${TAG}`, ids.reader]);
    Object.assign(s, { novel: uuid(), mature: uuid() });
    await db.query(`INSERT INTO novels (id, title, status, author_id, is_mature) VALUES
        (?, ?, 'PUBLISHED', ?, 0), (?, ?, 'PUBLISHED', ?, 1)`,
    [s.novel, `E2E PP NoCover ${TAG}`, ids.author, s.mature, `E2E PP Mature ${TAG}`, ids.author]);
});

after(async () => {
    if (db) {
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

test('/profile goes to your own profile page and keeps the tab', async () => {
    const guest = await anon.get('/profile');
    assert.ok([307, 308].includes(guest.status));
    assert.match(guest.headers.get('location'), /\/login/);

    const name = await usernameOf(ids.reader);
    const own = await users.reader.get('/profile');
    assert.equal(path(own.headers.get('location')), `/profile/${name}`);
    assert.equal(path((await users.reader.get('/profile?tab=wallet')).headers.get('location')), `/profile/${name}?tab=wallet`);
    assert.equal(path((await users.reader.get('/profile?tab=nope')).headers.get('location')), `/profile/${name}`);
    assert.equal(path((await users.reader.get('/bookmarks')).headers.get('location')), '/profile?tab=bookmarks');
});

test('readers have a public profile without works, fans, follow or support', async () => {
    const name = await usernameOf(ids.reader);
    const page = await anon.get(`/profile/${name}`);
    assert.equal(page.status, 200);
    assert.ok(page.text.includes(`E2E PP Reader ${TAG}`));
    assert.ok(page.text.includes(`@${name}`));
    assert.ok(page.text.includes('ผู้อ่าน'));
    assert.ok(page.text.includes('ยังไม่มีผลงานที่เผยแพร่'));
    for (const hidden of ['?tab=novels', 'แฟนตัวยง', 'สนับสนุน', 'aria-pressed', 'กระเป๋าเหรียญ', 'แก้ไขโปรไฟล์']) {
        assert.ok(!main(page.text).includes(hidden), hidden);
    }
    // Still not followable or supportable
    assert.equal((await users.other.post(`/api/authors/${ids.reader}/follow`)).status, 404);
});

test('only the owner sees the bookmarks, history and wallet tabs', async () => {
    const name = await usernameOf(ids.reader);
    const own = await mainOf(users.reader, `/profile/${name}?tab=wallet`);
    for (const text of ['บุ๊กมาร์ก', 'ประวัติการอ่าน', 'กระเป๋าเหรียญ', 'href="/profile/edit"']) assert.ok(own.includes(text), text);
    assert.match(own.match(/<a[^>]*aria-current="page"[\s\S]*?<\/a>/)?.[0] ?? '', /กระเป๋าเหรียญ/, 'wallet tab is the current one');
    assert.ok(!own.includes('หน้านักเขียน'), 'readers have no writer center');

    assert.equal((await users.other.get(`/profile/${name}?tab=wallet`)).status, 200);
    const theirs = await mainOf(users.other, `/profile/${name}?tab=wallet`);
    for (const text of ['กระเป๋าเหรียญ', 'ประวัติการอ่าน', 'href="/profile/edit"']) assert.ok(!theirs.includes(text), text);

    const author = await mainOf(users.author, `/profile/${await usernameOf(ids.author)}?tab=bookmarks`);
    assert.ok(author.includes('href="/author"'), 'writer center button');
    assert.ok(author.includes('?tab=novels') && author.includes('กระเป๋าเหรียญ'), 'works and owner tabs together');
    const visitor = await mainOf(anon, `/profile/${await usernameOf(ids.author)}?tab=bookmarks`);
    assert.ok(!visitor.includes('กระเป๋าเหรียญ'));
    assert.ok(!visitor.includes('href="/author"'));
});

test('stories without a cover get the generated cover; 18+ ones are blurred', async () => {
    const html = (await anon.get(`/profile/${await usernameOf(ids.author)}?tab=novels`)).text;
    assert.ok(html.includes('linear-gradient(150deg'), 'generated cover');
    assert.ok(html.includes(`E2E PP NoCover ${TAG}`));
    assert.match(html, /blur-md/, '18+ cover blurred');
});

test('the default user_xxx name prompts you to pick one', async () => {
    const name = await usernameOf(ids.reader);
    assert.match(name, /^user_[0-9a-f]+$/);
    assert.ok((await users.reader.get(`/profile/${name}`)).text.includes('ตั้งชื่อผู้ใช้ของคุณเอง'));
    assert.ok(!(await users.other.get(`/profile/${name}`)).text.includes('ตั้งชื่อผู้ใช้ของคุณเอง'), 'only the owner sees it');
});

test('the username check answers as you type', async () => {
    const check = async (u, client = users.reader) => (await client.get(`/api/profile/username?username=${encodeURIComponent(u)}`)).json;
    assert.equal((await anon.get('/api/profile/username?username=abc')).status, 401);
    for (const bad of ['ab', 'has-dash', 'มีไทย', 'a'.repeat(31), 'edit', 'admin', 'user_1234abcd']) {
        const r = await check(bad);
        assert.equal(r.available, false, bad);
        assert.ok(r.error, bad);
    }
    const taken = await check(await usernameOf(ids.author));
    assert.deepEqual([taken.available, taken.taken, taken.error], [false, true, 'ชื่อผู้ใช้นี้มีคนใช้แล้ว']);
    const mine = await check(await usernameOf(ids.reader));
    assert.deepEqual([mine.available, mine.current], [true, true]);
    const free = await check(`@E2E_PP_${TAG}`);
    assert.deepEqual([free.available, free.username, free.current], [true, `e2e_pp_${TAG}`, false]);
});

test('anyone can edit their profile: name, @username, avatar, cover and bio', async () => {
    const before = await usernameOf(ids.reader);
    const bad = async (body, status = 400) => {
        const r = await users.reader.patch('/api/profile', body);
        assert.equal(r.status, status, JSON.stringify(body));
        return r;
    };
    await bad({ name: '  ' });
    await bad({ name: 'x'.repeat(101) });
    await bad({ username: 'edit' });
    await bad({ username: 'user_abcdef12' });
    assert.match((await bad({ username: await usernameOf(ids.author) }, 409)).json.error, /มีคนใช้แล้ว/);
    await bad({ image: 'https://evil.example/a.png' });
    await bad({ cover_image: '/api/media/x.png' });
    await bad({});
    assert.equal(await usernameOf(ids.reader), before, 'nothing saved on errors');

    const username = `e2e_pp_${TAG}`;
    const ok = await users.reader.patch('/api/profile', {
        name: `E2E PP Renamed ${TAG}`, username: `@E2E_PP_${TAG}`, bio: 'สวัสดี', image: '/uploads/e2e-avatar.png', cover_image: '/uploads/e2e-cover.png',
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    assert.equal(ok.json.username, username);

    const page = await anon.get(`/profile/${username}`);
    assert.equal(page.status, 200);
    for (const text of [`E2E PP Renamed ${TAG}`, `@${username}`, 'สวัสดี', '/uploads/e2e-avatar.png', '/uploads/e2e-cover.png']) assert.ok(page.text.includes(text), text);
    assert.ok(!(await users.reader.get(`/profile/${username}`)).text.includes('ตั้งชื่อผู้ใช้ของคุณเอง'), 'prompt gone');
    assert.equal(path((await anon.get(`/profile/${ids.reader}`)).headers.get('location')), `/profile/${username}`, 'links by id follow the new name');
    assert.equal((await anon.get(`/profile/${before}`)).status, 404, 'the old name is free again');

    // Keeping your own name is fine; clearing the images falls back to the defaults
    assert.equal((await users.reader.patch('/api/profile', { username, image: null, cover_image: null })).status, 200);
    assert.ok((await anon.get(`/profile/${username}`)).text.includes('/images/default-cover.svg'));
});

test('the edit page needs a login', async () => {
    assert.equal((await users.reader.get('/profile/edit')).status, 200);
    assert.equal((await anon.patch('/api/profile', { name: 'x' })).status, 401);
});
