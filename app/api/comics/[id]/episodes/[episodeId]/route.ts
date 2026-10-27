import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { canAccess, parsePrice, AccessItem } from '@/lib/coins';
import { validatePageUrls } from '@/lib/upload';

// GET - Fetch single episode with pages
export async function GET(req: Request, { params }: { params: Promise<{ id: string; episodeId: string }> }) {
    const { id: comicId, episodeId } = await params;

    try {
        const [episodes] = await pool.query<RowDataPacket[]>(
            'SELECT e.*, c.author_id, c.status AS content_status FROM comic_episodes e JOIN comics c ON e.comic_id = c.id WHERE e.id = ? AND e.comic_id = ?',
            [episodeId, comicId]
        );
        if (!episodes[0]) {
            return NextResponse.json({ error: 'ไม่พบตอนนี้' }, { status: 404 });
        }

        const session = await auth();
        if (!(await canAccess(session?.user, 'episode', episodes[0] as AccessItem))) {
            // Unpublished comics don't exist for other users; published paid episodes are just locked
            if (episodes[0].content_status !== 'PUBLISHED') {
                return NextResponse.json({ error: 'ไม่พบตอนนี้' }, { status: 404 });
            }
            return NextResponse.json({ ...episodes[0], pages: [], locked: true });
        }

        const [pages] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM comic_pages WHERE episode_id = ? ORDER BY page_order ASC',
            [episodeId]
        );

        return NextResponse.json({ ...episodes[0], pages });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}

// PATCH - Update episode
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; episodeId: string }> }) {
    const { id: comicId, episodeId } = await params;
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const [users] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [session.user.email]);
    if (!users[0]) {
        return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
    }
    const userId = users[0].id;

    // Check comic ownership
    const [comics] = await pool.query<RowDataPacket[]>('SELECT * FROM comics WHERE id = ? AND author_id = ?', [comicId, userId]);
    if (!comics[0]) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' }, { status: 403 });
    }

    const [owned] = await pool.query<RowDataPacket[]>('SELECT id FROM comic_episodes WHERE id = ? AND comic_id = ?', [episodeId, comicId]);
    if (!owned[0]) {
        return NextResponse.json({ error: 'ไม่พบตอนนี้' }, { status: 404 });
    }

    const body = await req.json();
    const { title, pages } = body;
    const price = body.price === undefined ? undefined : parsePrice(body.price);
    if (price === null) {
        return NextResponse.json({ error: 'ราคาต้องเป็นจำนวนเต็ม 0-10000 เหรียญ' }, { status: 400 });
    }
    const pageError = pages === undefined ? null : validatePageUrls(pages, userId);
    if (pageError) {
        return NextResponse.json({ error: pageError }, { status: 400 });
    }

    try {
        // Update episode title
        if (title) {
            await pool.query('UPDATE comic_episodes SET title = ? WHERE id = ?', [title, episodeId]);
        }
        if (price !== undefined) {
            await pool.query('UPDATE comic_episodes SET price = ? WHERE id = ?', [price, episodeId]);
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
        return NextResponse.json({ error: 'แก้ไขตอนไม่สำเร็จ' }, { status: 500 });
    }
}

// DELETE - Delete episode
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; episodeId: string }> }) {
    const { id: comicId, episodeId } = await params;
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const [users] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [session.user.email]);
    if (!users[0]) {
        return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
    }
    const userId = users[0].id;

    // Check comic ownership
    const [comics] = await pool.query<RowDataPacket[]>('SELECT * FROM comics WHERE id = ? AND author_id = ?', [comicId, userId]);
    if (!comics[0]) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' }, { status: 403 });
    }

    try {
        // Pages will be deleted automatically due to CASCADE
        await pool.query('DELETE FROM comic_episodes WHERE id = ? AND comic_id = ?', [episodeId, comicId]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'ลบตอนไม่สำเร็จ' }, { status: 500 });
    }
}
