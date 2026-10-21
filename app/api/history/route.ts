import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { CONTENT_COLUMN, isContentType } from '@/lib/contentRef';

const PAGE_SIZE = 20;

// GET /api/history?page= — the user's reading history, most recently read first.
// Rows are written by the reader pages (lib/readingHistory.ts). Like bookmarks, novels/comics that are no longer
// published are left out unless they're the user's own.
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const page = Math.max(1, Math.floor(Number(new URL(req.url).searchParams.get('page'))) || 1);

    const visible = `h.user_id = ? AND (COALESCE(n.status, c.status) = 'PUBLISHED' OR COALESCE(n.author_id, c.author_id) = ?)`;

    try {
        const [items] = await pool.query<RowDataPacket[]>(`
            SELECT CASE WHEN h.novel_id IS NOT NULL THEN 'novel' ELSE 'comic' END AS content_type,
                   COALESCE(h.novel_id, h.comic_id) AS content_id,
                   COALESCE(n.title, c.title) AS title,
                   COALESCE(n.cover_image, c.cover_image) AS cover_image,
                   u.name AS author_name,
                   COALESCE(h.chapter_id, h.episode_id) AS last_item_id,
                   COALESCE(ch.title, ep.title) AS last_item_title,
                   h.read_at
            FROM reading_history h
            LEFT JOIN novels n ON h.novel_id = n.id
            LEFT JOIN comics c ON h.comic_id = c.id
            LEFT JOIN chapters ch ON h.chapter_id = ch.id
            LEFT JOIN comic_episodes ep ON h.episode_id = ep.id
            LEFT JOIN users u ON u.id = COALESCE(n.author_id, c.author_id)
            WHERE ${visible}
            ORDER BY h.read_at DESC
            LIMIT ? OFFSET ?
        `, [userId, userId, PAGE_SIZE, (page - 1) * PAGE_SIZE]);

        const [count] = await pool.query<RowDataPacket[]>(`
            SELECT COUNT(*) AS total
            FROM reading_history h
            LEFT JOIN novels n ON h.novel_id = n.id
            LEFT JOIN comics c ON h.comic_id = c.id
            WHERE ${visible}
        `, [userId, userId]);

        return NextResponse.json({ items, total: Number(count[0].total), page, page_size: PAGE_SIZE });
    } catch (error) {
        console.error('Error fetching reading history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE /api/history — body { content_type, content_id } removes one entry, { all: true } clears the history
export async function DELETE(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json().catch(() => ({}));
        if (body.all === true) {
            await pool.query('DELETE FROM reading_history WHERE user_id = ?', [session.user.id]);
            return NextResponse.json({ success: true });
        }

        const { content_type, content_id } = body;
        if (!isContentType(content_type) || typeof content_id !== 'string') {
            return NextResponse.json({ error: 'Invalid content_type or content_id' }, { status: 400 });
        }
        await pool.query(
            `DELETE FROM reading_history WHERE user_id = ? AND ${CONTENT_COLUMN[content_type]} = ?`,
            [session.user.id, content_id]
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting reading history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
