import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { logAdminAction } from '@/lib/adminLog';
import { CONTENT_STATUS_LABEL } from '@/lib/adminActions';
import { notify, short } from '@/lib/notifications';

const REASON_MAX = 500;
// Hiding (ARCHIVED: off every list, readers who bought a chapter can still read it) and banning need a reason,
// which the author is told in a notification
const NEEDS_REASON = ['ARCHIVED', 'BANNED'];

// PATCH /api/admin/content/[id] { type: 'novels' | 'comics', status, reason? }
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const status = body.status;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!['DRAFT', 'PUBLISHED', 'ARCHIVED', 'BANNED'].includes(status)) {
        return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
    }
    if (NEEDS_REASON.includes(status) && !reason) {
        return NextResponse.json({ error: 'กรุณาระบุเหตุผล' }, { status: 400 });
    }
    if (reason.length > REASON_MAX) {
        return NextResponse.json({ error: `เหตุผลยาวได้ไม่เกิน ${REASON_MAX} ตัวอักษร` }, { status: 400 });
    }

    const isComic = body.type === 'comics';
    const table = isComic ? 'comics' : 'novels';

    try {
        const [rows] = await pool.query<RowDataPacket[]>(`SELECT title, status, author_id FROM ${table} WHERE id = ?`, [id]);
        const story = rows[0];
        if (!story) {
            return NextResponse.json({ error: 'ไม่พบเรื่องนี้' }, { status: 404 });
        }
        if (story.status === status) {
            return NextResponse.json({ message: 'Content updated successfully' });
        }

        await pool.query(`UPDATE ${table} SET status = ? WHERE id = ?`, [status, id]);
        await logAdminAction(session.user.id, {
            action: 'CONTENT_STATUS', targetType: isComic ? 'COMIC' : 'NOVEL', targetId: id, targetLabel: story.title,
            detail: `${CONTENT_STATUS_LABEL[story.status] ?? story.status} → ${CONTENT_STATUS_LABEL[status]}`, reason,
        });

        const what = `${isComic ? 'การ์ตูน' : 'นิยาย'}เรื่อง "${short(story.title)}"`;
        const message = status === 'BANNED' ? `${what} ถูกระงับโดยผู้ดูแลระบบ`
            : status === 'ARCHIVED' ? `${what} ถูกซ่อนโดยผู้ดูแลระบบ`
            : story.status === 'BANNED' || story.status === 'ARCHIVED' ? `${what} ถูกเปลี่ยนเป็น "${CONTENT_STATUS_LABEL[status]}" โดยผู้ดูแลระบบ`
            : null;
        if (message) {
            await notify([story.author_id], {
                type: 'CONTENT_MODERATED',
                message: reason ? `${message}: ${short(reason, 100)}` : message,
                link: `/author?tab=${table}`,
            }, session.user.id);
        }
        return NextResponse.json({ message: 'Content updated successfully' });
    } catch (error) {
        console.error('Failed to update content:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
