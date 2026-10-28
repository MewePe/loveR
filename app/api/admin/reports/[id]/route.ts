import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { logAdminAction } from '@/lib/adminLog';
import { REPORT_STATUS_LABEL } from '@/lib/adminActions';

const TARGET_LABEL: Record<string, string> = { NOVEL: 'นิยาย', COMIC: 'การ์ตูน', COMMENT: 'คอมเมนต์', USER: 'ผู้ใช้' };

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const { id } = await params;
    const { status } = await req.json();

    if (!['PENDING', 'RESOLVED', 'IGNORED'].includes(status)) {
        return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
    }

    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT target_type, status FROM reports WHERE id = ?', [id]);
        if (!rows[0]) {
            return NextResponse.json({ error: 'ไม่พบรายงาน' }, { status: 404 });
        }
        const [result] = await pool.query<ResultSetHeader>('UPDATE reports SET status = ? WHERE id = ?', [status, id]);
        if (result.changedRows > 0) {
            await logAdminAction(session.user.id, {
                action: 'REPORT_STATUS', targetType: 'REPORT', targetId: id,
                detail: `รายงาน${TARGET_LABEL[rows[0].target_type] ?? ''}: ${REPORT_STATUS_LABEL[rows[0].status]} → ${REPORT_STATUS_LABEL[status]}`,
            });
        }
        return NextResponse.json({ message: 'Report updated successfully' });
    } catch (error) {
        console.error('Failed to update report:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
