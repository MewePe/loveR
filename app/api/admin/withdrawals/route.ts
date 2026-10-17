import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

// GET - List author withdrawal requests, pending first
export async function GET() {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const [withdrawals] = await pool.query<RowDataPacket[]>(`
            SELECT w.*, u.name as user_name, u.email
            FROM withdrawals w
            JOIN users u ON w.user_id = u.id
            ORDER BY CASE w.status WHEN 'PENDING' THEN 1 ELSE 2 END, w.created_at DESC
            LIMIT 200
        `);
        return NextResponse.json(withdrawals);
    } catch (error) {
        console.error('Failed to fetch withdrawals:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
