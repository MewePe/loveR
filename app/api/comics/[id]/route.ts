import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { AUTHOR_SETTABLE_STATUSES, canViewContent } from '@/lib/visibility';
import { isPublicUploadUrl } from '@/lib/upload';
import { categoryIdsFromBody, getCategoriesFor, parseCategoryIds, setStoryCategories } from '@/lib/categories';
import { notifyNewStory } from '@/lib/notifications';

// GET - Fetch single comic
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        const [comics] = await pool.query<RowDataPacket[]>(
            `SELECT c.*, u.name as author_name
             FROM comics c 
             LEFT JOIN users u ON c.author_id = u.id 
             WHERE c.id = ?`,
            [id]
        );

        const session = await auth();
        if (!comics[0] || !canViewContent(session?.user, comics[0])) {
            return NextResponse.json({ error: 'ไม่พบการ์ตูนเรื่องนี้' }, { status: 404 });
        }

        const categories = (await getCategoriesFor('comic', [id])).get(id) ?? [];
        return NextResponse.json({ ...comics[0], categories });
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

    const [users] = await pool.query<RowDataPacket[]>('SELECT id, name FROM users WHERE email = ?', [session.user.email]);
    if (!users[0]) {
        return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
    }
    const userId = users[0].id;

    const [comics] = await pool.query<RowDataPacket[]>('SELECT * FROM comics WHERE id = ? AND author_id = ?', [id, userId]);
    if (!comics[0]) {
        return NextResponse.json({ error: 'ไม่พบการ์ตูนเรื่องนี้หรือไม่มีสิทธิ์แก้ไข' }, { status: 404 });
    }

    const body = await req.json();
    const { title, description, status, coverImage, isCompleted, isMature } = body;
    if ((isCompleted !== undefined && typeof isCompleted !== 'boolean') || (isMature !== undefined && typeof isMature !== 'boolean')) {
        return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }
    if (coverImage && !isPublicUploadUrl(coverImage)) {
        return NextResponse.json({ error: 'รูปปกไม่ถูกต้อง' }, { status: 400 });
    }

    const rawCategoryIds = categoryIdsFromBody(body);
    let categoryIds: string[] | null = null;
    if (rawCategoryIds !== undefined) {
        const parsed = await parseCategoryIds(rawCategoryIds);
        if ('error' in parsed) {
            return NextResponse.json({ error: parsed.error }, { status: 400 });
        }
        categoryIds = parsed.ids;
    }

    // An 18+ story can't go back to ทั่วไป once 18+ content in it passed the check or an admin confirmed it
    // (lib/moderation.ts); otherwise that content would be shown without the age gate
    if (isMature === false && comics[0].is_mature) {
        const [confirmed] = await pool.query<RowDataPacket[]>(
            `SELECT 1 FROM moderation_checks WHERE story_id = ? AND episode_id IS NOT NULL AND verdict = 'MATURE'
             AND status IN ('CLEARED', 'APPROVED') LIMIT 1`,
            [id]
        );
        if (confirmed.length > 0) {
            return NextResponse.json({ error: 'เรื่องนี้มีตอนที่ผ่านการตรวจว่าเป็นเนื้อหา 18+ จึงเปลี่ยนเป็นระดับทั่วไปไม่ได้ กรุณาติดต่อแอดมิน' }, { status: 400 });
        }
    }

    if (status !== undefined) {
        if (comics[0].status === 'BANNED') {
            return NextResponse.json({ error: 'การ์ตูนนี้ถูกระงับโดยผู้ดูแล ไม่สามารถเปลี่ยนสถานะได้' }, { status: 403 });
        }
        if (!(AUTHOR_SETTABLE_STATUSES as readonly string[]).includes(status)) {
            return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
        }
    }

    const conn = await pool.getConnection();
    try {
        const updates: string[] = [];
        const values: (string | number | null)[] = [];

        if (title !== undefined) { updates.push('title = ?'); values.push(title); }
        if (description !== undefined) { updates.push('description = ?'); values.push(description); }
        if (status !== undefined) { updates.push('status = ?'); values.push(status); }
        if (coverImage !== undefined) { updates.push('cover_image = ?'); values.push(coverImage); }
        if (isCompleted !== undefined) { updates.push('is_completed = ?'); values.push(isCompleted ? 1 : 0); }
        if (isMature !== undefined) { updates.push('is_mature = ?'); values.push(isMature ? 1 : 0); }

        if (updates.length === 0 && categoryIds === null) {
            return NextResponse.json({ error: 'ไม่มีข้อมูลที่ต้องแก้ไข' }, { status: 400 });
        }

        await conn.beginTransaction();
        if (updates.length > 0) {
            values.push(id);
            await conn.query(`UPDATE comics SET ${updates.join(', ')} WHERE id = ?`, values);
        }
        if (categoryIds !== null) await setStoryCategories(conn, 'comic', id, categoryIds);
        await conn.commit();

        // First time out of draft: tell the author's followers
        if (status === 'PUBLISHED' && comics[0].status === 'DRAFT') {
            await notifyNewStory('comic', { id, title: title ?? comics[0].title, author_id: userId }, users[0].name);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        await conn.rollback();
        console.error('Database error:', error);
        return NextResponse.json({ error: 'แก้ไขการ์ตูนไม่สำเร็จ' }, { status: 500 });
    } finally {
        conn.release();
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const [users] = await pool.query<RowDataPacket[]>('SELECT id, role FROM users WHERE email = ?', [session.user.email]);
    if (!users[0]) {
        return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
    }
    const user = users[0];

    const [comics] = await pool.query<RowDataPacket[]>('SELECT * FROM comics WHERE id = ?', [id]);
    if (!comics[0]) {
        return NextResponse.json({ error: 'ไม่พบการ์ตูนเรื่องนี้' }, { status: 404 });
    }

    if (comics[0].author_id !== user.id && user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' }, { status: 403 });
    }

    try {
        // Delete episodes first
        await pool.query('DELETE FROM comic_episodes WHERE comic_id = ?', [id]);
        // Delete comic
        await pool.query('DELETE FROM comics WHERE id = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'ลบการ์ตูนไม่สำเร็จ' }, { status: 500 });
    }
}
