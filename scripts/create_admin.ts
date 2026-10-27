import mysql, { RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { defaultUsername } from '../lib/username';

dotenv.config();

async function createAdmin() {
    const email = process.argv[2];
    const password = process.argv[3] || 'password123'; // Default password
    const name = process.argv[4] || 'Admin';

    if (!email) {
        console.error('Please provide an email address.');
        console.log('Usage: npx tsx scripts/create_admin.ts <email> [password] [name]');
        process.exit(1);
    }

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    try {
        // Check if user exists
        const [users] = await connection.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [email]);

        if (users.length > 0) {
            console.log(`User ${email} already exists. Promoting to ADMIN...`);
            await connection.query('UPDATE users SET role = "ADMIN" WHERE email = ?', [email]);
            console.log('Success!');
        } else {
            console.log(`Creating new ADMIN user: ${email}...`);
            const hashedPassword = await bcrypt.hash(password, 10);
            const id = uuidv4();

            await connection.query(
                'INSERT INTO users (id, name, email, password, role, username) VALUES (?, ?, ?, ?, ?, ?)',
                [id, name, email, hashedPassword, 'ADMIN', defaultUsername(id)]
            );
            console.log(`Success! Created admin user.`);
            console.log(`Email: ${email}`);
            console.log(`Password: ${password}`);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

createAdmin();
