import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

export async function GET() {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    try {
        const [reports] = await pool.query<RowDataPacket[]>(`
            SELECT r.id, r.reason, r.status, r.created_at, r.target_type, r.target_id,
                   u.name as reporter_name,
                   COALESCE(n.title, c.title, cm.body) as target_title,
                   -- for a comment: the novel/comic it was posted on, so the admin can open it
                   CASE WHEN cm.novel_id IS NOT NULL THEN 'NOVEL' WHEN cm.comic_id IS NOT NULL THEN 'COMIC' END as parent_type,
                   COALESCE(cm.novel_id, cm.comic_id) as parent_id,
                   cu.name as comment_author_name
            FROM reports r
            LEFT JOIN users u ON r.reporter_id = u.id
            LEFT JOIN novels n ON r.target_type = 'NOVEL' AND r.target_id = n.id
            LEFT JOIN comics c ON r.target_type = 'COMIC' AND r.target_id = c.id
            LEFT JOIN comments cm ON r.target_type = 'COMMENT' AND r.target_id = cm.id
            LEFT JOIN users cu ON cm.user_id = cu.id
            ORDER BY r.created_at DESC
        `);

        return NextResponse.json(reports);
    } catch (error) {
        console.error('Failed to fetch reports:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
