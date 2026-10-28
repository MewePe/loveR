import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { logAdminAction } from '@/lib/adminLog';
import { notify, short } from '@/lib/notifications';

const ADJUST_MAX = 1_000_000;
const REASON_MAX = 500;

// POST /api/admin/users/[id]/coins { amount, reason } — add (amount > 0) or remove (amount < 0) coins.
// The user row is locked like purchaseItem(), the balance can't go below 0, and every change is kept in
// coin_adjustments (shown in the user's history and the transactions list) plus the admin log.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > ADJUST_MAX) {
        return NextResponse.json({ error: `จำนวนเหรียญต้องเป็นจำนวนเต็มที่ไม่ใช่ 0 และไม่เกิน ${ADJUST_MAX.toLocaleString('th-TH')}` }, { status: 400 });
    }
    if (!reason) {
        return NextResponse.json({ error: 'กรุณาระบุเหตุผลที่ปรับยอดเหรียญ' }, { status: 400 });
    }
    if (reason.length > REASON_MAX) {
        return NextResponse.json({ error: `เหตุผลยาวได้ไม่เกิน ${REASON_MAX} ตัวอักษร` }, { status: 400 });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query<RowDataPacket[]>('SELECT name, email, coins FROM users WHERE id = ? FOR UPDATE', [id]);
        const user = rows[0];
        if (!user) {
            await conn.rollback();
            return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
        }
        const balance = Number(user.coins) + amount;
        if (balance < 0) {
            await conn.rollback();
            return NextResponse.json({ error: `หักได้ไม่เกินยอดที่มี (${user.coins} เหรียญ)` }, { status: 400 });
        }
        await conn.query('UPDATE users SET coins = ? WHERE id = ?', [balance, id]);
        await conn.query(
            'INSERT INTO coin_adjustments (id, user_id, admin_id, amount, balance_after, reason) VALUES (?, ?, ?, ?, ?, ?)',
            [uuidv4(), id, session.user.id, amount, balance, reason]
        );
        await logAdminAction(session.user.id, {
            action: 'COINS_ADJUST', targetType: 'USER', targetId: id, targetLabel: user.name || user.email,
            detail: `${amount > 0 ? '+' : ''}${amount} เหรียญ (คงเหลือ ${balance})`, reason,
        }, conn);
        await conn.commit();

        await notify([id], {
            type: 'COINS_ADJUSTED',
            message: `${amount > 0 ? `ได้รับ ${amount}` : `ถูกหัก ${-amount}`} เหรียญจากผู้ดูแลระบบ: ${short(reason, 100)}`,
            link: '/coins',
        }, session.user.id);
        return NextResponse.json({ success: true, coins: balance });
    } catch (error) {
        await conn.rollback();
        console.error('Failed to adjust coins:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    } finally {
        conn.release();
    }
}
