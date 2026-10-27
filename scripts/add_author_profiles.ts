import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { defaultUsername } from '../lib/username';

dotenv.config();

// Public author profiles: users.username/bio/cover_image/social_links, novels/comics.is_completed ("จบแล้ว"),
// and the follows / supports tables (same definitions as schema.sql). Every existing user without a username
// gets "user_<hex from id>". Only adds things, never changes or removes existing data. Safe to run more than once.
async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    async function hasColumn(table: string, column: string) {
        const [rows] = await connection.query<mysql.RowDataPacket[]>(
            'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            [table, column]
        );
        return rows.length > 0;
    }
    async function addColumn(table: string, column: string, definition: string) {
        if (await hasColumn(table, column)) return;
        await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`Added ${table}.${column}`);
    }

    try {
        await addColumn('users', 'username', 'VARCHAR(30) UNIQUE AFTER coins');
        await addColumn('users', 'bio', 'TEXT AFTER username');
        await addColumn('users', 'cover_image', 'VARCHAR(255) AFTER bio');
        await addColumn('users', 'social_links', 'TEXT AFTER cover_image');
        await addColumn('novels', 'is_completed', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER status');
        await addColumn('comics', 'is_completed', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER status');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS follows (
                follower_id VARCHAR(36) NOT NULL,
                author_id VARCHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (follower_id, author_id),
                INDEX idx_author (author_id),
                FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS supports (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                author_id VARCHAR(36) NOT NULL,
                amount INT NOT NULL,
                author_earning DECIMAL(10, 2) NOT NULL,
                message VARCHAR(200),
                created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
                INDEX idx_author_time (author_id, created_at),
                INDEX idx_user_time (user_id, created_at),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (author_id) REFERENCES users(id)
            )
        `);
        console.log('follows and supports tables ready.');

        const [users] = await connection.query<mysql.RowDataPacket[]>('SELECT id FROM users WHERE username IS NULL');
        let filled = 0;
        for (const { id } of users) {
            for (let attempt = 0; attempt < 7; attempt++) {
                const [result] = await connection.query<mysql.ResultSetHeader>(
                    'UPDATE IGNORE users SET username = ? WHERE id = ? AND username IS NULL',
                    [defaultUsername(id, attempt), id]
                );
                if (result.affectedRows > 0) { filled++; break; }
            }
        }
        console.log(`Usernames set for ${filled} of ${users.length} users without one.`);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exitCode = 1;
    } finally {
        await connection.end();
    }
}

migrate();
