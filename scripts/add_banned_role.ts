import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Adds BANNED to users.role. Before this the admin "ban" button wrote an invalid value that
// MariaDB (non-strict mode) silently stored as '' and the user could still log in. Safe to run more than once.
async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    try {
        await connection.query(
            "ALTER TABLE users MODIFY role ENUM('VISITOR', 'READER', 'AUTHOR', 'ADMIN', 'BANNED') DEFAULT 'READER'"
        );
        // Users "banned" by the old broken button ended up with an empty role
        const [result] = await connection.query<mysql.ResultSetHeader>("UPDATE users SET role = 'BANNED' WHERE role = ''");
        console.log(`users.role now supports BANNED (${result.affectedRows} previously broken ban(s) fixed).`);
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
