import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { logAdminAction } from '@/lib/adminLog';
import { notify, notifyNewItem, short } from '@/lib/notifications';
import { SEVERE_VERDICTS, VERDICT_LABEL, Verdict, isOneOf, VERDICTS } from '@/lib/moderationLabels';

const ACTIONS = ['approve', 'mark_mature', 'reject'] as const;
const ITEM = {
    chapter: { table: 'chapters', column: 'chapter_id', story: 'novels', storyFk: 'novel_id', kind: 'novel', target: 'NOVEL', label: 'บท' },
    episode: { table: 'comic_episodes', column: 'episode_id', story: 'comics', storyFk: 'comic_id', kind: 'comic', target: 'COMIC', label: 'ตอน' },
} as const;

// PATCH /api/admin/moderation/[id] { action, reason } — decide a queued content check:
// - approve: publish the chapter/episode (a reason is required when the API found something severe)
// - mark_mature: set the story to 18+ and publish (the fix for "labelled ทั่วไป but 18+")
// - reject: keep it hidden (REJECTED), reason required; the author can edit it, which checks it again
// The author is notified with the reason; readers hear about a newly published item as usual.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' }, { status: 403 });
    }
    const adminId = session.user.id;
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (!isOneOf(ACTIONS, action)) {
        return NextResponse.json({ error: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
    }

    const [checks] = await pool.query<RowDataPacket[]>('SELECT * FROM moderation_checks WHERE id = ?', [id]);
    const check = checks[0];
    if (!check) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 });
    if (check.status !== 'PENDING' && check.status !== 'CHECKING') {
        return NextResponse.json({ error: 'รายการนี้ถูกจัดการไปแล้ว' }, { status: 409 });
    }
    const t = ITEM[check.item_type as keyof typeof ITEM];
    const itemId = check[t?.column ?? 'chapter_id'];
    if (!t || !itemId) return NextResponse.json({ error: 'ตอนนี้ถูกลบไปแล้ว' }, { status: 404 });

    const verdict = isOneOf(VERDICTS, check.verdict) ? check.verdict as Verdict : null;
    if (action === 'reject' && !reason) {
        return NextResponse.json({ error: 'กรุณาระบุเหตุผลที่ปฏิเสธ' }, { status: 400 });
    }
    if (action !== 'reject' && verdict && SEVERE_VERDICTS.includes(verdict) && !reason) {
        return NextResponse.json({ error: `ระบบพบ${VERDICT_LABEL[verdict]} ต้องระบุเหตุผลที่อนุมัติ` }, { status: 400 });
    }

    const [items] = await pool.query<RowDataPacket[]>(
        `SELECT i.id, i.title, s.id AS story_id, s.title AS story_title, s.author_id, s.status, s.is_mature
         FROM ${t.table} i JOIN ${t.story} s ON s.id = i.${t.storyFk} WHERE i.id = ?`,
        [itemId]
    );
    const item = items[0];
    if (!item) return NextResponse.json({ error: 'ตอนนี้ถูกลบไปแล้ว' }, { status: 404 });

    const itemStatus = action === 'reject' ? 'REJECTED' : 'APPROVED';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [res] = await conn.query<ResultSetHeader>(
            `UPDATE moderation_checks SET status = ?, reviewer_id = ?, review_note = ?, reviewed_at = NOW()
             WHERE id = ? AND status IN ('PENDING', 'CHECKING')`,
            [action === 'reject' ? 'REJECTED' : 'APPROVED', adminId, reason || null, id]
        );
        if (res.affectedRows === 0) {
            await conn.rollback();
            return NextResponse.json({ error: 'รายการนี้ถูกจัดการไปแล้ว' }, { status: 409 });
        }
        await conn.query(`UPDATE ${t.table} SET moderation_status = ? WHERE id = ?`, [itemStatus, itemId]);
        if (action === 'mark_mature') await conn.query(`UPDATE ${t.story} SET is_mature = 1 WHERE id = ?`, [item.story_id]);
        await logAdminAction(adminId, {
            action: action === 'approve' ? 'MODERATION_APPROVE' : action === 'mark_mature' ? 'MODERATION_RELABEL' : 'MODERATION_REJECT',
            targetType: t.target,
            targetId: item.story_id,
            targetLabel: `${item.story_title} — ${item.title}`,
            detail: `${t.label} "${short(item.title)}" ผลจาก API: ${verdict ? VERDICT_LABEL[verdict] : 'ยังไม่มีผล'}`,
            reason: reason || null,
        }, conn);
        await conn.commit();
    } catch (error) {
        await conn.rollback();
        console.error('Failed to decide moderation check:', error);
        return NextResponse.json({ error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
    } finally {
        conn.release();
    }

    const name = `${t.label} "${short(item.title)}" ของเรื่อง "${short(item.story_title)}"`;
    const link = check.item_type === 'chapter' ? `/author/novel/${item.story_id}/chapters` : `/author/comic/${item.story_id}/episodes`;
    if (action === 'reject') {
        await notify([item.author_id], { type: 'MODERATION_REJECTED', message: `${name} ไม่ผ่านการตรวจเนื้อหา: ${short(reason, 200)}`, link }, adminId);
    } else {
        await notify([item.author_id], {
            type: 'MODERATION_APPROVED',
            message: action === 'mark_mature'
                ? `แอดมินปรับเรื่อง "${short(item.story_title)}" เป็น 18+ และเผยแพร่${t.label} "${short(item.title)}" แล้ว${reason ? `: ${short(reason, 200)}` : ''}`
                : `${name} ผ่านการตรวจเนื้อหาและเผยแพร่แล้ว${reason ? `: ${short(reason, 200)}` : ''}`,
            link,
        }, adminId);
        await notifyNewItem(t.kind, { id: item.story_id, title: item.story_title, author_id: item.author_id, status: item.status }, itemId, item.title);
    }

    return NextResponse.json({ success: true, item_status: itemStatus });
}
