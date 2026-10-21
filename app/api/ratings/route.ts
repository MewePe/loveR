import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { canViewContent, Viewer } from '@/lib/visibility';
import { CONTENT_COLUMN, ContentType, getContentRow, isContentType } from '@/lib/contentRef';

// { average, count, mine, can_rate } for one novel/comic
async function summary(type: ContentType, content: RowDataPacket, viewer: Viewer) {
    const column = CONTENT_COLUMN[type];
    // Ratings by banned users don't count
    const [stats] = await pool.query<RowDataPacket[]>(
        `SELECT AVG(r.score) AS average, COUNT(*) AS count FROM ratings r JOIN users u ON u.id = r.user_id
         WHERE r.${column} = ? AND u.role != 'BANNED'`,
        [content.id]
    );
    let mine: number | null = null;
    if (viewer?.id) {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT score FROM ratings WHERE user_id = ? AND ${column} = ?`,
            [viewer.id, content.id]
        );
        mine = rows[0]?.score ?? null;
    }
    const count = Number(stats[0].count);
    return {
        average: count > 0 ? Math.round(Number(stats[0].average) * 10) / 10 : null,
        count,
        mine,
        // Only published works can be rated, and not by their own author
        can_rate: !!viewer?.id && content.status === 'PUBLISHED' && viewer.id !== content.author_id,
    };
}

// GET /api/ratings?content_type=novel|comic&content_id=...
export async function GET(req: NextRequest) {
    const session = await auth();
    const { searchParams } = new URL(req.url);
    const contentType = searchParams.get('content_type');
    const contentId = searchParams.get('content_id');
    if (!isContentType(contentType) || !contentId) {
        return NextResponse.json({ error: 'Invalid content_type or content_id' }, { status: 400 });
    }

    try {
        const content = await getContentRow(contentType, contentId);
        if (!content || !canViewContent(session?.user, content)) {
            return NextResponse.json({ error: 'Content not found' }, { status: 404 });
        }
        return NextResponse.json(await summary(contentType, content, session?.user));
    } catch (error) {
        console.error('Error fetching ratings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PUT /api/ratings — set or change the user's rating. Body: { content_type, content_id, score: 1-5 }
export async function PUT(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    try {
        const { content_type, content_id, score } = await req.json();
        if (!isContentType(content_type) || typeof content_id !== 'string') {
            return NextResponse.json({ error: 'Invalid content_type or content_id' }, { status: 400 });
        }
        if (!Number.isInteger(score) || score < 1 || score > 5) {
            return NextResponse.json({ error: 'คะแนนต้องเป็น 1-5' }, { status: 400 });
        }

        const content = await getContentRow(content_type, content_id);
        if (!content || !canViewContent(session.user, content)) {
            return NextResponse.json({ error: 'Content not found' }, { status: 404 });
        }
        if (content.author_id === userId) {
            return NextResponse.json({ error: 'ให้คะแนนผลงานของตัวเองไม่ได้' }, { status: 403 });
        }
        if (content.status !== 'PUBLISHED') {
            return NextResponse.json({ error: 'ให้คะแนนได้เฉพาะผลงานที่เผยแพร่อยู่' }, { status: 400 });
        }

        await pool.query(
            `INSERT INTO ratings (id, user_id, ${CONTENT_COLUMN[content_type]}, score) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE score = VALUES(score)`,
            [uuidv4(), userId, content_id, score]
        );

        return NextResponse.json(await summary(content_type, content, session.user));
    } catch (error) {
        console.error('Error saving rating:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE /api/ratings — remove the user's rating. Body: { content_type, content_id }
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
            `DELETE FROM ratings WHERE user_id = ? AND ${CONTENT_COLUMN[content_type]} = ?`,
            [session.user.id, content_id]
        );

        const content = await getContentRow(content_type, content_id);
        if (!content || !canViewContent(session.user, content)) {
            return NextResponse.json({ success: true });
        }
        return NextResponse.json(await summary(content_type, content, session.user));
    } catch (error) {
        console.error('Error removing rating:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
