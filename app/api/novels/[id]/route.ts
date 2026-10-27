import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { AUTHOR_SETTABLE_STATUSES, canViewContent } from '@/lib/visibility';
import { isPublicUploadUrl } from '@/lib/upload';

// GET - Fetch single novel
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        const [novels] = await pool.query<RowDataPacket[]>(
            `SELECT n.*, u.name as author_name, c.name as category_name 
             FROM novels n 
             LEFT JOIN users u ON n.author_id = u.id 
             LEFT JOIN categories c ON n.category_id = c.id 
             WHERE n.id = ?`,
            [id]
        );

        const session = await auth();
        if (!novels[0] || !canViewContent(session?.user, novels[0])) {
            return NextResponse.json({ error: 'ไม่พบนิยายเรื่องนี้' }, { status: 404 });
        }

        return NextResponse.json(novels[0]);
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    // Get user
    const [users] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [session.user.email]);
    if (!users[0]) {
        return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
    }
    const userId = users[0].id;

    // Check ownership
    const [novels] = await pool.query<RowDataPacket[]>('SELECT * FROM novels WHERE id = ? AND author_id = ?', [id, userId]);
    if (!novels[0]) {
        return NextResponse.json({ error: 'ไม่พบนิยายเรื่องนี้หรือไม่มีสิทธิ์แก้ไข' }, { status: 404 });
    }

    const body = await req.json();
    const { title, description, status, categoryId, coverImage } = body;
    if (coverImage && !isPublicUploadUrl(coverImage)) {
        return NextResponse.json({ error: 'รูปปกไม่ถูกต้อง' }, { status: 400 });
    }

    if (status !== undefined) {
        if (novels[0].status === 'BANNED') {
            return NextResponse.json({ error: 'นิยายนี้ถูกระงับโดยผู้ดูแล ไม่สามารถเปลี่ยนสถานะได้' }, { status: 403 });
        }
        if (!(AUTHOR_SETTABLE_STATUSES as readonly string[]).includes(status)) {
            return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
        }
    }

    try {
        const updates: string[] = [];
        const values: (string | null)[] = [];

        if (title !== undefined) { updates.push('title = ?'); values.push(title); }
        if (description !== undefined) { updates.push('description = ?'); values.push(description); }
        if (status !== undefined) { updates.push('status = ?'); values.push(status); }
        if (categoryId !== undefined) { updates.push('category_id = ?'); values.push(categoryId || null); }
        if (coverImage !== undefined) { updates.push('cover_image = ?'); values.push(coverImage); }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'ไม่มีข้อมูลที่ต้องแก้ไข' }, { status: 400 });
        }

        values.push(id);
        await pool.query(`UPDATE novels SET ${updates.join(', ')} WHERE id = ?`, values);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'แก้ไขนิยายไม่สำเร็จ' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    // Get user
    const [users] = await pool.query<RowDataPacket[]>('SELECT id, role FROM users WHERE email = ?', [session.user.email]);
    if (!users[0]) {
        return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
    }
    const user = users[0];

    // Check ownership or admin
    const [novels] = await pool.query<RowDataPacket[]>('SELECT * FROM novels WHERE id = ?', [id]);
    if (!novels[0]) {
        return NextResponse.json({ error: 'ไม่พบนิยายเรื่องนี้' }, { status: 404 });
    }

    if (novels[0].author_id !== user.id && user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' }, { status: 403 });
    }

    try {
        // Delete chapters first
        await pool.query('DELETE FROM chapters WHERE novel_id = ?', [id]);
        // Delete novel
        await pool.query('DELETE FROM novels WHERE id = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'ลบนิยายไม่สำเร็จ' }, { status: 500 });
    }
}
