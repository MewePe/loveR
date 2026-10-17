import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Drops the retired author_requests table (replaced by writer_profiles).
// Refuses if any request hasn't been migrated (run migrate_author_requests.ts first),
// and writes a JSON backup to storage/backups/ before dropping. Safe to run more than once.
async function main() {
    const database = process.env.DB_NAME || 'loveread_db';
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database,
    });

    try {
        const [tables] = await connection.query<mysql.RowDataPacket[]>(
            'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = "author_requests"',
            [database]
        );
        if (tables.length === 0) {
            console.log('author_requests does not exist, nothing to do.');
            return;
        }

        const [unmigrated] = await connection.query<mysql.RowDataPacket[]>(
            'SELECT COUNT(*) AS n FROM author_requests ar WHERE NOT EXISTS (SELECT 1 FROM writer_profiles wp WHERE wp.user_id = ar.user_id)'
        );
        if (unmigrated[0].n > 0) {
            console.error(`${unmigrated[0].n} request(s) not in writer_profiles yet. Run scripts/migrate_author_requests.ts first.`);
            process.exitCode = 1;
            return;
        }

        const [rows] = await connection.query<mysql.RowDataPacket[]>('SELECT * FROM author_requests');
        const backupDir = path.join(process.cwd(), 'storage', 'backups');
        fs.mkdirSync(backupDir, { recursive: true });
        const backupFile = path.join(backupDir, `author_requests-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(rows, null, 2));

        await connection.query('DROP TABLE author_requests');
        console.log(`Dropped author_requests (${rows.length} row(s) backed up to ${path.relative(process.cwd(), backupFile)}).`);
    } catch (error) {
        console.error('Failed:', error);
        process.exitCode = 1;
    } finally {
        await connection.end();
    }
}

main();
