import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { ResultSetHeader } from 'mysql2';

// PATCH - Mark a pending withdrawal as paid (with transfer slip) or reject it.
// Body: { status: 'APPROVED', slip_image } | { status: 'REJECTED', reason }
// Rejected amounts return to the author's balance automatically (balance is computed).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { status, reason, slip_image } = await req.json();

    if (!['APPROVED', 'REJECTED'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    if (status === 'APPROVED' && (typeof slip_image !== 'string' || !slip_image.startsWith('/uploads/'))) {
        return NextResponse.json({ error: 'กรุณาแนบสลิปการโอนเงิน' }, { status: 400 });
    }

    try {
        const [result] = await pool.query<ResultSetHeader>(
            'UPDATE withdrawals SET status = ?, slip_image = ?, rejection_reason = ? WHERE id = ? AND status = "PENDING"',
            [status, status === 'APPROVED' ? slip_image : null, status === 'REJECTED' ? (reason || null) : null, id]
        );
        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'ไม่พบรายการ หรือรายการนี้ถูกดำเนินการไปแล้ว' }, { status: 409 });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update withdrawal:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
