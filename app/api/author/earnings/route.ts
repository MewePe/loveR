import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { getAuthorBalance, getAuthorSharePercent, MIN_WITHDRAWAL } from '@/lib/coins';

// GET - Author's earnings summary, recent sales and recent supports (coins readers sent directly)
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    try {
        const authorId = session.user.id;
        const { earned, withdrawn, balance } = await getAuthorBalance(authorId);
        const share = await getAuthorSharePercent();

        const [month] = await pool.query<RowDataPacket[]>(
            `SELECT (SELECT COALESCE(SUM(author_earning), 0) FROM purchases
                     WHERE author_id = ? AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01'))
                  + (SELECT COALESCE(SUM(author_earning), 0) FROM supports
                     WHERE author_id = ? AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS total`,
            [authorId, authorId]
        );
        const [sales] = await pool.query<RowDataPacket[]>(
            `SELECT p.id, p.item_title, p.price, p.author_earning, p.created_at,
                    CASE WHEN p.chapter_id IS NOT NULL THEN 'chapter' ELSE 'episode' END AS kind
             FROM purchases p WHERE p.author_id = ? ORDER BY p.created_at DESC LIMIT 50`,
            [authorId]
        );
        const [supports] = await pool.query<RowDataPacket[]>(
            `SELECT s.id, s.amount, s.author_earning, s.message, s.created_at, u.name AS supporter_name
             FROM supports s JOIN users u ON u.id = s.user_id
             WHERE s.author_id = ? ORDER BY s.created_at DESC LIMIT 50`,
            [authorId]
        );

        return NextResponse.json({
            share_percent: share,
            min_withdrawal: MIN_WITHDRAWAL,
            earned,
            withdrawn,
            balance,
            this_month: Number(month[0].total),
            sales,
            supports,
        });
    } catch (error) {
        console.error('Failed to fetch earnings:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
