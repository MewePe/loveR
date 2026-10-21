import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { notify, short } from '@/lib/notifications';

// PATCH - Approve (credit coins) or reject a pending top-up. Body: { status, reason? }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { status, reason } = await req.json();
    if (!['APPROVED', 'REJECTED'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [rows] = await connection.query<RowDataPacket[]>('SELECT user_id, amount FROM coin_topups WHERE id = ? FOR UPDATE', [id]);
        if (!rows[0]) {
            await connection.rollback();
            return NextResponse.json({ error: 'Top-up not found' }, { status: 404 });
        }

        // Only a PENDING request can change state, so coins are never credited twice
        const [result] = await connection.query<ResultSetHeader>(
            'UPDATE coin_topups SET status = ?, rejection_reason = ? WHERE id = ? AND status = "PENDING"',
            [status, status === 'REJECTED' ? (reason || null) : null, id]
        );
        if (result.affectedRows === 0) {
            await connection.rollback();
            return NextResponse.json({ error: 'รายการนี้ถูกดำเนินการไปแล้ว' }, { status: 409 });
        }

        if (status === 'APPROVED') {
            await connection.query('UPDATE users SET coins = coins + ? WHERE id = ?', [rows[0].amount, rows[0].user_id]);
        }

        await connection.commit();
        await notify([rows[0].user_id], status === 'APPROVED'
            ? { type: 'TOPUP_APPROVED', message: `เติมเหรียญสำเร็จ ได้รับ ${rows[0].amount} เหรียญ`, link: '/coins' }
            : { type: 'TOPUP_REJECTED', message: `คำขอเติมเหรียญ ${rows[0].amount} บาทถูกปฏิเสธ${reason ? `: ${short(reason, 100)}` : ''}`, link: '/coins' }, session.user.id);
        return NextResponse.json({ success: true });
    } catch (error) {
        await connection.rollback();
        console.error('Failed to update top-up:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        connection.release();
    }
}
