import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { bucketExpr, bucketKeys, parseRange, rangeStart, seriesByBucket } from '@/lib/analytics';

// GET /api/admin/analytics?range=30d|12m — money totals and the time series for the admin dashboard charts.
// Top-ups count only APPROVED ones (by when they were approved); sales are coins spent on chapters/episodes,
// and the platform share is what's left after author_earning.
export async function GET(req: NextRequest) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' }, { status: 403 });
    }

    try {
        const range = parseRange(req.nextUrl.searchParams.get('range'));
        const keys = await bucketKeys(range);
        const start = rangeStart(range);

        const [topups, sales, users] = await Promise.all([
            seriesByBucket(keys, ['topup_amount'],
                `SELECT ${bucketExpr(range, 'updated_at')} AS bucket, SUM(amount) AS topup_amount
                 FROM coin_topups WHERE status = 'APPROVED' AND updated_at >= ${start} GROUP BY bucket`, []),
            seriesByBucket(keys, ['sales_amount', 'platform_amount'],
                `SELECT ${bucketExpr(range, 'created_at')} AS bucket, SUM(price) AS sales_amount,
                        SUM(price - author_earning) AS platform_amount
                 FROM purchases WHERE created_at >= ${start} GROUP BY bucket`, []),
            seriesByBucket(keys, ['new_users'],
                `SELECT ${bucketExpr(range, 'created_at')} AS bucket, COUNT(*) AS new_users
                 FROM users WHERE created_at >= ${start} GROUP BY bucket`, []),
        ]);

        const [totals] = await pool.query<RowDataPacket[]>(`
            SELECT
                (SELECT COALESCE(SUM(amount), 0) FROM coin_topups WHERE status = 'APPROVED') AS topup_amount,
                (SELECT COALESCE(SUM(price), 0) FROM purchases) AS sales_amount,
                (SELECT COALESCE(SUM(price - author_earning), 0) FROM purchases) AS platform_amount,
                (SELECT COUNT(*) FROM coin_topups WHERE status = 'PENDING') AS pending_topups`);

        return NextResponse.json({
            range,
            totals: {
                topup_amount: Number(totals[0].topup_amount),
                sales_amount: Number(totals[0].sales_amount),
                platform_amount: Math.round(Number(totals[0].platform_amount) * 100) / 100,
                pending_topups: Number(totals[0].pending_topups),
            },
            series: keys.map((bucket, i) => ({
                bucket,
                topup_amount: topups[i].topup_amount,
                sales_amount: sales[i].sales_amount,
                platform_amount: Math.round(sales[i].platform_amount * 100) / 100,
                new_users: users[i].new_users,
            })),
        });
    } catch (error) {
        console.error('Failed to load admin analytics:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
