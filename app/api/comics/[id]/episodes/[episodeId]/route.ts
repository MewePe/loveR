import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

// GET - Fetch single episode with pages
export async function GET(req: Request, { params }: { params: Promise<{ id: string; episodeId: string }> }) {
    const { episodeId } = await params;

    try {
        const [episodes] = await pool.query<RowDataPacket[]>('SELECT * FROM comic_episodes WHERE id = ?', [episodeId]);
        if (!episodes[0]) {
            return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
        }

        const [pages] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM comic_pages WHERE episode_id = ? ORDER BY page_order ASC',
            [episodeId]
        );

        return NextResponse.json({ ...episodes[0], pages });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PATCH - Update episode
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; episodeId: string }> }) {
    const { id: comicId, episodeId } = await params;
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [users] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [session.user.email]);
    if (!users[0]) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userId = users[0].id;

    // Check comic ownership
    const [comics] = await pool.query<RowDataPacket[]>('SELECT * FROM comics WHERE id = ? AND author_id = ?', [comicId, userId]);
    if (!comics[0]) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await req.json();
    const { title, pages } = body;

    try {
        // Update episode title
        if (title) {
            await pool.query('UPDATE comic_episodes SET title = ? WHERE id = ?', [title, episodeId]);
        }

        // Add new pages if provided
        if (pages && pages.length > 0) {
            // Get current max page order
            const [orderResult] = await pool.query<RowDataPacket[]>(
                'SELECT COALESCE(MAX(page_order), 0) as max_order FROM comic_pages WHERE episode_id = ?',
                [episodeId]
            );
            let nextOrder = orderResult[0].max_order + 1;

            for (const pageUrl of pages) {
                const pageId = uuidv4();
                await pool.query(
                    'INSERT INTO comic_pages (id, image_url, page_order, episode_id) VALUES (?, ?, ?, ?)',
                    [pageId, pageUrl, nextOrder++, episodeId]
                );
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to update episode' }, { status: 500 });
    }
}

// DELETE - Delete episode
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; episodeId: string }> }) {
    const { id: comicId, episodeId } = await params;
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [users] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [session.user.email]);
    if (!users[0]) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userId = users[0].id;

    // Check comic ownership
    const [comics] = await pool.query<RowDataPacket[]>('SELECT * FROM comics WHERE id = ? AND author_id = ?', [comicId, userId]);
    if (!comics[0]) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    try {
        // Pages will be deleted automatically due to CASCADE
        await pool.query('DELETE FROM comic_episodes WHERE id = ?', [episodeId]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to delete episode' }, { status: 500 });
    }
}
