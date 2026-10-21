import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { canViewContent, isOwnerOrAdmin } from '@/lib/visibility';
import { CONTENT_COLUMN, getContentRow, isContentType } from '@/lib/contentRef';

const PAGE_SIZE = 20;
const MAX_COMMENT_LENGTH = 1000;
// Anti-spam: at most this many comments per user per minute
const MAX_COMMENTS_PER_MINUTE = 5;

// GET /api/comments?content_type=novel|comic&content_id=...&page=1 — newest first. Public for viewable content.
export async function GET(req: NextRequest) {
    const session = await auth();
    const { searchParams } = new URL(req.url);
    const contentType = searchParams.get('content_type');
    const contentId = searchParams.get('content_id');
    if (!isContentType(contentType) || !contentId) {
        return NextResponse.json({ error: 'Invalid content_type or content_id' }, { status: 400 });
    }
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

    try {
        const content = await getContentRow(contentType, contentId);
        if (!content || !canViewContent(session?.user, content)) {
            return NextResponse.json({ error: 'Content not found' }, { status: 404 });
        }

        const column = CONTENT_COLUMN[contentType];
        // Comments by banned users are hidden
        const [countRows] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS total FROM comments cm JOIN users u ON u.id = cm.user_id
             WHERE cm.${column} = ? AND u.role != 'BANNED'`,
            [contentId]
        );
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cm.id, cm.body, cm.created_at, cm.user_id, u.name AS user_name, u.image AS user_image
             FROM comments cm JOIN users u ON u.id = cm.user_id
             WHERE cm.${column} = ? AND u.role != 'BANNED'
             ORDER BY cm.created_at DESC, cm.id
             LIMIT ? OFFSET ?`,
            [contentId, PAGE_SIZE, (page - 1) * PAGE_SIZE]
        );

        const viewerId = session?.user?.id;
        const canModerate = isOwnerOrAdmin(session?.user, content.author_id);
        const comments = rows.map(({ user_id, ...c }) => ({
            ...c,
            is_author: user_id === content.author_id,
            is_mine: !!viewerId && user_id === viewerId,
            can_delete: canModerate || (!!viewerId && user_id === viewerId),
        }));

        return NextResponse.json({ comments, total: Number(countRows[0].total), page, pageSize: PAGE_SIZE });
    } catch (error) {
        console.error('Error fetching comments:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST /api/comments — Body: { content_type, content_id, body }
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    try {
        const { content_type, content_id, body } = await req.json();
        if (!isContentType(content_type) || typeof content_id !== 'string') {
            return NextResponse.json({ error: 'Invalid content_type or content_id' }, { status: 400 });
        }
        const text = typeof body === 'string' ? body.trim() : '';
        if (!text || text.length > MAX_COMMENT_LENGTH) {
            return NextResponse.json({ error: `กรุณาพิมพ์ความคิดเห็น (ไม่เกิน ${MAX_COMMENT_LENGTH} ตัวอักษร)` }, { status: 400 });
        }

        const content = await getContentRow(content_type, content_id);
        if (!content || !canViewContent(session.user, content)) {
            return NextResponse.json({ error: 'Content not found' }, { status: 404 });
        }

        const [recent] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) AS n FROM comments WHERE user_id = ? AND created_at > NOW() - INTERVAL 1 MINUTE',
            [userId]
        );
        if (Number(recent[0].n) >= MAX_COMMENTS_PER_MINUTE) {
            return NextResponse.json({ error: 'คุณแสดงความคิดเห็นถี่เกินไป กรุณารอสักครู่' }, { status: 429 });
        }

        const id = uuidv4();
        await pool.query(
            `INSERT INTO comments (id, user_id, ${CONTENT_COLUMN[content_type]}, body) VALUES (?, ?, ?, ?)`,
            [id, userId, content_id, text]
        );

        return NextResponse.json({ success: true, id });
    } catch (error) {
        console.error('Error creating comment:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
