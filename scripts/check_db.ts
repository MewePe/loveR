import mysql from 'mysql2/promise';

async function check() {
    console.log('Connecting to DB...');
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'loveread',
        });

        console.log('Connected. Querying columns...');
        const [rows] = await connection.query('SHOW COLUMNS FROM users');
        console.log(rows);
        await connection.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

check();
