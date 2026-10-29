import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { parsePrice } from '@/lib/coins';
import { canViewContent, isOwnerOrAdmin } from '@/lib/visibility';
import { mockDirective, moderateItem } from '@/lib/moderation';

// GET - Fetch all chapters for a novel. Content is only included for the author/admin (editor view), who also get
// every chapter with its moderation_status (and the admin's reason when rejected); readers only get APPROVED ones.
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
            isOwner
                ? `SELECT c.*, (SELECT m.review_note FROM moderation_checks m WHERE m.chapter_id = c.id AND m.status = 'REJECTED'
                                ORDER BY m.created_at DESC LIMIT 1) AS moderation_note
                   FROM chapters c WHERE c.novel_id = ? ORDER BY c.chapter_order ASC, c.created_at ASC`
                : `SELECT id, title, chapter_order, novel_id, views, price, created_at, updated_at
                   FROM chapters WHERE novel_id = ? AND moderation_status = 'APPROVED' ORDER BY chapter_order ASC, created_at ASC`,
            [novelId]
        );
        return NextResponse.json(chapters);
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}

// POST - Create a new chapter. It is saved hidden (PENDING) and published once the content check passes
// (lib/moderation.ts); the response's `moderation` says what happened.
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
    if (typeof title !== 'string' || !title.trim() || (content !== undefined && content !== null && typeof content !== 'string')) {
        return NextResponse.json({ error: 'กรุณากรอกชื่อบทและเนื้อหา' }, { status: 400 });
    }
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
            `INSERT INTO chapters (id, title, content, chapter_order, novel_id, price, moderation_status) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
            [id, title, content ?? '', nextOrder, novelId, price]
        );
        // Readers are notified about the chapter when it is published (moderateItem / admin approval)
        const moderation = await moderateItem(
            { itemType: 'chapter', itemId: id, title, story: novels[0] as { id: string; title: string; author_id: string; status: string; is_mature: number } },
            { text: content ?? '' }, 'SUBMIT', mockDirective(req)
        );

        return NextResponse.json({ id, title, chapter_order: nextOrder, moderation });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'สร้างบทไม่สำเร็จ' }, { status: 500 });
    }
}
