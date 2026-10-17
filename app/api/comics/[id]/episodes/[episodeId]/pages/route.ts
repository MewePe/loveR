import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { canAccess } from '@/lib/coins';

type Params = { params: Promise<{ id: string; episodeId: string }> };

// GET - Fetch all pages for an episode (empty + locked for paid episodes the viewer hasn't bought)
export async function GET(_req: Request, { params }: Params) {
    const { id: comicId, episodeId } = await params;

    try {
        const [episodes] = await pool.query<RowDataPacket[]>(
            'SELECT e.id, e.price, c.author_id FROM comic_episodes e JOIN comics c ON e.comic_id = c.id WHERE e.id = ? AND e.comic_id = ?',
            [episodeId, comicId]
        );
        if (!episodes[0]) {
            return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
        }
        const session = await auth();
        if (!(await canAccess(session?.user, 'episode', episodes[0] as { id: string; price: number; author_id: string }))) {
            return NextResponse.json({ error: 'Episode is locked', locked: true }, { status: 402 });
        }

        const [pages] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM comic_pages WHERE episode_id = ? ORDER BY page_order ASC',
            [episodeId]
        );
        return NextResponse.json(pages);
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST - Add pages to an episode
export async function POST(req: Request, { params }: Params) {
    const { id: comicId, episodeId } = await params;
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [users] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE email = ?',
        [session.user.email]
    );
    if (!users[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const userId = users[0].id;

    // Verify comic ownership
    const [comics] = await pool.query<RowDataPacket[]>(
        // Also verify the episode belongs to this comic, so authors can't edit other comics' episodes
        'SELECT c.id FROM comics c JOIN comic_episodes e ON e.comic_id = c.id WHERE c.id = ? AND c.author_id = ? AND e.id = ?',
        [comicId, userId, episodeId]
    );
    if (!comics[0]) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const body = await req.json();
    const { imageUrls }: { imageUrls: string[] } = body;

    if (!imageUrls || imageUrls.length === 0) {
        return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    try {
        // Get current max page_order
        const [orderResult] = await pool.query<RowDataPacket[]>(
            'SELECT COALESCE(MAX(page_order), 0) as max_order FROM comic_pages WHERE episode_id = ?',
            [episodeId]
        );
        let nextOrder: number = orderResult[0].max_order + 1;

        const insertedIds: string[] = [];
        for (const url of imageUrls) {
            const pageId = uuidv4();
            await pool.query(
                'INSERT INTO comic_pages (id, image_url, page_order, episode_id) VALUES (?, ?, ?, ?)',
                [pageId, url, nextOrder++, episodeId]
            );
            insertedIds.push(pageId);
        }

        return NextResponse.json({ success: true, count: insertedIds.length });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to add pages' }, { status: 500 });
    }
}

// PATCH - Reorder pages (accepts array of { id, page_order })
export async function PATCH(req: Request, { params }: Params) {
    const { id: comicId, episodeId } = await params;
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [users] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE email = ?',
        [session.user.email]
    );
    if (!users[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const userId = users[0].id;

    const [comics] = await pool.query<RowDataPacket[]>(
        // Also verify the episode belongs to this comic, so authors can't edit other comics' episodes
        'SELECT c.id FROM comics c JOIN comic_episodes e ON e.comic_id = c.id WHERE c.id = ? AND c.author_id = ? AND e.id = ?',
        [comicId, userId, episodeId]
    );
    if (!comics[0]) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const body = await req.json();
    const { pages }: { pages: { id: string; page_order: number }[] } = body;

    try {
        for (const page of pages) {
            await pool.query(
                'UPDATE comic_pages SET page_order = ? WHERE id = ? AND episode_id = ?',
                [page.page_order, page.id, episodeId]
            );
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to reorder pages' }, { status: 500 });
    }
}

// DELETE - Delete a specific page by pageId (passed as query param)
export async function DELETE(req: Request, { params }: Params) {
    const { id: comicId, episodeId } = await params;
    const { searchParams } = new URL(req.url);
    const pageId = searchParams.get('pageId');
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!pageId) {
        return NextResponse.json({ error: 'pageId is required' }, { status: 400 });
    }

    const [users] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE email = ?',
        [session.user.email]
    );
    if (!users[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const userId = users[0].id;

    const [comics] = await pool.query<RowDataPacket[]>(
        // Also verify the episode belongs to this comic, so authors can't edit other comics' episodes
        'SELECT c.id FROM comics c JOIN comic_episodes e ON e.comic_id = c.id WHERE c.id = ? AND c.author_id = ? AND e.id = ?',
        [comicId, userId, episodeId]
    );
    if (!comics[0]) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    try {
        await pool.query(
            'DELETE FROM comic_pages WHERE id = ? AND episode_id = ?',
            [pageId, episodeId]
        );

        // Re-number remaining pages sequentially
        const [remaining] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM comic_pages WHERE episode_id = ? ORDER BY page_order ASC',
            [episodeId]
        );
        for (let i = 0; i < remaining.length; i++) {
            await pool.query(
                'UPDATE comic_pages SET page_order = ? WHERE id = ?',
                [i + 1, remaining[i].id]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to delete page' }, { status: 500 });
    }
}
