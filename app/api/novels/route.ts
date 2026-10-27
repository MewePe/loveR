import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { isPublicUploadUrl } from '@/lib/upload';
import { isSortKey, listStories, SEARCH_SORTS } from '@/lib/ranking';

// GET ?categoryId=&search=&sort=newest|views|rating — public listing, always PUBLISHED only
// (authors use /api/author/novels, admins /api/admin/content). Each row includes rating_avg, rating_count, sales, bookmarks.
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const sort = searchParams.get('sort');

    try {
        const rows = await listStories('novel', {
            categoryId: searchParams.get('categoryId'),
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
        return NextResponse.json({ error: 'คุณต้องเป็นนักเขียนเพื่อสร้างนิยาย กรุณาสมัครเป็นนักเขียนก่อน' }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, coverImage, categoryId } = body;
    if (coverImage && !isPublicUploadUrl(coverImage)) {
        return NextResponse.json({ error: 'รูปปกไม่ถูกต้อง' }, { status: 400 });
    }
    const id = uuidv4();

    // Convert empty categoryId to null
    const finalCategoryId = categoryId && categoryId !== '' ? categoryId : null;

    try {
        await pool.query(
            `INSERT INTO novels (id, title, description, cover_image, category_id, author_id, status) 
       VALUES (?, ?, ?, ?, ?, ?, 'DRAFT')`,
            [id, title, description, coverImage || null, finalCategoryId, user.id]
        );

        return NextResponse.json({ id, title, status: 'DRAFT' });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'สร้างนิยายไม่สำเร็จ' }, { status: 500 });
    }
}

