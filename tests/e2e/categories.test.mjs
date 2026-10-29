// Multiple categories per story (lib/categories.ts): create/edit validation, the legacy category_id column,
// filtering, tags on pages, /category/[slug], similar stories, recommendations, deleting a category, and the
// migration script that copies the old single category into the new tables.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, uuid } from './helpers.mjs';

// The "แนะนำสำหรับคุณ" section of the home page HTML ('' when it isn't shown)
function recoSection(html) {
    const start = html.indexOf('id="sec-reco"');
    if (start < 0) return '';
    const end = html.indexOf('id="sec-', start + 1);
    return html.slice(start, end < 0 ? undefined : end);
}

let db, ids, users;
const anon = new Client();
const TAG = uuid().slice(0, 8);
const cat = {}; // key -> { id, slug }
const s = {}; // story ids

const api = (type) => (type === 'novel' ? '/api/novels' : '/api/comics');
async function create(type, title, categoryIds, extra = {}) {
    const res = await users.author.post(api(type), { title: `E2E CT ${TAG} ${title}`, description: 'x', categoryIds, isMature: false, ...extra });
    assert.equal(res.status, 200, JSON.stringify(res.json));
    return res.json.id;
}
const publish = async (type, id) => assert.equal((await users.author.patch(`${api(type)}/${id}`, { status: 'PUBLISHED' })).status, 200);
const tagIds = async (type, id) => (await users.author.get(`${api(type)}/${id}`)).json.categories.map((c) => c.id);
const legacy = async (table, id) => (await db.query(`SELECT category_id FROM ${table} WHERE id = ?`, [id]))[0][0].category_id;

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db, { author: 'AUTHOR', reader: 'READER', admin: 'ADMIN' }));
    for (const key of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
        cat[key] = { id: uuid(), slug: `e2e-ct-${TAG}-${key}` };
        await db.query('INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)', [cat[key].id, `E2E CT ${TAG} ${key}`, cat[key].slug]);
    }
});

after(async () => {
    if (db) {
        await cleanupUsers(db, Object.values(ids || {}));
        await db.query('DELETE FROM categories WHERE id IN (?)', [Object.values(cat).map((c) => c.id)]);
        await db.end();
    }
});

test('create keeps up to 5 categories in the picked order and mirrors the first into category_id', async () => {
    s.x = await create('novel', 'X', [cat.c.id, cat.a.id, cat.b.id]);
    assert.deepEqual(await tagIds('novel', s.x), [cat.c.id, cat.a.id, cat.b.id]);
    assert.equal(await legacy('novels', s.x), cat.c.id);

    s.k = await create('comic', 'K', [cat.b.id]);
    assert.deepEqual(await tagIds('comic', s.k), [cat.b.id]);
    assert.equal(await legacy('comics', s.k), cat.b.id);

    const none = await create('novel', 'None', []);
    assert.deepEqual(await tagIds('novel', none), []);
    assert.equal(await legacy('novels', none), null);
});

test('create rejects more than 5, unknown ids and non-arrays; duplicates collapse', async () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((k) => cat[k].id);
    const tooMany = await users.author.post('/api/novels', { title: 'E2E CT too many', description: 'x', categoryIds: six });
    assert.equal(tooMany.status, 400);
    assert.match(tooMany.json.error, /ไม่เกิน 5/);
    assert.equal((await users.author.post('/api/comics', { title: 'E2E CT bad', description: 'x', categoryIds: [uuid()] })).status, 400);
    assert.equal((await users.author.post('/api/novels', { title: 'E2E CT bad', description: 'x', categoryIds: 'nope' })).status, 400);
    const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM novels WHERE title LIKE ?', ['E2E CT too many%']);
    assert.equal(n, 0, 'nothing is created when validation fails');

    const dup = await create('novel', 'Dup', [cat.a.id, cat.a.id, cat.b.id]);
    assert.deepEqual(await tagIds('novel', dup), [cat.a.id, cat.b.id]);
});

test('edit replaces the categories, keeps other fields, and accepts the old categoryId field', async () => {
    const id = await create('novel', 'Edit', [cat.a.id]);
    assert.equal((await users.author.patch(`/api/novels/${id}`, { categoryIds: [cat.d.id, cat.e.id] })).status, 200);
    assert.deepEqual(await tagIds('novel', id), [cat.d.id, cat.e.id]);
    assert.equal(await legacy('novels', id), cat.d.id);

    assert.equal((await users.author.patch(`/api/novels/${id}`, { title: `E2E CT ${TAG} Edited` })).status, 200);
    assert.deepEqual(await tagIds('novel', id), [cat.d.id, cat.e.id], 'untouched when categoryIds is not sent');

    const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((k) => cat[k].id);
    assert.equal((await users.author.patch(`/api/novels/${id}`, { categoryIds: six })).status, 400);
    assert.deepEqual(await tagIds('novel', id), [cat.d.id, cat.e.id], 'unchanged after a rejected edit');

    assert.equal((await users.author.patch(`/api/novels/${id}`, { categoryId: cat.f.id })).status, 200);
    assert.deepEqual(await tagIds('novel', id), [cat.f.id]);

    assert.equal((await users.author.patch(`/api/novels/${id}`, { categoryIds: [] })).status, 200);
    assert.deepEqual(await tagIds('novel', id), []);
    assert.equal(await legacy('novels', id), null);

    assert.equal((await users.reader.patch(`/api/novels/${id}`, { categoryIds: [cat.a.id] })).status, 404, 'not the owner');
});

test('author list returns categories for the edit form', async () => {
    const list = (await users.author.get('/api/author/comics')).json;
    assert.deepEqual(list.find((c) => c.id === s.k).categories.map((c) => c.slug), [cat.b.slug]);
});

test('public lists filter by categories (stories must have all of them) and include tags', async () => {
    s.y = await create('novel', 'Y', [cat.a.id, cat.b.id, cat.c.id]);
    s.z = await create('novel', 'Z', [cat.a.id]);
    for (const id of [s.x, s.y, s.z]) await publish('novel', id);
    await publish('comic', s.k);
    await db.query('UPDATE novels SET views = ? WHERE id = ?', [2_000_000_000, s.z]);

    const list = async (q) => (await anon.get(`/api/novels?search=${encodeURIComponent(`E2E CT ${TAG}`)}&${q}`)).json.map((n) => n.id).sort();
    assert.deepEqual(await list(`categoryId=${cat.a.id}`), [s.x, s.y, s.z].sort());
    assert.deepEqual(await list(`categoryId=${cat.a.id}&categoryId=${cat.b.id}`), [s.x, s.y].sort());
    assert.deepEqual(await list(`categoryId=${cat.a.id},${cat.b.id}`), [s.x, s.y].sort(), 'comma form');
    assert.deepEqual(await list(`categoryId=${cat.g.id}`), []);

    const row = (await anon.get(`/api/novels?search=${encodeURIComponent(`E2E CT ${TAG} X`)}`)).json.find((n) => n.id === s.x);
    assert.deepEqual(row.categories.map((c) => c.slug), [cat.c.slug, cat.a.slug, cat.b.slug]);
    assert.deepEqual((await anon.get(`/api/comics?categoryId=${cat.b.id}`)).json.map((c) => c.id), [s.k]);
});

test('detail pages show every tag linking to its category page', async () => {
    const html = (await anon.get(`/novel/${s.x}`)).text;
    for (const k of ['a', 'b', 'c']) assert.ok(html.includes(`href="/category/${cat[k].slug}"`), `tag ${k}`);
    assert.ok(html.includes('โดย'));
    assert.ok((await anon.get(`/comic/${s.k}`)).text.includes(`href="/category/${cat.b.slug}"`));
});

test('/category/[slug] lists published novels and comics in that category', async () => {
    const res = await anon.get(`/category/${cat.b.slug}`);
    assert.equal(res.status, 200);
    assert.ok(res.text.includes(`E2E CT ${TAG} b`));
    for (const id of [s.x, s.y]) assert.ok(res.text.includes(`/novel/${id}`));
    assert.ok(res.text.includes(`/comic/${s.k}`));
    assert.ok(!res.text.includes(`/novel/${s.z}`), 'Z is not in b');
    assert.equal((await anon.get(`/category/${cat.b.slug}?sort=bogus`)).status, 200);
    assert.equal((await anon.get(`/category/e2e-ct-${TAG}-missing`)).status, 404);
});

test('similar stories rank by how many categories they share', async () => {
    const html = (await anon.get(`/novel/${s.x}`)).text;
    const section = html.slice(html.indexOf('เรื่องที่คล้ายกัน'));
    const y = section.indexOf(`/novel/${s.y}`), z = section.indexOf(`/novel/${s.z}`);
    assert.ok(y >= 0 && z >= 0, 'both shown');
    assert.ok(y < z, 'Y shares 3 categories, Z only 1 (despite far more views)');
});

test('recommendations score every category of what the user bookmarked', async () => {
    assert.equal((await users.reader.post('/api/bookmarks', { content_type: 'novel', content_id: s.x })).status, 200);
    const html = (await users.reader.get('/')).text;
    const section = recoSection(html);
    const y = section.indexOf(`/novel/${s.y}`), z = section.indexOf(`/novel/${s.z}`);
    assert.ok(y >= 0, 'Y matches all three categories');
    assert.ok(z >= 0, 'Z matches one');
    assert.ok(y < z, 'more matching categories first');
    assert.ok(section.includes(`/comic/${s.k}`), 'comic matched through its second-picked-category b');
    assert.ok(!section.includes(`/novel/${s.x}`), 'not the bookmarked story itself');
});

test('admin can delete a category that stories use; it is removed from them', async () => {
    const res = await users.admin.del(`/api/admin/categories/${cat.c.id}`);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.deepEqual(await tagIds('novel', s.x), [cat.a.id, cat.b.id]);
    assert.equal(await legacy('novels', s.x), cat.a.id, 'legacy column moves to the next category');
    delete cat.c;
});

test('migration copies the old single category into the new tables and can run again', async () => {
    const old = uuid();
    await db.query(`INSERT INTO novels (id, title, status, author_id, category_id) VALUES (?, 'E2E CT old', 'PUBLISHED', ?, ?)`, [old, ids.author, cat.g.id]);
    const run = () => execSync('npx tsx scripts/add_story_categories.ts', { stdio: 'pipe' });
    run();
    run();
    const [rows] = await db.query('SELECT category_id, sort_order FROM novel_categories WHERE novel_id = ?', [old]);
    assert.deepEqual(rows.map((r) => [r.category_id, r.sort_order]), [[cat.g.id, 0]]);
    assert.deepEqual((await tagIds('novel', s.y)), [cat.a.id, cat.b.id], 'existing multi-category stories untouched');
});
