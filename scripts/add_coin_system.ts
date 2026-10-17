import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Adds the coin / paid-episode system to an existing database. Safe to run more than once.
async function migrate() {
    const database = process.env.DB_NAME || 'loveread_db';
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database,
    });

    async function addColumn(table: string, column: string, definition: string) {
        const [rows] = await connection.query<mysql.RowDataPacket[]>(
            'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            [database, table, column]
        );
        if (rows.length === 0) {
            await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
            console.log(`Added ${table}.${column}`);
        }
    }

    try {
        await addColumn('users', 'coins', 'INT NOT NULL DEFAULT 0');
        await addColumn('chapters', 'price', 'INT NOT NULL DEFAULT 0');
        await addColumn('comic_episodes', 'price', 'INT NOT NULL DEFAULT 0');
        await addColumn('system_settings', 'author_share_percent', 'INT NOT NULL DEFAULT 70');
        await addColumn('system_settings', 'payment_info', 'TEXT');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS coin_topups (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                amount INT NOT NULL,
                slip_image VARCHAR(255) NOT NULL,
                status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
                rejection_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS purchases (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                chapter_id VARCHAR(36),
                episode_id VARCHAR(36),
                item_title VARCHAR(255),
                author_id VARCHAR(36) NOT NULL,
                price INT NOT NULL,
                author_earning DECIMAL(10, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_user_chapter (user_id, chapter_id),
                UNIQUE KEY uniq_user_episode (user_id, episode_id),
                INDEX idx_author (author_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
                FOREIGN KEY (episode_id) REFERENCES comic_episodes(id) ON DELETE SET NULL,
                FOREIGN KEY (author_id) REFERENCES users(id)
            )
        `);

        console.log('Coin system migration complete.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
