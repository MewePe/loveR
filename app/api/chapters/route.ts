import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { canAccess } from '@/lib/coins';

// Chapters are created via POST /api/novels/[id]/chapters (which checks ownership)
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const novelId = searchParams.get('novelId');
    const chapterId = searchParams.get('chapterId');

    try {
        if (chapterId) {
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT c.*, n.title as novel_title, n.author_id
         FROM chapters c
         JOIN novels n ON c.novel_id = n.id
         WHERE c.id = ?`,
                [chapterId]
            );
            if (rows.length === 0) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });

            const chapter = rows[0];
            const session = await auth();
            if (!(await canAccess(session?.user, 'chapter', chapter as { id: string; price: number; author_id: string }))) {
                return NextResponse.json({ ...chapter, content: null, locked: true });
            }
            return NextResponse.json({ ...chapter, locked: false });
        }

        if (novelId) {
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
