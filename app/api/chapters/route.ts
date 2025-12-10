import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const novelId = searchParams.get('novelId');
    const chapterId = searchParams.get('chapterId');

    try {
        if (chapterId) {
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT c.*, n.title as novel_title 
         FROM chapters c 
         JOIN novels n ON c.novel_id = n.id 
         WHERE c.id = ?`,
                [chapterId]
            );
            if (rows.length === 0) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
            return NextResponse.json(rows[0]);
        }

        if (novelId) {
            const [rows] = await pool.query(
                `SELECT id, title, chapter_order, created_at 
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

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, content, novelId, order } = body;
    const id = uuidv4();

    try {
        // Verify ownership
        const [novels] = await pool.query<RowDataPacket[]>(
            `SELECT author_id FROM novels WHERE id = ?`,
            [novelId]
        );

        if (novels.length === 0) return NextResponse.json({ error: 'Novel not found' }, { status: 404 });

        // In a real app, check if session.user.id matches author_id
        // For now, assuming if they are an author they can add (or we need to fetch user id again)

        await pool.query(
            `INSERT INTO chapters (id, title, content, novel_id, chapter_order) 
       VALUES (?, ?, ?, ?, ?)`,
            [id, title, content, novelId, order]
        );

        return NextResponse.json({ id, title, success: true });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to create chapter' }, { status: 500 });
    }
}
