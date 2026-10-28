import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Admin dashboard tools: ban details on users (ban_reason, banned_at, role_before_ban), the coin_adjustments table
// (coins an admin added/removed) and admin_logs (audit log of every admin action). Same definitions as schema.sql.
// Users already BANNED get role_before_ban = READER (their earlier role is unknown). Safe to run more than once.
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
        await addColumn('users', 'ban_reason', 'TEXT AFTER social_links');
        await addColumn('users', 'banned_at', 'TIMESTAMP NULL AFTER ban_reason');
        await addColumn('users', 'role_before_ban', "ENUM('VISITOR', 'READER', 'AUTHOR', 'ADMIN') AFTER banned_at");
        const [fixed] = await connection.query<mysql.ResultSetHeader>(
            "UPDATE users SET role_before_ban = 'READER' WHERE role = 'BANNED' AND role_before_ban IS NULL"
        );
        if (fixed.affectedRows) console.log(`role_before_ban = READER for ${fixed.affectedRows} banned users`);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS coin_adjustments (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                admin_id VARCHAR(36),
                amount INT NOT NULL,
                balance_after INT NOT NULL,
                reason VARCHAR(500) NOT NULL,
                created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
                INDEX idx_user_time (user_id, created_at),
                INDEX idx_time (created_at),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS admin_logs (
                id VARCHAR(36) PRIMARY KEY,
                admin_id VARCHAR(36),
                admin_name VARCHAR(255),
                action VARCHAR(40) NOT NULL,
                target_type VARCHAR(20),
                target_id VARCHAR(36),
                target_label VARCHAR(255),
                detail VARCHAR(500),
                reason TEXT,
                created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
                INDEX idx_time (created_at),
                INDEX idx_action_time (action, created_at),
                INDEX idx_target (target_id),
                FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('coin_adjustments and admin_logs tables ready.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exitCode = 1;
    } finally {
        await connection.end();
    }
}

migrate();
