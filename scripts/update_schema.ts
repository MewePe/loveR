import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function updateSchema() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
        multipleStatements: true
    });

    try {
        const schemaPath = path.join(process.cwd(), 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Extract the writer_profiles creation part or just run the whole thing (IF NOT EXISTS handles it)
        // But since we added a new table at the end, running the whole file is safe.
        await connection.query(schema);
        console.log('Schema updated successfully.');
    } catch (error) {
        console.error('Error updating schema:', error);
    } finally {
        await connection.end();
    }
}

updateSchema();
