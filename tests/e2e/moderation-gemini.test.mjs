// The content check against the real Gemini API (lib/moderation.ts), only with harmless content: a clean chapter
// and one with mild everyday swearing. Every other case uses the mock in moderation.test.mjs.
// Skipped when GEMINI_API_KEY isn't set in .env. Each call takes a few seconds.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, uuid, MOCK_HEADER } from './helpers.mjs';

const skip = process.env.GEMINI_API_KEY ? false : 'GEMINI_API_KEY is not set';
let db, ids, users;
const novel = uuid();

before(async () => {
    if (skip) return;
    await ensureServer();
    db = await connectDb();
    ({ ids, clients: users } = await createUsers(db, { author: 'AUTHOR' }));
    delete users.author.extraHeaders[MOCK_HEADER]; // real API
    await db.query(`INSERT INTO novels (id, title, status, author_id, is_mature) VALUES (?, 'E2E GM General', 'PUBLISHED', ?, 0)`, [novel, ids.author]);
});

after(async () => {
    if (db) {
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

async function check(title, content) {
    const res = await users.author.post(`/api/novels/${novel}/chapters`, { title, content, price: 0 });
    assert.equal(res.status, 200);
    const [[row]] = await db.query('SELECT verdict, analysis, model FROM moderation_checks WHERE chapter_id = ?', [res.json.id]);
    return { moderation: res.json.moderation, verdict: row.verdict, analysis: JSON.parse(row.analysis), model: row.model };
}

// Gemini timing out / overloaded (503) is Google's side, not this code: report it as a skip with the reason.
// The outage behaviour itself is tested with the mock in moderation.test.mjs.
const unavailable = (t, r) => r.verdict === 'ERROR' && (t.skip(`Gemini unavailable: ${r.analysis.summary}`), true);

const THAI = /[฀-๿]/;

test('a clean chapter passes and is published', { skip, timeout: 120_000 }, async (t) => {
    const r = await check('บทที่ 1 ตลาดเช้า', [
        'เช้าวันเสาร์ มินตื่นแต่เช้าเพื่อไปตลาดกับยาย ยายถือตะกร้าสานใบเก่าที่ใช้มาหลายสิบปี',
        'แม่ค้าขายผักทักทายยายด้วยรอยยิ้ม "วันนี้ผักบุ้งสดมากเลยจ้ะ" ยายเลือกผักบุ้งสองกำกับมะนาวอีกถุงหนึ่ง',
        'ก่อนกลับบ้าน มินขอซื้อขนมครกร้อนๆ ทั้งสองนั่งกินด้วยกันใต้ต้นมะม่วงหน้าบ้าน',
    ].join('\n\n'));
    t.diagnostic(`${r.model}: ${r.verdict} — ${r.analysis.summary}`);
    if (unavailable(t, r)) return;
    assert.equal(r.verdict, 'SAFE');
    assert.equal(r.moderation.status, 'APPROVED');
    assert.match(r.analysis.summary, THAI, 'analysis is in Thai');
    assert.notEqual(r.model, 'mock');
});

test('mild swearing is not treated as a serious problem', { skip, timeout: 120_000 }, async (t) => {
    const r = await check('บทที่ 2 รถติด', [
        'รถติดยาวตั้งแต่หน้าปากซอย ต้นมองนาฬิกาแล้วสบถออกมาเบาๆ "เวรเอ๊ย สายอีกแล้ว"',
        'เพื่อนที่นั่งข้างๆ หัวเราะ "ใจเย็นดิวะ เดี๋ยวก็ถึง" ต้นถอนหายใจแล้วหยิบมือถือขึ้นมาส่งข้อความบอกหัวหน้าว่าจะไปช้าสิบนาที',
    ].join('\n\n'));
    t.diagnostic(`${r.model}: ${r.verdict} — ${r.analysis.summary}`);
    if (unavailable(t, r)) return;
    // Mild language is ทั่วไป by the prompt's rules; a stricter reading (18+) only sends it to an admin. Never blocked.
    assert.ok(['SAFE', 'MATURE'].includes(r.verdict), r.verdict);
    assert.notEqual(r.moderation.status, 'BLOCKED');
    assert.match(r.analysis.summary, THAI);
});
