import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// users.reader_settings: the novel reader display settings ("Aa" panel) of logged-in readers, as JSON.
// Same definition as schema.sql. Safe to run more than once.
async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    try {
        const [rows] = await connection.query<mysql.RowDataPacket[]>(
            "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'reader_settings'"
        );
        if (rows.length === 0) {
            await connection.query('ALTER TABLE users ADD COLUMN reader_settings TEXT');
            console.log('Added users.reader_settings');
        }
        console.log('reader_settings ready.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exitCode = 1;
    } finally {
        await connection.end();
    }
}

migrate();
