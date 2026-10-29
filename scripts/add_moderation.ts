import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Content check by API + 18+ age gate (lib/moderation.ts, lib/ageGate.ts). Same definitions as schema.sql:
// - chapters.moderation_status / comic_episodes.moderation_status (existing items start as APPROVED, so nothing
//   already published disappears)
// - users.birth_date (saved when a reader passes the age check)
// - moderation_checks table (the admin queue "คิวตรวจเนื้อหา")
// Safe to run more than once.
async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    const hasColumn = async (table: string, column: string) => {
        const [rows] = await connection.query<mysql.RowDataPacket[]>(
            'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            [table, column]
        );
        return rows.length > 0;
    };

    try {
        for (const table of ['chapters', 'comic_episodes']) {
            if (await hasColumn(table, 'moderation_status')) continue;
            await connection.query(
                `ALTER TABLE ${table} ADD COLUMN moderation_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED' AFTER price`
            );
            console.log(`Added ${table}.moderation_status`);
        }

        if (!(await hasColumn('users', 'birth_date'))) {
            await connection.query('ALTER TABLE users ADD COLUMN birth_date DATE NULL AFTER reader_settings');
            console.log('Added users.birth_date');
        }

        await connection.query(`
            CREATE TABLE IF NOT EXISTS moderation_checks (
                id VARCHAR(36) PRIMARY KEY,
                item_type VARCHAR(10) NOT NULL,
                chapter_id VARCHAR(36) NULL,
                episode_id VARCHAR(36) NULL,
                story_id VARCHAR(36) NOT NULL,
                author_id VARCHAR(36) NOT NULL,
                reporter_id VARCHAR(36) NULL,
                source VARCHAR(20) NOT NULL,
                declared_mature TINYINT(1) NOT NULL DEFAULT 0,
                verdict VARCHAR(20) NULL,
                analysis TEXT,
                model VARCHAR(64),
                status VARCHAR(20) NOT NULL DEFAULT 'CHECKING',
                reviewer_id VARCHAR(36) NULL,
                review_note TEXT,
                reviewed_at TIMESTAMP NULL,
                created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
                updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
                INDEX idx_status_time (status, created_at),
                INDEX idx_author (author_id, status),
                FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
                FOREIGN KEY (episode_id) REFERENCES comic_episodes(id) ON DELETE SET NULL,
                FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('moderation_checks ready.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exitCode = 1;
    } finally {
        await connection.end();
    }
}

migrate();
