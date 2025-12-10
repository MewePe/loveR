import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

// PATCH - Update a chapter
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
    const { id: novelId, chapterId } = await params;
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
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await req.json();
    const { title, content } = body;

    try {
        await pool.query(
            'UPDATE chapters SET title = ?, content = ? WHERE id = ? AND novel_id = ?',
            [title, content, chapterId, novelId]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to update chapter' }, { status: 500 });
    }
}

// DELETE - Delete a chapter
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
    const { id: novelId, chapterId } = await params;
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
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    try {
        await pool.query('DELETE FROM chapters WHERE id = ? AND novel_id = ?', [chapterId, novelId]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to delete chapter' }, { status: 500 });
    }
}
