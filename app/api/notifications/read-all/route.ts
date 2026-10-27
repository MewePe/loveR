import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';

// POST /api/notifications/read-all — mark all of the user's notifications as read
export async function POST() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    try {
        await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [session.user.id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error marking notifications read:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
