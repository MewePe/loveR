import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';

async function reset() {
    console.log('Connecting to DB...');
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        multipleStatements: true
    });

    await connection.query('CREATE DATABASE IF NOT EXISTS loveread_db');
    await connection.query('USE loveread_db');

    // Disable foreign key checks to allow dropping in any order
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    console.log('Fetching all tables...');
    const [rows] = await connection.query('SHOW TABLES');
    const tables = (rows as any[]).map((row: any) => Object.values(row)[0]);

    console.log(`Found ${tables.length} tables. Dropping...`);
    // Drop tables in reverse order of creation or disable FK checks (already done)
    // But let's just rely on the loop since FK checks are off.
    for (const table of tables) {
        await connection.query(`DROP TABLE IF EXISTS ${table}`);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('Applying schema.sql...');
    const schemaPath = path.join(process.cwd(), 'schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');

    await connection.query(schema);

    console.log('Database reset complete.');
    await connection.end();
}

reset().catch(console.error);
