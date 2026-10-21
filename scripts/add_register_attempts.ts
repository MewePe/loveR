import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Creates the register_attempts table used to rate-limit sign-ups (lib/registerThrottle.ts). Safe to run more than once.
async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS register_attempts (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                ip VARCHAR(64) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ip_time (ip, created_at),
                INDEX idx_time (created_at)
            )
        `);
        console.log('register_attempts table ready.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
