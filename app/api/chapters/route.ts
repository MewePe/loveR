import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { canAccess, AccessItem } from '@/lib/coins';
import { canViewContent } from '@/lib/visibility';

// Chapters are created via POST /api/novels/[id]/chapters (which checks ownership)
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const novelId = searchParams.get('novelId');
    const chapterId = searchParams.get('chapterId');

    try {
        const session = await auth();

        if (chapterId) {
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT c.id, c.title, c.chapter_order, c.novel_id, c.views, c.price, c.created_at, c.updated_at,
                        n.title as novel_title, n.author_id, n.status as content_status
         FROM chapters c
         JOIN novels n ON c.novel_id = n.id
         WHERE c.id = ?`,
                [chapterId]
            );
            const chapter = rows[0];
            if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });

            if (!(await canAccess(session?.user, 'chapter', chapter as AccessItem))) {
                // Unpublished novels don't exist for other users; published paid chapters are just locked
                if (chapter.content_status !== 'PUBLISHED') {
                    return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
                }
                return NextResponse.json({ ...chapter, content: null, locked: true });
            }
            const [content] = await pool.query<RowDataPacket[]>('SELECT content FROM chapters WHERE id = ?', [chapterId]);
            return NextResponse.json({ ...chapter, content: content[0]?.content ?? null, locked: false });
        }

        if (novelId) {
            const [novels] = await pool.query<RowDataPacket[]>('SELECT status, author_id FROM novels WHERE id = ?', [novelId]);
            if (!novels[0] || !canViewContent(session?.user, novels[0])) {
                return NextResponse.json({ error: 'Novel not found' }, { status: 404 });
            }
            const [rows] = await pool.query(
                `SELECT id, title, chapter_order, price, created_at
         FROM chapters
         WHERE novel_id = ?
         ORDER BY chapter_order ASC`,
                [novelId]
            );
            return NextResponse.json(rows);
        }

        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
