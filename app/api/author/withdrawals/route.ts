import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { getAuthorBalance, MIN_WITHDRAWAL } from '@/lib/coins';
import { baht, notifyAdmins, short } from '@/lib/notifications';

// GET - Author's withdrawal history
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, amount, bank_name, bank_account_number, status, slip_image, rejection_reason, created_at
             FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC`,
            [session.user.id]
        );
        return NextResponse.json(rows);
    } catch (error) {
        console.error('Failed to fetch withdrawals:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST - Request a withdrawal to the bank account on the approved writer profile. Body: { amount }
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== 'AUTHOR' && session.user.role !== 'ADMIN')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { amount } = await req.json();
    const value = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(value) || value < MIN_WITHDRAWAL) {
        return NextResponse.json({ error: `ถอนขั้นต่ำ ${MIN_WITHDRAWAL} บาท` }, { status: 400 });
    }

    const [profiles] = await pool.query<RowDataPacket[]>(
        'SELECT status, bank_name, bank_account_number, bank_account_name FROM writer_profiles WHERE user_id = ?',
        [userId]
    );
    const profile = profiles[0];
    if (!profile || profile.status !== 'APPROVED') {
        return NextResponse.json({ error: 'ข้อมูลนักเขียนของคุณยังไม่ได้รับการอนุมัติ' }, { status: 400 });
    }
    if (!profile.bank_name || !profile.bank_account_number || !profile.bank_account_name) {
        return NextResponse.json({ error: 'กรุณากรอกข้อมูลบัญชีธนาคารในแท็บ "ข้อมูลนักเขียน" ก่อน' }, { status: 400 });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        // Lock the author's row so two concurrent requests can't both pass the balance check
        await connection.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);

        const { balance } = await getAuthorBalance(userId, connection);
        if (value > balance) {
            await connection.rollback();
            return NextResponse.json({ error: `ยอดคงเหลือไม่พอ (ถอนได้ ${balance.toFixed(2)} บาท)` }, { status: 400 });
        }

        await connection.query(
            `INSERT INTO withdrawals (id, user_id, amount, bank_name, bank_account_number, bank_account_name)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [uuidv4(), userId, value, profile.bank_name, profile.bank_account_number, profile.bank_account_name]
        );

        await connection.commit();
        await notifyAdmins({
            type: 'ADMIN_WITHDRAWAL',
            message: `${short(session.user.name, 40) || 'นักเขียน'} ขอถอนเงิน ฿${baht(value)}`,
            link: '/admin?tab=payments',
        }, userId);
        return NextResponse.json({ success: true });
    } catch (error) {
        await connection.rollback();
        console.error('Withdrawal request failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        connection.release();
    }
}
