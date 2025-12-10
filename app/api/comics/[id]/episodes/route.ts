import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

// GET - Fetch all episodes for a comic
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: comicId } = await params;

    try {
        const [episodes] = await pool.query<RowDataPacket[]>(
            `SELECT e.*, 
             (SELECT COUNT(*) FROM comic_pages WHERE episode_id = e.id) as page_count 
             FROM comic_episodes e 
             WHERE e.comic_id = ? 
             ORDER BY e.episode_order ASC, e.created_at ASC`,
            [comicId]
        );
        return NextResponse.json(episodes);
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST - Create a new episode
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: comicId } = await params;
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
        return NextResponse.json({ error: 'Comic not found or not authorized' }, { status: 404 });
    }

    const body = await req.json();
    const { title, pages } = body;
    const episodeId = uuidv4();

    // Get next episode order
    const [orderResult] = await pool.query<RowDataPacket[]>(
        'SELECT COALESCE(MAX(episode_order), 0) + 1 as next_order FROM comic_episodes WHERE comic_id = ?',
        [comicId]
    );
    const nextOrder = orderResult[0].next_order;

    try {
        // Create episode
        await pool.query(
            'INSERT INTO comic_episodes (id, title, episode_order, comic_id) VALUES (?, ?, ?, ?)',
            [episodeId, title, nextOrder, comicId]
        );

        // Add pages if provided
        if (pages && pages.length > 0) {
            for (let i = 0; i < pages.length; i++) {
                const pageId = uuidv4();
                await pool.query(
                    'INSERT INTO comic_pages (id, image_url, page_order, episode_id) VALUES (?, ?, ?, ?)',
                    [pageId, pages[i], i + 1, episodeId]
                );
            }
        }

        return NextResponse.json({ id: episodeId, title, episode_order: nextOrder });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to create episode' }, { status: 500 });
    }
}
