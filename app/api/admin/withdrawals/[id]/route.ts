import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { savePrivateDocument } from '@/lib/upload';
import { baht, notify, short } from '@/lib/notifications';

// PATCH - Mark a pending withdrawal as paid or reject it.
// Approve: multipart { status: 'APPROVED', slip: <transfer slip image> } (stored privately, visible to the author + admins)
// Reject:  JSON { status: 'REJECTED', reason }
// Rejected amounts return to the author's balance automatically (balance is computed).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const { id } = await params;
    const isMultipart = req.headers.get('content-type')?.includes('multipart/form-data');
    const form = isMultipart ? await req.formData() : null;
    const body = isMultipart ? null : await req.json();
    const status = form ? form.get('status') : body.status;

    if (status !== 'APPROVED' && status !== 'REJECTED') {
        return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
    }

    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT user_id, status, amount FROM withdrawals WHERE id = ?', [id]);
        if (!rows[0] || rows[0].status !== 'PENDING') {
            return NextResponse.json({ error: 'ไม่พบรายการ หรือรายการนี้ถูกดำเนินการไปแล้ว' }, { status: 409 });
        }

        let slipUrl: string | null = null;
        if (status === 'APPROVED') {
            const slip = form?.get('slip');
            if (!(slip instanceof File) || slip.size === 0) {
                return NextResponse.json({ error: 'กรุณาแนบสลิปการโอนเงิน' }, { status: 400 });
            }
            const saved = await savePrivateDocument(slip, 'withdrawal-slips', rows[0].user_id);
            if ('error' in saved) {
                return NextResponse.json({ error: saved.error }, { status: saved.status });
            }
            slipUrl = saved.url;
        }

        const [result] = await pool.query<ResultSetHeader>(
            'UPDATE withdrawals SET status = ?, slip_image = ?, rejection_reason = ? WHERE id = ? AND status = "PENDING"',
            [status, slipUrl, status === 'REJECTED' ? (body?.reason || null) : null, id]
        );
        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'ไม่พบรายการ หรือรายการนี้ถูกดำเนินการไปแล้ว' }, { status: 409 });
        }
        await notify([rows[0].user_id], status === 'APPROVED'
            ? { type: 'WITHDRAWAL_APPROVED', message: `โอนเงินถอน ฿${baht(rows[0].amount)} แล้ว ดูสลิปได้ในกระเป๋าเงิน`, link: '/author?tab=wallet' }
            : { type: 'WITHDRAWAL_REJECTED', message: `คำขอถอน ฿${baht(rows[0].amount)} ถูกปฏิเสธ ยอดเงินคืนเข้ายอดคงเหลือแล้ว${body?.reason ? `: ${short(body.reason, 100)}` : ''}`, link: '/author?tab=wallet' }, session.user.id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update withdrawal:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
