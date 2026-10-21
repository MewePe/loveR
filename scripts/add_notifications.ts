import mysql, { RowDataPacket } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Notifications (lib/notifications.ts) and comment replies (comments.parent_id). Same definitions as schema.sql.
// Safe to run more than once.
async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                actor_id VARCHAR(36), -- who caused it; deleting that user removes the notifications they caused
                type VARCHAR(32) NOT NULL,
                message VARCHAR(500) NOT NULL,
                link VARCHAR(500) NOT NULL,
                is_read TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
                INDEX idx_user_time (user_id, created_at),
                INDEX idx_user_unread (user_id, is_read),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('notifications table ready.');

        // Tables created by an earlier version of this script lack actor_id
        const [actorColumn] = await connection.query<RowDataPacket[]>(
            "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'actor_id'"
        );
        if (actorColumn.length === 0) {
            await connection.query(`
                ALTER TABLE notifications
                    ADD COLUMN actor_id VARCHAR(36) NULL AFTER user_id,
                    ADD CONSTRAINT notifications_ibfk_2 FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
            `);
            console.log('notifications.actor_id added.');
        }

        const [columns] = await connection.query<RowDataPacket[]>(
            "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comments' AND COLUMN_NAME = 'parent_id'"
        );
        if (columns.length === 0) {
            await connection.query(`
                ALTER TABLE comments
                    ADD COLUMN parent_id VARCHAR(36) NULL AFTER comic_id,
                    ADD INDEX idx_parent_time (parent_id, created_at),
                    ADD CONSTRAINT comments_ibfk_4 FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
            `);
            console.log('comments.parent_id added.');
        } else {
            console.log('comments.parent_id already exists.');
        }
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
