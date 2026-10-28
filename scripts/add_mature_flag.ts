import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// novels.is_mature / comics.is_mature (18+ badge, blurred cover on cards). Same definition as schema.sql.
// Existing stories start as not 18+. Safe to run more than once.
async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    try {
        for (const table of ['novels', 'comics']) {
            const [rows] = await connection.query<mysql.RowDataPacket[]>(
                'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
                [table, 'is_mature']
            );
            if (rows.length > 0) continue;
            await connection.query(`ALTER TABLE ${table} ADD COLUMN is_mature TINYINT(1) NOT NULL DEFAULT 0 AFTER is_completed`);
            console.log(`Added ${table}.is_mature`);
        }
        console.log('is_mature ready.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exitCode = 1;
    } finally {
        await connection.end();
    }
}

migrate();
