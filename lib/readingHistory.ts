import pool from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { ContentType } from '@/lib/contentRef';

// reading_history keeps one row per user per novel/comic: the last chapter/episode they opened and when.
// The column names are fixed per content type (never built from input).
const COLUMNS = {
    novel: { content: 'novel_id', item: 'chapter_id' },
    comic: { content: 'comic_id', item: 'episode_id' },
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
}
