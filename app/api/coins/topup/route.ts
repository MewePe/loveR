import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { savePrivateDocument } from '@/lib/upload';

const MIN_TOPUP = 20;
const MAX_TOPUP = 50000;
const MAX_PENDING = 3;
const MAX_PER_DAY = 10; // all statuses, so rejected spam slips still count

// POST - Request a coin top-up (multipart: amount, slip). Coins are credited when an admin approves the slip.
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const amount = Number(formData.get('amount'));
        const slip = formData.get('slip');

        if (!Number.isInteger(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP) {
            return NextResponse.json({ error: `จำนวนเงินต้องเป็นจำนวนเต็มระหว่าง ${MIN_TOPUP} - ${MAX_TOPUP} บาท` }, { status: 400 });
        }
        if (!(slip instanceof File) || slip.size === 0) {
            return NextResponse.json({ error: 'กรุณาแนบสลิปการโอนเงิน' }, { status: 400 });
        }

        const [counts] = await pool.query<RowDataPacket[]>(
            `SELECT
                COALESCE(SUM(status = 'PENDING'), 0) AS pending,
                COALESCE(SUM(created_at > NOW() - INTERVAL 1 DAY), 0) AS today
             FROM coin_topups WHERE user_id = ?`,
            [session.user.id]
        );
        if (Number(counts[0].today) >= MAX_PER_DAY) {
            return NextResponse.json({ error: `ส่งคำขอเติมเหรียญได้ไม่เกิน ${MAX_PER_DAY} ครั้งต่อวัน กรุณาลองใหม่พรุ่งนี้` }, { status: 429 });
        }
        if (Number(counts[0].pending) >= MAX_PENDING) {
            return NextResponse.json({ error: 'คุณมีรายการรอตรวจสอบหลายรายการแล้ว กรุณารอแอดมินตรวจสอบก่อน' }, { status: 400 });
        }

        const saved = await savePrivateDocument(slip, 'topup-slips', session.user.id);
        if ('error' in saved) {
            return NextResponse.json({ error: saved.error }, { status: saved.status });
        }

        await pool.query(
            'INSERT INTO coin_topups (id, user_id, amount, slip_image) VALUES (?, ?, ?, ?)',
            [uuidv4(), session.user.id, amount, saved.url]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Top-up request failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
