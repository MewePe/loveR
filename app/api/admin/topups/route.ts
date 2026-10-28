import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { listFilters } from '@/lib/adminLog';

// GET - List coin top-up requests, pending first.
// ?status=PENDING|APPROVED|REJECTED&from=YYYY-MM-DD&to=YYYY-MM-DD (by request date, `to` inclusive)
export async function GET(req: Request) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    try {
        const { where, params } = listFilters(new URL(req.url).searchParams, 't');
        const [topups] = await pool.query<RowDataPacket[]>(`
            SELECT t.*, u.name as user_name, u.email
            FROM coin_topups t
            JOIN users u ON t.user_id = u.id
            ${where}
            ORDER BY CASE t.status WHEN 'PENDING' THEN 1 ELSE 2 END, t.created_at DESC
            LIMIT 200
        `, params);
        return NextResponse.json(topups);
    } catch (error) {
        console.error('Failed to fetch top-ups:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
