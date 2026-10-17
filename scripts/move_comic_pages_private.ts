import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

// Copies comic page images from public/uploads (anyone with the URL can open them) into private storage
// served by /api/media/comic-pages/<authorId>/<file>, and updates comic_pages.image_url.
// Safe to run more than once. Pass --delete-originals to also remove the public copies.
const deleteOriginals = process.argv.includes('--delete-originals');
const EXTENSIONS: Record<string, string> = { '.jpg': '.jpg', '.jpeg': '.jpg', '.png': '.png', '.webp': '.webp', '.gif': '.gif' };

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'loveread_db',
    });

    let moved = 0, missing = 0, deleted = 0;
    try {
        const [pages] = await connection.query<mysql.RowDataPacket[]>(`
            SELECT p.id, p.image_url, c.author_id
            FROM comic_pages p
            JOIN comic_episodes e ON p.episode_id = e.id
            JOIN comics c ON e.comic_id = c.id
            WHERE p.image_url LIKE '/uploads/%'
        `);

        for (const page of pages) {
            const source = path.join(process.cwd(), 'public', page.image_url);
            const ext = EXTENSIONS[path.extname(source).toLowerCase()];
            if (!fs.existsSync(source) || !ext || !page.author_id) {
                console.warn(`Skipping ${page.image_url} (file missing or unsupported)`);
                missing++;
                continue;
            }

            const filename = `${uuidv4()}${ext}`;
            const targetDir = path.join(process.cwd(), 'storage', 'comic-pages', page.author_id);
            fs.mkdirSync(targetDir, { recursive: true });
            fs.copyFileSync(source, path.join(targetDir, filename));

            await connection.query('UPDATE comic_pages SET image_url = ? WHERE id = ?', [
                `/api/media/comic-pages/${page.author_id}/${filename}`, page.id,
            ]);
            moved++;

            if (deleteOriginals) {
                // Keep the public file if anything else still points at it
                const [refs] = await connection.query<mysql.RowDataPacket[]>(
                    `SELECT 1 FROM comic_pages WHERE image_url = ?
                     UNION SELECT 1 FROM comics WHERE cover_image = ?
                     UNION SELECT 1 FROM novels WHERE cover_image = ?
                     UNION SELECT 1 FROM users WHERE image = ? LIMIT 1`,
                    [page.image_url, page.image_url, page.image_url, page.image_url]
                );
                if (refs.length === 0) {
                    fs.unlinkSync(source);
                    deleted++;
                }
            }
        }

        console.log(`Moved ${moved} page(s) to private storage, skipped ${missing}${deleteOriginals ? `, deleted ${deleted} public original(s)` : ''}.`);
        if (!deleteOriginals && moved > 0) {
            console.log('Public originals were kept. Run again with --delete-originals to remove them.');
        }
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
