import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function dropOldDb() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
    });

    try {
        await connection.query('DROP DATABASE IF EXISTS loveread');
        console.log('Successfully dropped database "loveread".');
    } catch (error) {
        console.error('Error dropping database:', error);
    } finally {
        await connection.end();
    }
}

dropOldDb();
