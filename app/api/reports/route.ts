import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { notifyAdmins, short } from '@/lib/notifications';

const REPORT_TARGET_LABEL: Record<string, string> = { NOVEL: 'นิยาย', COMIC: 'การ์ตูน', COMMENT: 'คอมเมนต์' };

const TARGET_TABLES: Record<string, string> = { NOVEL: 'novels', COMIC: 'comics', COMMENT: 'comments' };

// POST - Report a novel, comic or comment
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    try {
        const { target_type, target_id, reason } = await req.json();

        const table = TARGET_TABLES[target_type];
        if (!table || typeof target_id !== 'string') {
            return NextResponse.json({ error: 'สิ่งที่รายงานไม่ถูกต้อง' }, { status: 400 });
        }

        const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
        if (!trimmedReason || trimmedReason.length > 1000) {
            return NextResponse.json({ error: 'กรุณาระบุเหตุผล (ไม่เกิน 1000 ตัวอักษร)' }, { status: 400 });
        }

        const [targets] = await pool.query<RowDataPacket[]>(`SELECT id FROM ${table} WHERE id = ?`, [target_id]);
        if (!targets[0]) {
            return NextResponse.json({ error: 'ไม่พบเรื่องนี้' }, { status: 404 });
        }

        const [existing] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM reports WHERE reporter_id = ? AND target_id = ? AND status = "PENDING"',
            [session.user.id, target_id]
        );
        if (existing.length > 0) {
            return NextResponse.json({ error: 'คุณได้รายงานเนื้อหานี้ไปแล้ว กำลังรอการตรวจสอบ' }, { status: 400 });
        }

        await pool.query(
            'INSERT INTO reports (id, reporter_id, target_id, target_type, reason) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), session.user.id, target_id, target_type, trimmedReason]
        );
        await notifyAdmins({
            type: 'ADMIN_REPORT',
            message: `มีการรายงาน${REPORT_TARGET_LABEL[target_type]}ใหม่: ${short(trimmedReason, 80)}`,
            link: '/admin?tab=reports',
        }, session.user.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to create report:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
