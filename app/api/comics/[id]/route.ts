import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { AUTHOR_SETTABLE_STATUSES, canViewContent } from '@/lib/visibility';

// GET - Fetch single comic
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        const [comics] = await pool.query<RowDataPacket[]>(
            `SELECT c.*, u.name as author_name, cat.name as category_name 
             FROM comics c 
             LEFT JOIN users u ON c.author_id = u.id 
             LEFT JOIN categories cat ON c.category_id = cat.id 
             WHERE c.id = ?`,
            [id]
        );

        const session = await auth();
        if (!comics[0] || !canViewContent(session?.user, comics[0])) {
            return NextResponse.json({ error: 'Comic not found' }, { status: 404 });
        }

        return NextResponse.json(comics[0]);
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [users] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [session.user.email]);
    if (!users[0]) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userId = users[0].id;

    const [comics] = await pool.query<RowDataPacket[]>('SELECT * FROM comics WHERE id = ? AND author_id = ?', [id, userId]);
    if (!comics[0]) {
        return NextResponse.json({ error: 'Comic not found or not authorized' }, { status: 404 });
    }

    const body = await req.json();
    const { title, description, status, categoryId, coverImage } = body;

    if (status !== undefined) {
        if (comics[0].status === 'BANNED') {
            return NextResponse.json({ error: 'การ์ตูนนี้ถูกระงับโดยผู้ดูแล ไม่สามารถเปลี่ยนสถานะได้' }, { status: 403 });
        }
        if (!(AUTHOR_SETTABLE_STATUSES as readonly string[]).includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }
    }

    try {
        const updates: string[] = [];
        const values: any[] = [];

        if (title !== undefined) { updates.push('title = ?'); values.push(title); }
        if (description !== undefined) { updates.push('description = ?'); values.push(description); }
        if (status !== undefined) { updates.push('status = ?'); values.push(status); }
        if (categoryId !== undefined) { updates.push('category_id = ?'); values.push(categoryId || null); }
        if (coverImage !== undefined) { updates.push('cover_image = ?'); values.push(coverImage); }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        values.push(id);
        await pool.query(`UPDATE comics SET ${updates.join(', ')} WHERE id = ?`, values);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to update comic' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [users] = await pool.query<RowDataPacket[]>('SELECT id, role FROM users WHERE email = ?', [session.user.email]);
    if (!users[0]) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const user = users[0];

    const [comics] = await pool.query<RowDataPacket[]>('SELECT * FROM comics WHERE id = ?', [id]);
    if (!comics[0]) {
        return NextResponse.json({ error: 'Comic not found' }, { status: 404 });
    }

    if (comics[0].author_id !== user.id && user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    try {
        // Delete episodes first
        await pool.query('DELETE FROM comic_episodes WHERE comic_id = ?', [id]);
        // Delete comic
        await pool.query('DELETE FROM comics WHERE id = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to delete comic' }, { status: 500 });
    }
}
