import mysql, { RowDataPacket } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkUser() {
    const email = process.argv[2];
    if (!email) {
        console.log('Usage: npx tsx scripts/check_user.ts <email>');
        process.exit(1);
    }

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    const [rows] = await connection.query<RowDataPacket[]>('SELECT id, name, email, role FROM users WHERE email = ?', [email]);
    console.log(rows);
    await connection.end();
}

checkUser();
