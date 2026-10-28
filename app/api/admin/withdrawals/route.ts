import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { listFilters } from '@/lib/adminLog';

// GET - List author withdrawal requests, pending first.
// ?status=PENDING|APPROVED|REJECTED&from=YYYY-MM-DD&to=YYYY-MM-DD (by request date, `to` inclusive)
export async function GET(req: Request) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    try {
        const { where, params } = listFilters(new URL(req.url).searchParams, 'w');
        const [withdrawals] = await pool.query<RowDataPacket[]>(`
            SELECT w.*, u.name as user_name, u.email
            FROM withdrawals w
            JOIN users u ON w.user_id = u.id
            ${where}
            ORDER BY CASE w.status WHEN 'PENDING' THEN 1 ELSE 2 END, w.created_at DESC
            LIMIT 200
        `, params);
        return NextResponse.json(withdrawals);
    } catch (error) {
        console.error('Failed to fetch withdrawals:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
