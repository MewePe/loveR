import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { parsePrice } from '@/lib/coins';
import { notifyNewItem } from '@/lib/notifications';
import { canViewContent, isOwnerOrAdmin } from '@/lib/visibility';

// GET - Fetch all chapters for a novel. Content is only included for the author/admin (editor view).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: novelId } = await params;

    try {
        const session = await auth();
        const [novels] = await pool.query<RowDataPacket[]>('SELECT status, author_id FROM novels WHERE id = ?', [novelId]);
        if (!novels[0] || !canViewContent(session?.user, novels[0])) {
            return NextResponse.json({ error: 'ไม่พบนิยายเรื่องนี้' }, { status: 404 });
        }
        const isOwner = isOwnerOrAdmin(session?.user, novels[0].author_id);

        const [chapters] = await pool.query<RowDataPacket[]>(
            `SELECT ${isOwner ? '*' : 'id, title, chapter_order, novel_id, views, price, created_at, updated_at'}
             FROM chapters WHERE novel_id = ? ORDER BY chapter_order ASC, created_at ASC`,
            [novelId]
        );
        return NextResponse.json(chapters);
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}

// POST - Create a new chapter
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: novelId } = await params;
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    // Get user and verify ownership
    const [users] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [session.user.email]);
    if (!users[0]) {
        return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
    }
    const userId = users[0].id;

    // Check novel ownership
    const [novels] = await pool.query<RowDataPacket[]>('SELECT * FROM novels WHERE id = ? AND author_id = ?', [novelId, userId]);
    if (!novels[0]) {
        return NextResponse.json({ error: 'ไม่พบนิยายเรื่องนี้หรือไม่มีสิทธิ์แก้ไข' }, { status: 404 });
    }

    const body = await req.json();
    const { title, content } = body;
    const price = parsePrice(body.price);
    if (price === null) {
        return NextResponse.json({ error: 'ราคาต้องเป็นจำนวนเต็ม 0-10000 เหรียญ' }, { status: 400 });
    }
    const id = uuidv4();

    // Get next chapter order
    const [orderResult] = await pool.query<RowDataPacket[]>(
        'SELECT COALESCE(MAX(chapter_order), 0) + 1 as next_order FROM chapters WHERE novel_id = ?',
        [novelId]
    );
    const nextOrder = orderResult[0].next_order;

    try {
        await pool.query(
            'INSERT INTO chapters (id, title, content, chapter_order, novel_id, price) VALUES (?, ?, ?, ?, ?, ?)',
            [id, title, content, nextOrder, novelId, price]
        );
        await notifyNewItem('novel', novels[0] as { id: string; title: string; author_id: string; status: string }, id, title);

        return NextResponse.json({ id, title, chapter_order: nextOrder });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'สร้างบทไม่สำเร็จ' }, { status: 500 });
    }
}
