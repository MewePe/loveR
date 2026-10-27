import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') || 'novels';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = 20;
        const offset = (page - 1) * limit;

        const table = type === 'comics' ? 'comics' : 'novels';

        const [items] = await pool.query<RowDataPacket[]>(
            `SELECT s.id, s.title, s.status, s.created_at, s.author_id, u.name AS author_name, u.username AS author_username
             FROM ${table} s LEFT JOIN users u ON u.id = s.author_id
             ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        return NextResponse.json(items);
    } catch (error) {
        console.error('Failed to fetch content:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
