import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// chapters.content_format: PLAIN (old chapters, shown as text) or HTML (written in the editor, lib/chapterContent.ts).
// Same definition as schema.sql. Existing chapters stay PLAIN. Safe to run more than once.
async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    try {
        const [rows] = await connection.query<mysql.RowDataPacket[]>(
            'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            ['chapters', 'content_format']
        );
        if (rows.length === 0) {
            await connection.query(`ALTER TABLE chapters ADD COLUMN content_format ENUM('PLAIN', 'HTML') NOT NULL DEFAULT 'PLAIN' AFTER content`);
            console.log('Added chapters.content_format');
        }
        console.log('content_format ready.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exitCode = 1;
    } finally {
        await connection.end();
    }
}

migrate();
