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
        const [requests] = await pool.query<RowDataPacket[]>(`
            SELECT wp.*, u.email 
            FROM writer_profiles wp
            JOIN users u ON wp.user_id = u.id
            WHERE wp.status = 'PENDING'
            ORDER BY wp.created_at DESC
        `);

        return NextResponse.json(requests);
    } catch (error) {
        console.error('Failed to fetch writer requests:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
