import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { ContentType } from '@/lib/contentRef';

// reading_history keeps one row per user per novel/comic: the last chapter/episode they opened and when.
// item_reads keeps every chapter/episode each user has opened (for marking read items in the episode picker).
// The column names are fixed per content type (never built from input).
const COLUMNS = {
    novel: { content: 'novel_id', item: 'chapter_id', itemTable: 'chapters' },
    comic: { content: 'comic_id', item: 'episode_id', itemTable: 'comic_episodes' },
} as const;

// Called by the reader pages only after canAccess() let the user see the chapter/episode.
// Failures are logged and swallowed so history can never stop someone from reading.
export async function recordRead(userId: string, type: ContentType, contentId: string, itemId: string) {
    const { content, item } = COLUMNS[type];
    try {
        await pool.query(
            `INSERT INTO reading_history (id, user_id, ${content}, ${item}) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE ${item} = VALUES(${item}), read_at = CURRENT_TIMESTAMP(3)`,
            [uuidv4(), userId, contentId, itemId]
        );
    } catch (error) {
        console.error('Failed to record reading history (run scripts/add_reading_history.ts?):', error);
    }
    try {
        await pool.query(
            `INSERT INTO item_reads (id, user_id, ${item}) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP(3)`,
            [uuidv4(), userId, itemId]
        );
    } catch (error) {
        console.error('Failed to record read item (run scripts/add_item_reads.ts?):', error);
    }
}

// IDs the user has opened among the given chapters/episodes. Empty (nothing marked) if the table is missing.
export async function getReadItemIds(userId: string | undefined | null, type: ContentType, ids: string[]) {
    if (!userId || ids.length === 0) return new Set<string>();
    const { item } = COLUMNS[type];
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT ${item} AS item_id FROM item_reads WHERE user_id = ? AND ${item} IN (?)`,
            [userId, ids]
        );
        return new Set(rows.map(r => r.item_id as string));
    } catch (error) {
        console.error('Failed to load read items (run scripts/add_item_reads.ts?):', error);
        return new Set<string>();
    }
}

// Forget which chapters/episodes were read, for one novel/comic or (without contentId) everything.
// Used when the user clears their reading history.
export async function clearReadItems(userId: string, target?: { type: ContentType; contentId: string }) {
    try {
        if (!target) {
            await pool.query('DELETE FROM item_reads WHERE user_id = ?', [userId]);
            return;
        }
        const { content, item, itemTable } = COLUMNS[target.type];
        await pool.query(
            `DELETE r FROM item_reads r JOIN ${itemTable} i ON i.id = r.${item}
             WHERE r.user_id = ? AND i.${content} = ?`,
            [userId, target.contentId]
        );
    } catch (error) {
        console.error('Failed to clear read items (run scripts/add_item_reads.ts?):', error);
    }
}
