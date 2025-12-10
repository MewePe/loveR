import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

// GET - Fetch all chapters for a novel
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: novelId } = await params;

    try {
        const [chapters] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM chapters WHERE novel_id = ? ORDER BY chapter_order ASC, created_at ASC',
            [novelId]
        );
        return NextResponse.json(chapters);
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST - Create a new chapter
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: novelId } = await params;
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and verify ownership
    const [users] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [session.user.email]);
    if (!users[0]) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userId = users[0].id;

    // Check novel ownership
    const [novels] = await pool.query<RowDataPacket[]>('SELECT * FROM novels WHERE id = ? AND author_id = ?', [novelId, userId]);
    if (!novels[0]) {
        return NextResponse.json({ error: 'Novel not found or not authorized' }, { status: 404 });
    }

    const body = await req.json();
    const { title, content } = body;
    const id = uuidv4();

    // Get next chapter order
    const [orderResult] = await pool.query<RowDataPacket[]>(
        'SELECT COALESCE(MAX(chapter_order), 0) + 1 as next_order FROM chapters WHERE novel_id = ?',
        [novelId]
    );
    const nextOrder = orderResult[0].next_order;

    try {
        await pool.query(
            'INSERT INTO chapters (id, title, content, chapter_order, novel_id) VALUES (?, ?, ?, ?, ?)',
            [id, title, content, nextOrder, novelId]
        );

        return NextResponse.json({ id, title, chapter_order: nextOrder });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to create chapter' }, { status: 500 });
    }
}
