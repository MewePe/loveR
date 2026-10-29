import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { isPublicUploadUrl } from '@/lib/upload';
import { isSortKey, listStories, SEARCH_SORTS } from '@/lib/ranking';
import { categoryIdsFromBody, categoryIdsFromQuery, parseCategoryIds, setStoryCategories } from '@/lib/categories';

// GET ?categoryId=a&categoryId=b (or a,b; stories with all of them)&search=&sort=newest|views|rating — public listing,
// always PUBLISHED only
// (authors use /api/author/comics, admins /api/admin/content). Each row includes rating_avg, rating_count, sales, bookmarks.
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const sort = searchParams.get('sort');

    try {
        const rows = await listStories('comic', {
            categoryIds: categoryIdsFromQuery(searchParams),
            search: searchParams.get('search'),
            sort: isSortKey(SEARCH_SORTS, sort) ? sort : 'newest',
        });
        return NextResponse.json(rows);
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    // Get user ID from DB
    const [users] = await pool.query<RowDataPacket[]>('SELECT id, role FROM users WHERE email = ?', [session.user.email]);
    const user = users[0];

    if (!user) {
        return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
    }

    // Check if user has AUTHOR or ADMIN role
    if (user.role !== 'AUTHOR' && user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'คุณต้องเป็นนักเขียนเพื่อสร้างการ์ตูน กรุณาสมัครเป็นนักเขียนก่อน' }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, coverImage, isCompleted, isMature } = body;
    if (coverImage && !isPublicUploadUrl(coverImage)) {
        return NextResponse.json({ error: 'รูปปกไม่ถูกต้อง' }, { status: 400 });
    }
    const parsed = await parseCategoryIds(categoryIdsFromBody(body) ?? []);
    if ('error' in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    // The author must choose the content level (ทั่วไป or 18+); every chapter/episode is checked against it
    if (typeof isMature !== 'boolean') {
        return NextResponse.json({ error: 'กรุณาเลือกระดับเนื้อหา: ทั่วไป หรือ 18+' }, { status: 400 });
    }
    if (isCompleted !== undefined && typeof isCompleted !== 'boolean') {
        return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }
    const id = uuidv4();

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(
            `INSERT INTO comics (id, title, description, cover_image, is_completed, is_mature, author_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT')`,
            [id, title, description, coverImage || null, isCompleted === true ? 1 : 0, isMature ? 1 : 0, user.id]
        );
        await setStoryCategories(conn, 'comic', id, parsed.ids);
        await conn.commit();

        return NextResponse.json({ id, title, status: 'DRAFT' });
    } catch (error) {
        await conn.rollback();
        console.error('Database error:', error);
        return NextResponse.json({ error: 'สร้างการ์ตูนไม่สำเร็จ' }, { status: 500 });
    } finally {
        conn.release();
    }
}
