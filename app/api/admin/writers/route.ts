import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

// GET - List writer applications (optional ?status=PENDING|APPROVED|REJECTED)
export async function GET(req: Request) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const status = new URL(req.url).searchParams.get('status');
        const params: string[] = [];
        let where = '';
        if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
            where = 'WHERE wp.status = ?';
            params.push(status);
        }

        const [requests] = await pool.query<RowDataPacket[]>(`
            SELECT wp.*, u.name as user_name, u.email
            FROM writer_profiles wp
            JOIN users u ON wp.user_id = u.id
            ${where}
            ORDER BY
                CASE wp.status
                    WHEN 'PENDING' THEN 1
                    WHEN 'APPROVED' THEN 2
                    WHEN 'REJECTED' THEN 3
                END,
                wp.created_at DESC
        `, params);

        return NextResponse.json(requests);
    } catch (error) {
        console.error('Failed to fetch writer requests:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
