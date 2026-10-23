import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Creates the item_reads table (same definition as schema.sql) and seeds it with the last chapter/episode
// already in reading_history, so existing readers keep at least that one marked as read. Safe to run more than once.
async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS item_reads (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                chapter_id VARCHAR(36),
                episode_id VARCHAR(36),
                read_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
                UNIQUE KEY uniq_user_chapter (user_id, chapter_id),
                UNIQUE KEY uniq_user_episode (user_id, episode_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
                FOREIGN KEY (episode_id) REFERENCES comic_episodes(id) ON DELETE CASCADE
            )
        `);
        const [result] = await connection.query<mysql.ResultSetHeader>(`
            INSERT IGNORE INTO item_reads (id, user_id, chapter_id, episode_id, read_at)
            SELECT UUID(), user_id, chapter_id, episode_id, read_at FROM reading_history
            WHERE chapter_id IS NOT NULL OR episode_id IS NOT NULL
        `);
        console.log(`item_reads table ready (${result.affectedRows} rows copied from reading_history).`);
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
