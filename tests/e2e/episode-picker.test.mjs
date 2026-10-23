// Episode picker on the reader pages (lib/episodeList.ts, components/EpisodePicker.tsx): the list the page sends
// to the picker, its lock/read flags (item_reads), and that it never carries chapter content.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, uuid } from './helpers.mjs';

let db, ids, users;
const anon = new Client();
const c = {};

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db, { reader: 'READER', author: 'AUTHOR' }, { coins: 100 }));
    Object.assign(c, { novel: uuid(), archived: uuid(), comic: uuid(), ch1: uuid(), ch2: uuid(), paid: uuid(), arFree: uuid(), arPaid: uuid(), arBought: uuid(), ep1: uuid(), epPaid: uuid() });
    await db.query(`INSERT INTO novels (id, title, status, author_id) VALUES (?, 'E2E EP Novel', 'PUBLISHED', ?), (?, 'E2E EP Archived', 'PUBLISHED', ?)`,
        [c.novel, ids.author, c.archived, ids.author]);
    await db.query(`INSERT INTO chapters (id, title, content, chapter_order, novel_id, price) VALUES
        (?, 'EP Chapter 1', 'EP-SECRET-ONE', 1, ?, 0), (?, 'EP Chapter 2', 'EP-SECRET-TWO', 2, ?, 0), (?, 'EP Paid', 'EP-SECRET-PAID', 3, ?, 10),
        (?, 'AR Free', 'x', 1, ?, 0), (?, 'AR Paid', 'x', 2, ?, 10), (?, 'AR Bought', 'x', 3, ?, 10)`,
        [c.ch1, c.novel, c.ch2, c.novel, c.paid, c.novel, c.arFree, c.archived, c.arPaid, c.archived, c.arBought, c.archived]);
    await db.query(`INSERT INTO comics (id, title, status, author_id) VALUES (?, 'E2E EP Comic', 'PUBLISHED', ?)`, [c.comic, ids.author]);
    await db.query(`INSERT INTO comic_episodes (id, title, episode_order, comic_id, price) VALUES
        (?, 'EP Episode 1', 1, ?, 0), (?, 'EP Paid Episode', 2, ?, 10)`, [c.ep1, c.comic, c.epPaid, c.comic]);
});

after(async () => {
    if (db) {
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

// The picker's items are serialized into the page's RSC payload as escaped JSON
const ITEM = /\{"id":"([0-9a-f-]{36})","number":(\d+),"title":"([^"]*)","price":(\d+),"locked":(true|false),"read":(true|false)\}/g;
function pickerItems(html) {
    const items = new Map();
    for (const m of html.replaceAll('\\"', '"').matchAll(ITEM)) {
        items.set(m[1], { number: Number(m[2]), title: m[3], price: Number(m[4]), locked: m[5] === 'true', read: m[6] === 'true' });
    }
    return items;
}
const page = async (client, url) => {
    const res = await client.get(url);
    assert.equal(res.status, 200, url);
    return { html: res.text, items: pickerItems(res.text) };
};

test('the picker lists every chapter in order with lock flags', async () => {
    const { html, items } = await page(anon, `/read/${c.ch1}`);
    assert.deepEqual([...items.keys()], [c.ch1, c.ch2, c.paid]);
    assert.deepEqual([...items.values()].map(i => i.number), [1, 2, 3]);
    assert.equal(items.get(c.paid).locked, true);
    assert.equal(items.get(c.paid).price, 10);
    assert.equal(items.get(c.ch2).locked, false);
    assert.ok(!html.includes('EP-SECRET-TWO') && !html.includes('EP-SECRET-PAID'), 'no content of other chapters');
});

test('the paywall page lists chapters too, and buying unlocks the item', async () => {
    let { items } = await page(users.reader, `/read/${c.paid}`);
    assert.equal(items.get(c.paid).locked, true);
    assert.equal((await users.reader.post('/api/purchases', { kind: 'chapter', id: c.paid })).status, 200);
    ({ items } = await page(users.reader, `/read/${c.paid}`));
    assert.equal(items.get(c.paid).locked, false);
});

test('chapters the reader opened are marked read; the author sees nothing locked', async () => {
    await page(users.reader, `/read/${c.ch1}`);
    const { items } = await page(users.reader, `/read/${c.ch2}`);
    assert.equal(items.get(c.ch1).read, true);
    assert.equal(items.get(c.ch2).read, true, 'the current chapter counts as read');
    assert.equal(items.get(c.paid).read, true, 'opened after buying');

    const anonItems = (await page(anon, `/read/${c.ch2}`)).items;
    assert.ok([...anonItems.values()].every(i => !i.read), 'nothing is read for anonymous viewers');

    const authorItems = (await page(users.author, `/read/${c.ch1}`)).items;
    assert.ok([...authorItems.values()].every(i => !i.locked));
});

test('comic reader lists episodes with lock flags', async () => {
    const { items } = await page(users.reader, `/comic/${c.comic}/read/${c.ep1}`);
    assert.deepEqual([...items.keys()], [c.ep1, c.epPaid]);
    assert.equal(items.get(c.ep1).read, true);
    assert.equal(items.get(c.epPaid).locked, true);
});

test('archived stories only list what the viewer bought', async () => {
    assert.equal((await users.reader.post('/api/purchases', { kind: 'chapter', id: c.arBought })).status, 200);
    await db.query(`UPDATE novels SET status = 'ARCHIVED' WHERE id = ?`, [c.archived]);
    const { items } = await page(users.reader, `/read/${c.arBought}`);
    assert.deepEqual([...items.keys()], [c.arBought]);
    const authorItems = (await page(users.author, `/read/${c.arBought}`)).items;
    assert.equal(authorItems.size, 3);
});

test('clearing history also clears read marks', async () => {
    assert.equal((await users.reader.del('/api/history', { content_type: 'comic', content_id: c.comic })).status, 200);
    const [comicReads] = await db.query('SELECT 1 FROM item_reads WHERE user_id = ? AND episode_id IS NOT NULL', [ids.reader]);
    assert.equal(comicReads.length, 0);
    const [novelReads] = await db.query('SELECT 1 FROM item_reads WHERE user_id = ? AND chapter_id IS NOT NULL', [ids.reader]);
    assert.ok(novelReads.length > 0, 'other stories keep their marks');

    assert.equal((await users.reader.del('/api/history', { all: true })).status, 200);
    const [all] = await db.query('SELECT 1 FROM item_reads WHERE user_id = ?', [ids.reader]);
    assert.equal(all.length, 0);
});
