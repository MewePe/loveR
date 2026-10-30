import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Creates the story_views_daily table (same definition as schema.sql) for the daily/weekly/monthly view rankings.
// Past views can't be split by day, so it starts empty and only counts from now on. Safe to run more than once.
async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS story_views_daily (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                view_date DATE NOT NULL,
                novel_id VARCHAR(36),
                comic_id VARCHAR(36),
                views INT NOT NULL DEFAULT 0,
                UNIQUE KEY uniq_novel_date (novel_id, view_date),
                UNIQUE KEY uniq_comic_date (comic_id, view_date),
                INDEX idx_view_date (view_date),
                FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
                FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE
            )
        `);
        console.log('story_views_daily table ready.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
