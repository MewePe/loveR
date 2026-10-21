import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Creates the reading_history table (same definition as schema.sql). Safe to run more than once.
async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS reading_history (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                novel_id VARCHAR(36),
                comic_id VARCHAR(36),
                chapter_id VARCHAR(36),
                episode_id VARCHAR(36),
                read_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
                UNIQUE KEY uniq_user_novel (user_id, novel_id),
                UNIQUE KEY uniq_user_comic (user_id, comic_id),
                INDEX idx_user_time (user_id, read_at),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
                FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE,
                FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
                FOREIGN KEY (episode_id) REFERENCES comic_episodes(id) ON DELETE SET NULL
            )
        `);
        console.log('reading_history table ready.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
