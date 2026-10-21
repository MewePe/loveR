import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Creates the comments and ratings tables (same definitions as schema.sql). Safe to run more than once.
async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                novel_id VARCHAR(36),
                comic_id VARCHAR(36),
                body TEXT NOT NULL,
                created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
                INDEX idx_novel_time (novel_id, created_at),
                INDEX idx_comic_time (comic_id, created_at),
                INDEX idx_user_time (user_id, created_at),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
                FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE
            )
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS ratings (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                novel_id VARCHAR(36),
                comic_id VARCHAR(36),
                score TINYINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_user_novel (user_id, novel_id),
                UNIQUE KEY uniq_user_comic (user_id, comic_id),
                INDEX idx_novel (novel_id),
                INDEX idx_comic (comic_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
                FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE
            )
        `);
        console.log('comments and ratings tables ready.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
