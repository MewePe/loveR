import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

// Auto-create table on first use
let tableCreated = false;
async function ensureTable() {
    if (tableCreated) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bookmarks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                content_type ENUM('novel', 'comic') NOT NULL,
                content_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_bookmark (user_id, content_type, content_id),
                INDEX idx_user (user_id),
                INDEX idx_content (content_type, content_id)
            )
        `);
        tableCreated = true;
    } catch (error) {
        console.error('Error creating bookmarks table:', error);
    }
}

async function getUserId(session: any): Promise<string | null> {
    if (session?.user?.id) return session.user.id;
    if (!session?.user?.email) return null;
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE email = ?',
        [session.user.email]
    );
    return rows[0]?.id?.toString() || null;
}

// GET /api/bookmarks — list user's bookmarks or check if specific content is bookmarked
export async function GET(req: NextRequest) {
    try {
        await ensureTable();
        const session = await auth();
        const userId = await getUserId(session);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const contentType = searchParams.get('content_type');
        const contentId = searchParams.get('content_id');

        // Check if specific content is bookmarked
        if (contentType && contentId) {
            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT id FROM bookmarks WHERE user_id = ? AND content_type = ? AND content_id = ?',
                [userId, contentType, contentId]
            );
            return NextResponse.json({ bookmarked: rows.length > 0 });
        }

        // List all bookmarks with content details
        const [bookmarks] = await pool.query<RowDataPacket[]>(`
            SELECT b.*, 
                CASE 
                    WHEN b.content_type = 'novel' THEN n.title
                    WHEN b.content_type = 'comic' THEN c.title
                END as title,
                CASE 
                    WHEN b.content_type = 'novel' THEN n.cover_image
                    WHEN b.content_type = 'comic' THEN c.cover_image
                END as cover_image,
                CASE 
                    WHEN b.content_type = 'novel' THEN n.description
                    WHEN b.content_type = 'comic' THEN c.description
                END as description,
                CASE 
                    WHEN b.content_type = 'novel' THEN (SELECT u.name FROM users u WHERE u.id = n.author_id)
                    WHEN b.content_type = 'comic' THEN (SELECT u.name FROM users u WHERE u.id = c.author_id)
                END as author_name
            FROM bookmarks b
            LEFT JOIN novels n ON b.content_type = 'novel' AND b.content_id = n.id
            LEFT JOIN comics c ON b.content_type = 'comic' AND b.content_id = c.id
            WHERE b.user_id = ?
            ORDER BY b.created_at DESC
        `, [userId]);

        return NextResponse.json({ bookmarks });
    } catch (error) {
        console.error('Error fetching bookmarks:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST /api/bookmarks — add a bookmark
export async function POST(req: NextRequest) {
    try {
        await ensureTable();
        const session = await auth();
        const userId = await getUserId(session);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { content_type, content_id } = await req.json();

        if (!content_type || !content_id) {
            return NextResponse.json({ error: 'Missing content_type or content_id' }, { status: 400 });
        }

        if (!['novel', 'comic'].includes(content_type)) {
            return NextResponse.json({ error: 'Invalid content_type' }, { status: 400 });
        }

        await pool.query(
            'INSERT IGNORE INTO bookmarks (user_id, content_type, content_id) VALUES (?, ?, ?)',
            [userId, content_type, content_id]
        );

        return NextResponse.json({ success: true, bookmarked: true });
    } catch (error) {
        console.error('Error adding bookmark:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE /api/bookmarks — remove a bookmark
export async function DELETE(req: NextRequest) {
    try {
        await ensureTable();
        const session = await auth();
        const userId = await getUserId(session);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { content_type, content_id } = await req.json();

        if (!content_type || !content_id) {
            return NextResponse.json({ error: 'Missing content_type or content_id' }, { status: 400 });
        }

        await pool.query(
            'DELETE FROM bookmarks WHERE user_id = ? AND content_type = ? AND content_id = ?',
            [userId, content_type, content_id]
        );

        return NextResponse.json({ success: true, bookmarked: false });
    } catch (error) {
        console.error('Error removing bookmark:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
