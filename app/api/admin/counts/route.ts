import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

// GET /api/admin/counts — pending work per admin menu (the red badges in the sidebar and the
// "งานที่รอดำเนินการ" box on the overview).
// `moderation` is the automatic content check queue (scope item 12), which doesn't exist yet: always 0 until then.
export async function GET() {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' }, { status: 403 });
    }

    try {
        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT
                (SELECT COUNT(*) FROM writer_profiles WHERE status = 'PENDING') AS writers,
                (SELECT COUNT(*) FROM coin_topups WHERE status = 'PENDING') AS topups,
                (SELECT COUNT(*) FROM withdrawals WHERE status = 'PENDING') AS withdrawals,
                (SELECT COUNT(*) FROM reports WHERE status = 'PENDING') AS reports`);
        const r = rows[0];
        return NextResponse.json({
            writers: Number(r.writers),
            topups: Number(r.topups),
            withdrawals: Number(r.withdrawals),
            reports: Number(r.reports),
            moderation: 0,
        });
    } catch (error) {
        console.error('Failed to count pending admin work:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
