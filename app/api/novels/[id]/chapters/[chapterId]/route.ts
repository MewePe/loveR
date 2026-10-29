import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { parsePrice } from '@/lib/coins';
import { mockDirective, moderateItem } from '@/lib/moderation';

// PATCH - Update a chapter. A new title or text is checked again (lib/moderation.ts) and hidden until it passes.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
    const { id: novelId, chapterId } = await params;
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
        return NextResponse.json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' }, { status: 403 });
    }

    const body = await req.json();
    const { title, content } = body;
    if (typeof title !== 'string' || !title.trim() || typeof content !== 'string') {
        return NextResponse.json({ error: 'กรุณากรอกชื่อบทและเนื้อหา' }, { status: 400 });
    }
    const price = parsePrice(body.price);
    if (price === null) {
        return NextResponse.json({ error: 'ราคาต้องเป็นจำนวนเต็ม 0-10000 เหรียญ' }, { status: 400 });
    }

    const [current] = await pool.query<RowDataPacket[]>('SELECT title, content FROM chapters WHERE id = ? AND novel_id = ?', [chapterId, novelId]);
    if (!current[0]) {
        return NextResponse.json({ error: 'ไม่พบบทนี้' }, { status: 404 });
    }

    try {
        await pool.query(
            'UPDATE chapters SET title = ?, content = ?, price = ? WHERE id = ? AND novel_id = ?',
            [title, content, price, chapterId, novelId]
        );
        // Only a price change needs no new check
        const changed = title !== current[0].title || content !== (current[0].content ?? '');
        const moderation = changed
            ? await moderateItem(
                { itemType: 'chapter', itemId: chapterId, title, story: novels[0] as { id: string; title: string; author_id: string; status: string; is_mature: number } },
                { text: content }, 'EDIT', mockDirective(req)
            )
            : null;

        return NextResponse.json({ success: true, moderation });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'แก้ไขบทไม่สำเร็จ' }, { status: 500 });
    }
}

// DELETE - Delete a chapter
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
    const { id: novelId, chapterId } = await params;
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
        return NextResponse.json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' }, { status: 403 });
    }

    try {
        await pool.query('DELETE FROM chapters WHERE id = ? AND novel_id = ?', [chapterId, novelId]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'ลบบทไม่สำเร็จ' }, { status: 500 });
    }
}
