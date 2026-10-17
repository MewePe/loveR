import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Creates the login_attempts table used to rate-limit failed logins (lib/loginThrottle.ts). Safe to run more than once.
async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS login_attempts (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                ip VARCHAR(64) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_email_time (email, created_at),
                INDEX idx_ip_time (ip, created_at),
                INDEX idx_time (created_at)
            )
        `);
        console.log('login_attempts table ready.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
