import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { canViewContent, isOwnerOrAdmin, Viewer } from '@/lib/visibility';
import { CONTENT_COLUMN, getContentRow, isContentType } from '@/lib/contentRef';
import { notify, short } from '@/lib/notifications';

const PAGE_SIZE = 20;
const MAX_COMMENT_LENGTH = 1000;
// Anti-spam: at most this many comments (replies included) per user per minute
const MAX_COMMENTS_PER_MINUTE = 5;

// Shape sent to the client: no user ids, plus what the viewer may do with it. Only the story's author gets a
// profile link (author_username); other commenters have no public profile.
function present(row: RowDataPacket, viewer: Viewer, contentAuthorId: string) {
    const { user_id, user_username, ...c } = row;
    const canModerate = isOwnerOrAdmin(viewer, contentAuthorId);
    const isAuthor = user_id === contentAuthorId;
    return {
        ...c,
        is_author: isAuthor,
        author_username: isAuthor ? user_username : null,
        is_mine: !!viewer?.id && user_id === viewer.id,
        can_delete: canModerate || (!!viewer?.id && user_id === viewer.id),
    };
}

const SELECT_COMMENT = `SELECT cm.id, cm.parent_id, cm.body, cm.created_at, cm.user_id, u.name AS user_name, u.image AS user_image,
                    u.username AS user_username
             FROM comments cm JOIN users u ON u.id = cm.user_id`;

// GET /api/comments?content_type=novel|comic&content_id=...&page=1
// Top-level comments newest first (paged), each with its replies oldest first. Public for viewable content.
export async function GET(req: NextRequest) {
    const session = await auth();
    const { searchParams } = new URL(req.url);
    const contentType = searchParams.get('content_type');
    const contentId = searchParams.get('content_id');
    if (!isContentType(contentType) || !contentId) {
        return NextResponse.json({ error: 'ข้อมูลเรื่องไม่ถูกต้อง' }, { status: 400 });
    }
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

    try {
        const content = await getContentRow(contentType, contentId);
        if (!content || !canViewContent(session?.user, content)) {
            return NextResponse.json({ error: 'ไม่พบเรื่องนี้' }, { status: 404 });
        }

        const column = CONTENT_COLUMN[contentType];
        // Comments by banned users are hidden
        const [countRows] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS total, COALESCE(SUM(cm.parent_id IS NULL), 0) AS top_level
             FROM comments cm JOIN users u ON u.id = cm.user_id
             WHERE cm.${column} = ? AND u.role != 'BANNED'`,
            [contentId]
        );
        const [rows] = await pool.query<RowDataPacket[]>(
            `${SELECT_COMMENT}
             WHERE cm.${column} = ? AND cm.parent_id IS NULL AND u.role != 'BANNED'
             ORDER BY cm.created_at DESC, cm.id
             LIMIT ? OFFSET ?`,
            [contentId, PAGE_SIZE, (page - 1) * PAGE_SIZE]
        );
        const [replies] = rows.length === 0 ? [[] as RowDataPacket[]] : await pool.query<RowDataPacket[]>(
            `${SELECT_COMMENT}
             WHERE cm.parent_id IN (?) AND u.role != 'BANNED'
             ORDER BY cm.created_at ASC, cm.id`,
            [rows.map((r) => r.id)]
        );

        const comments = rows.map((r) => ({
            ...present(r, session?.user, content.author_id),
            replies: replies.filter((rp) => rp.parent_id === r.id).map((rp) => present(rp, session?.user, content.author_id)),
        }));

        return NextResponse.json({
            comments,
            total: Number(countRows[0].top_level), // top-level comments, for paging
            total_with_replies: Number(countRows[0].total),
            page,
            pageSize: PAGE_SIZE,
        });
    } catch (error) {
        console.error('Error fetching comments:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}

// POST /api/comments — Body: { content_type, content_id, body, parent_id? }
// parent_id replies to a top-level comment on the same novel/comic (replies are one level deep).
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const userId = session.user.id;

    try {
        const { content_type, content_id, body, parent_id } = await req.json();
        if (!isContentType(content_type) || typeof content_id !== 'string') {
            return NextResponse.json({ error: 'ข้อมูลเรื่องไม่ถูกต้อง' }, { status: 400 });
        }
        if (parent_id !== undefined && parent_id !== null && typeof parent_id !== 'string') {
            return NextResponse.json({ error: 'คอมเมนต์ที่ตอบกลับไม่ถูกต้อง' }, { status: 400 });
        }
        const text = typeof body === 'string' ? body.trim() : '';
        if (!text || text.length > MAX_COMMENT_LENGTH) {
            return NextResponse.json({ error: `กรุณาพิมพ์ความคิดเห็น (ไม่เกิน ${MAX_COMMENT_LENGTH} ตัวอักษร)` }, { status: 400 });
        }

        const content = await getContentRow(content_type, content_id);
        if (!content || !canViewContent(session.user, content)) {
            return NextResponse.json({ error: 'ไม่พบเรื่องนี้' }, { status: 404 });
        }

        const column = CONTENT_COLUMN[content_type];
        let parent: RowDataPacket | undefined;
        if (parent_id) {
            const [parents] = await pool.query<RowDataPacket[]>(
                `SELECT id, user_id, parent_id FROM comments WHERE id = ? AND ${column} = ?`,
                [parent_id, content_id]
            );
            parent = parents[0];
            if (!parent) {
                return NextResponse.json({ error: 'ไม่พบความคิดเห็นที่ต้องการตอบกลับ' }, { status: 404 });
            }
            if (parent.parent_id) {
                return NextResponse.json({ error: 'ตอบกลับได้เฉพาะความคิดเห็นหลัก' }, { status: 400 });
            }
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
            `INSERT INTO comments (id, user_id, ${column}, parent_id, body) VALUES (?, ?, ?, ?, ?)`,
            [id, userId, content_id, parent?.id ?? null, text]
        );

        const name = short(session.user.name, 40) || 'ผู้ใช้';
        const title = short(content.title);
        const link = `/${content_type}/${content_id}#comments`;
        if (parent) {
            await notify([parent.user_id], { type: 'COMMENT_REPLY', message: `${name} ตอบกลับความคิดเห็นของคุณใน "${title}"`, link }, userId);
        }
        // The author hears about every comment on their work, unless they already got the reply notification
        if (!parent || parent.user_id !== content.author_id) {
            await notify([content.author_id], { type: 'NEW_COMMENT', message: `${name} แสดงความคิดเห็นใน "${title}": ${short(text, 80)}`, link }, userId);
        }

        const [created] = await pool.query<RowDataPacket[]>(`${SELECT_COMMENT} WHERE cm.id = ?`, [id]);
        return NextResponse.json({ success: true, id, comment: { ...present(created[0], session.user, content.author_id), replies: [] } });
    } catch (error) {
        console.error('Error creating comment:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
