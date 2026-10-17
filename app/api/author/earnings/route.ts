import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { getAuthorBalance, getAuthorSharePercent, MIN_WITHDRAWAL } from '@/lib/coins';

// GET - Author's earnings summary and recent sales
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const authorId = session.user.id;
        const { earned, withdrawn, balance } = await getAuthorBalance(authorId);
        const share = await getAuthorSharePercent();

        const [month] = await pool.query<RowDataPacket[]>(
            `SELECT COALESCE(SUM(author_earning), 0) AS total FROM purchases
             WHERE author_id = ? AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
            [authorId]
        );
        const [sales] = await pool.query<RowDataPacket[]>(
            `SELECT p.id, p.item_title, p.price, p.author_earning, p.created_at,
                    CASE WHEN p.chapter_id IS NOT NULL THEN 'chapter' ELSE 'episode' END AS kind
             FROM purchases p WHERE p.author_id = ? ORDER BY p.created_at DESC LIMIT 50`,
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
        });
    } catch (error) {
        console.error('Failed to fetch earnings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
