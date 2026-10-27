import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { ResultSetHeader } from 'mysql2';

// PATCH /api/notifications/[id] — mark one of the user's own notifications as read
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const { id } = await params;
    try {
        const [result] = await pool.query<ResultSetHeader>(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [id, session.user.id]
        );
        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'ไม่พบการแจ้งเตือน' }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating notification:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
