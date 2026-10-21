import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Tables that point at "a novel or a comic" (bookmarks, comments, ratings) have both novel_id and comic_id
// columns with exactly one set. APIs speak in { content_type: 'novel' | 'comic', content_id } instead.
export const CONTENT_COLUMN = { novel: 'novel_id', comic: 'comic_id' } as const;
export const CONTENT_TABLE = { novel: 'novels', comic: 'comics' } as const;
export type ContentType = keyof typeof CONTENT_COLUMN;

export function isContentType(value: unknown): value is ContentType {
    return value === 'novel' || value === 'comic';
}

// The parent novel/comic row (id, title, status, author_id) or undefined
export async function getContentRow(type: ContentType, id: string) {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, title, status, author_id FROM ${CONTENT_TABLE[type]} WHERE id = ?`,
        [id]
    );
    return rows[0];
}
