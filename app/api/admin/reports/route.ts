import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const [reports] = await pool.query<RowDataPacket[]>(`
            SELECT r.id, r.reason, r.status, r.created_at, r.target_type, r.target_id,
                   u.name as reporter_name,
                   COALESCE(n.title, c.title) as target_title
            FROM reports r
            LEFT JOIN users u ON r.reporter_id = u.id
            LEFT JOIN novels n ON r.target_type = 'NOVEL' AND r.target_id = n.id
            LEFT JOIN comics c ON r.target_type = 'COMIC' AND r.target_id = c.id
            ORDER BY r.created_at DESC
        `);

        return NextResponse.json(reports);
    } catch (error) {
        console.error('Failed to fetch reports:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
