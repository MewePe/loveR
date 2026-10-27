import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

// GET - Current user's coin balance, top-up history, purchase history and payment instructions
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    try {
        const [users] = await pool.query<RowDataPacket[]>('SELECT coins FROM users WHERE id = ?', [session.user.id]);
        const [settings] = await pool.query<RowDataPacket[]>('SELECT payment_info FROM system_settings WHERE id = "1"');
        const [topups] = await pool.query<RowDataPacket[]>(
            'SELECT id, amount, status, rejection_reason, created_at FROM coin_topups WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [session.user.id]
        );
        const [purchases] = await pool.query<RowDataPacket[]>(
            `SELECT p.id, p.item_title, p.price, p.created_at, p.chapter_id, p.episode_id, e.comic_id
             FROM purchases p
             LEFT JOIN comic_episodes e ON p.episode_id = e.id
             WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT 50`,
            [session.user.id]
        );

        return NextResponse.json({
            coins: users[0]?.coins ?? 0,
            payment_info: settings[0]?.payment_info || '',
            topups,
            purchases,
        });
    } catch (error) {
        console.error('Failed to fetch coins:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
