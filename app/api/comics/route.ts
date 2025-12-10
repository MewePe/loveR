import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const status = searchParams.get('status') || 'PUBLISHED';

    let query = `
    SELECT c.*, u.name as author_name, cat.name as category_name 
    FROM comics c
    LEFT JOIN users u ON c.author_id = u.id
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.status = ?
  `;
    const params: any[] = [status];

    if (categoryId) {
        query += ` AND c.category_id = ?`;
        params.push(categoryId);
    }

    if (search) {
        query += ` AND (c.title LIKE ? OR c.description LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY c.created_at DESC`;

    try {
        const [rows] = await pool.query(query, params);
        return NextResponse.json(rows);
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID from DB
    const [users] = await pool.query<RowDataPacket[]>('SELECT id, role FROM users WHERE email = ?', [session.user.email]);
    const user = users[0];

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has AUTHOR or ADMIN role
    if (user.role !== 'AUTHOR' && user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'คุณต้องเป็นนักเขียนเพื่อสร้างการ์ตูน กรุณาสมัครเป็นนักเขียนก่อน' }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, coverImage, categoryId } = body;
    const id = uuidv4();

    const finalCategoryId = categoryId && categoryId !== '' ? categoryId : null;

    try {
        await pool.query(
            `INSERT INTO comics (id, title, description, cover_image, category_id, author_id, status) 
       VALUES (?, ?, ?, ?, ?, ?, 'DRAFT')`,
            [id, title, description, coverImage || null, finalCategoryId, user.id]
        );

        return NextResponse.json({ id, title, status: 'DRAFT' });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to create comic' }, { status: 500 });
    }
}
