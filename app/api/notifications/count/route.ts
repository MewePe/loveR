import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

// GET /api/notifications/count — unread count only; the Navbar polls this every 30 seconds
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0',
            [session.user.id]
        );
        return NextResponse.json({ unread: Number(rows[0].unread) });
    } catch (error) {
        console.error('Error counting notifications:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
