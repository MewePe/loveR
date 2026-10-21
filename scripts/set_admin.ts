import mysql, { RowDataPacket } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function setAdmin() {
    const email = process.argv[2];

    if (!email) {
        console.error('Please provide an email address.');
        console.log('Usage: npx tsx scripts/set_admin.ts <email>');
        process.exit(1);
    }

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    try {
        const [users] = await connection.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            console.error(`User with email ${email} not found.`);
            process.exit(1);
        }

        await connection.query('UPDATE users SET role = "ADMIN" WHERE email = ?', [email]);
        console.log(`Successfully promoted ${email} to ADMIN.`);
    } catch (error) {
        console.error('Error updating user:', error);
    } finally {
        await connection.end();
    }
}

setAdmin();
