import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Creates novel_categories / comic_categories (same definitions as schema.sql) and copies each story's existing
// single category (novels.category_id / comics.category_id) into them as its first category. The old column is
// left untouched, so nothing is lost. Safe to run more than once: rows that already exist are skipped.
async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    try {
        for (const [table, parent, fk] of [['novel_categories', 'novels', 'novel_id'], ['comic_categories', 'comics', 'comic_id']]) {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS ${table} (
                    ${fk} VARCHAR(36) NOT NULL,
                    category_id VARCHAR(36) NOT NULL,
                    sort_order TINYINT NOT NULL DEFAULT 0,
                    PRIMARY KEY (${fk}, category_id),
                    INDEX idx_category (category_id),
                    FOREIGN KEY (${fk}) REFERENCES ${parent}(id) ON DELETE CASCADE,
                    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
                )
            `);
            const [result] = await connection.query<mysql.ResultSetHeader>(`
                INSERT IGNORE INTO ${table} (${fk}, category_id, sort_order)
                SELECT s.id, s.category_id, 0 FROM ${parent} s
                JOIN categories c ON c.id = s.category_id
            `);
            const [[{ total }]] = await connection.query<mysql.RowDataPacket[]>(
                `SELECT COUNT(*) AS total FROM ${parent} WHERE category_id IS NOT NULL`
            );
            console.log(`${table} ready: ${result.affectedRows} copied (${total} ${parent} have a category).`);
        }
    } catch (error) {
        console.error('Migration failed:', error);
        process.exitCode = 1;
    } finally {
        await connection.end();
    }
}

migrate();
