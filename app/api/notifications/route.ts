import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

const PAGE_SIZE = 20;

// GET /api/notifications?page=1 (or ?limit=10 for the Navbar dropdown) — the user's notifications, newest first,
// plus how many are unread. Rows are created by lib/notifications.ts.
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const limit = Math.min(PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') || String(PAGE_SIZE), 10) || PAGE_SIZE));
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

    try {
        const [items] = await pool.query<RowDataPacket[]>(
            `SELECT id, type, message, link, is_read, created_at FROM notifications
             WHERE user_id = ? ORDER BY created_at DESC, id LIMIT ? OFFSET ?`,
            [session.user.id, limit, (page - 1) * limit]
        );
        const [counts] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) AS total, COALESCE(SUM(is_read = 0), 0) AS unread FROM notifications WHERE user_id = ?',
            [session.user.id]
        );
        return NextResponse.json({
            items: items.map((n) => ({ ...n, is_read: !!n.is_read })),
            total: Number(counts[0].total),
            unread: Number(counts[0].unread),
            page,
            page_size: limit,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
