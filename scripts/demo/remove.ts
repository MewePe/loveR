import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { assertLocalDatabase, backupDatabase, dbConfig } from './backup';
import { DEMO_EMAIL_DOMAIN } from './data';

dotenv.config({ quiet: true });

// Removes everything scripts/demo/seed.ts added. Demo users are found by their email domain and everything else hangs
// off them, so real users and their stories are never selected. Coins real users spent on demo stories during a
// presentation are not refunded: those purchases and supports go with the demo author.

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, 'storage', 'demo-manifest.json');

async function main() {
    assertLocalDatabase();
    const conn = await mysql.createConnection({ ...dbConfig(), charset: 'utf8mb4' });
    try {
        const [users] = await conn.query<mysql.RowDataPacket[]>('SELECT id FROM users WHERE email LIKE ?', [`%@${DEMO_EMAIL_DOMAIN}`]);
        const ids = users.map((u) => u.id as string);
        const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { createdCategories: [] };
        if (ids.length === 0) {
            console.log('ไม่มีข้อมูลตัวอย่างในฐานข้อมูล');
        } else {
            console.log(`สำรองแล้ว: ${await backupDatabase(conn, 'before-demo-remove')}`);
            const [novels] = await conn.query<mysql.RowDataPacket[]>('SELECT id FROM novels WHERE author_id IN (?)', [ids]);
            const [comics] = await conn.query<mysql.RowDataPacket[]>('SELECT id FROM comics WHERE author_id IN (?)', [ids]);
            const targets = [...ids, ...novels.map((n) => n.id), ...comics.map((c) => c.id)];

            await conn.beginTransaction();
            await conn.query('DELETE FROM reports WHERE reporter_id IN (?) OR target_id IN (?)', [ids, targets]);
            await conn.query('DELETE FROM admin_logs WHERE target_id IN (?)', [targets]);
            await conn.query('DELETE FROM supports WHERE user_id IN (?) OR author_id IN (?)', [ids, ids]);
            await conn.query('DELETE FROM purchases WHERE user_id IN (?) OR author_id IN (?)', [ids, ids]);
            await conn.query('DELETE FROM withdrawals WHERE user_id IN (?)', [ids]);
            // Chapters, pages, views, comments, ratings and the rest cascade from the stories and users
            await conn.query('DELETE FROM comics WHERE author_id IN (?)', [ids]);
            await conn.query('DELETE FROM novels WHERE author_id IN (?)', [ids]);
            await conn.query('DELETE FROM users WHERE id IN (?)', [ids]);
            if (manifest.createdCategories.length) await conn.query('DELETE FROM categories WHERE id IN (?)', [manifest.createdCategories]);
            await conn.commit();
        }

        // Only after the commit, so a failure above leaves everything working
        for (const id of ids) {
            rmSync(path.join(ROOT, 'storage', 'comic-pages', id), { recursive: true, force: true });
            for (const category of ['topup-slips', 'withdrawal-slips', 'writer-docs']) {
                rmSync(path.join(ROOT, 'storage', 'private', category, id), { recursive: true, force: true });
            }
        }
        const uploads = path.join(ROOT, 'public', 'uploads');
        if (existsSync(uploads)) {
            // Real uploads are named with a UUID, so the demo- prefix can't match them
            for (const file of readdirSync(uploads)) if (/^demo-[a-z0-9-]+\.jpg$/.test(file)) rmSync(path.join(uploads, file));
        }
        rmSync(MANIFEST, { force: true });
        console.log(`ลบข้อมูลตัวอย่างแล้ว (ผู้ใช้ ${ids.length} คน)`);
    } catch (error) {
        await conn.rollback().catch(() => {});
        throw error;
    } finally {
        await conn.end();
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
