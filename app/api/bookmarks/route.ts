import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { canViewContent } from '@/lib/visibility';

// The bookmarks table has one row per bookmark with either novel_id or comic_id set.
// The API speaks in { content_type: 'novel' | 'comic', content_id } so the client doesn't care which column.
const COLUMN = { novel: 'novel_id', comic: 'comic_id' } as const;
const TABLE = { novel: 'novels', comic: 'comics' } as const;
type ContentType = keyof typeof COLUMN;

function isContentType(value: unknown): value is ContentType {
    return value === 'novel' || value === 'comic';
}

// GET /api/bookmarks — list the user's bookmarks, or ?content_type=&content_id= to check one
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    try {
        const { searchParams } = new URL(req.url);
        const contentType = searchParams.get('content_type');
        const contentId = searchParams.get('content_id');

        if (contentType && contentId) {
            if (!isContentType(contentType)) {
                return NextResponse.json({ error: 'Invalid content_type' }, { status: 400 });
            }
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT id FROM bookmarks WHERE user_id = ? AND ${COLUMN[contentType]} = ?`,
                [userId, contentId]
            );
            return NextResponse.json({ bookmarked: rows.length > 0 });
        }

        // Unpublished content (other than the user's own) is left out
        const [bookmarks] = await pool.query<RowDataPacket[]>(`
            SELECT b.id, b.created_at,
                   CASE WHEN b.novel_id IS NOT NULL THEN 'novel' ELSE 'comic' END AS content_type,
                   COALESCE(b.novel_id, b.comic_id) AS content_id,
                   COALESCE(n.title, c.title) AS title,
                   COALESCE(n.cover_image, c.cover_image) AS cover_image,
                   COALESCE(n.description, c.description) AS description,
                   u.name AS author_name
            FROM bookmarks b
            LEFT JOIN novels n ON b.novel_id = n.id
            LEFT JOIN comics c ON b.comic_id = c.id
            LEFT JOIN users u ON u.id = COALESCE(n.author_id, c.author_id)
            WHERE b.user_id = ?
              AND (COALESCE(n.status, c.status) = 'PUBLISHED' OR COALESCE(n.author_id, c.author_id) = ?)
            ORDER BY b.created_at DESC
        `, [userId, userId]);

        return NextResponse.json({ bookmarks });
    } catch (error) {
        console.error('Error fetching bookmarks:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST /api/bookmarks — add a bookmark. Body: { content_type, content_id }
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    try {
        const { content_type, content_id } = await req.json();
        if (!isContentType(content_type) || typeof content_id !== 'string') {
            return NextResponse.json({ error: 'Invalid content_type or content_id' }, { status: 400 });
        }

        const [content] = await pool.query<RowDataPacket[]>(
            `SELECT status, author_id FROM ${TABLE[content_type]} WHERE id = ?`,
            [content_id]
        );
        if (!content[0] || !canViewContent(session.user, content[0])) {
            return NextResponse.json({ error: 'Content not found' }, { status: 404 });
        }

        const column = COLUMN[content_type];
        const [existing] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM bookmarks WHERE user_id = ? AND ${column} = ?`,
            [userId, content_id]
        );
        if (existing.length === 0) {
            await pool.query(
                `INSERT INTO bookmarks (id, user_id, ${column}) VALUES (?, ?, ?)`,
                [uuidv4(), userId, content_id]
            );
        }

        return NextResponse.json({ success: true, bookmarked: true });
    } catch (error) {
        console.error('Error adding bookmark:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE /api/bookmarks — remove a bookmark. Body: { content_type, content_id }
export async function DELETE(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { content_type, content_id } = await req.json();
        if (!isContentType(content_type) || typeof content_id !== 'string') {
            return NextResponse.json({ error: 'Invalid content_type or content_id' }, { status: 400 });
        }

        await pool.query(
            `DELETE FROM bookmarks WHERE user_id = ? AND ${COLUMN[content_type]} = ?`,
            [session.user.id, content_id]
        );

        return NextResponse.json({ success: true, bookmarked: false });
    } catch (error) {
        console.error('Error removing bookmark:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
