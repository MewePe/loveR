import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// One-off migration: copy the latest author_requests row of each user into writer_profiles
// (skips users who already have a writer profile). Safe to run more than once.
async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    try {
        const [result] = await connection.query<mysql.ResultSetHeader>(`
            INSERT IGNORE INTO writer_profiles
                (user_id, title, first_name, last_name, id_card_number, address, province, district,
                 sub_district, postal_code, phone_number, status, rejection_reason, created_at, updated_at)
            SELECT ar.user_id, ar.prefix, ar.first_name, ar.last_name, ar.id_card_number, ar.address, ar.province, ar.district,
                   ar.sub_district, ar.postal_code, ar.phone, ar.status, ar.admin_note, ar.created_at, ar.updated_at
            FROM author_requests ar
            WHERE ar.created_at = (SELECT MAX(ar2.created_at) FROM author_requests ar2 WHERE ar2.user_id = ar.user_id)
              AND NOT EXISTS (SELECT 1 FROM writer_profiles wp WHERE wp.user_id = ar.user_id)
        `);
        console.log(`Migrated ${result.affectedRows} author request(s) into writer_profiles.`);
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
