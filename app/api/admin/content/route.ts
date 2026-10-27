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
            `SELECT id, title, status, created_at, author_id FROM ${table} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        // Fetch author names
        for (const item of items) {
            const [users] = await pool.query<RowDataPacket[]>('SELECT name FROM users WHERE id = ?', [item.author_id]);
            item.author_name = users[0]?.name || 'Unknown';
        }

        return NextResponse.json(items);
    } catch (error) {
        console.error('Failed to fetch content:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
