import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { logAdminAction } from '@/lib/adminLog';
import { ROLE_LABEL } from '@/lib/adminActions';
import { getAuthorBalance } from '@/lib/coins';

// BANNED users can't log in and existing sessions end on their next request (see lib/auth.ts)
const ASSIGNABLE_ROLES = ['READER', 'AUTHOR', 'ADMIN', 'BANNED'];
const REASON_MAX = 500;
const HISTORY_LIMIT = 50;

// GET /api/admin/users/[id] — everything the admin user detail view shows: account, writer application,
// author balance, top-ups, purchases, supports sent, coin adjustments, works, reports against the user
// (their account, their stories and their comments) and the admin log entries about them.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const { id } = await params;

    try {
        const [users] = await pool.query<RowDataPacket[]>(
            `SELECT id, name, email, username, image, role,
                    CASE WHEN role = 'BANNED' THEN COALESCE(role_before_ban, 'READER') ELSE role END AS base_role,
                    ban_reason, banned_at, coins, created_at, updated_at
             FROM users WHERE id = ?`,
            [id]
        );
        const user = users[0];
        if (!user) return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });

        const [[writer], [topups], [purchases], [supports], [adjustments], [works], [reports], [logs]] = await Promise.all([
            pool.query<RowDataPacket[]>('SELECT status, first_name, last_name, rejection_reason, created_at FROM writer_profiles WHERE user_id = ?', [id]),
            pool.query<RowDataPacket[]>(
                'SELECT id, amount, slip_image, status, rejection_reason, created_at, updated_at FROM coin_topups WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
                [id, HISTORY_LIMIT]),
            pool.query<RowDataPacket[]>(
                `SELECT p.id, p.item_title, p.price, p.created_at, p.chapter_id, p.episode_id,
                        COALESCE(n.title, c.title) AS story_title, COALESCE(n.id, c.id) AS story_id,
                        CASE WHEN n.id IS NOT NULL THEN 'novel' WHEN c.id IS NOT NULL THEN 'comic' END AS story_type
                 FROM purchases p
                 LEFT JOIN chapters ch ON ch.id = p.chapter_id LEFT JOIN novels n ON n.id = ch.novel_id
                 LEFT JOIN comic_episodes ep ON ep.id = p.episode_id LEFT JOIN comics c ON c.id = ep.comic_id
                 WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT ?`,
                [id, HISTORY_LIMIT]),
            pool.query<RowDataPacket[]>(
                `SELECT s.id, s.amount, s.message, s.created_at, u.name AS author_name
                 FROM supports s LEFT JOIN users u ON u.id = s.author_id
                 WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT ?`,
                [id, HISTORY_LIMIT]),
            pool.query<RowDataPacket[]>(
                `SELECT a.id, a.amount, a.balance_after, a.reason, a.created_at, u.name AS admin_name
                 FROM coin_adjustments a LEFT JOIN users u ON u.id = a.admin_id
                 WHERE a.user_id = ? ORDER BY a.created_at DESC LIMIT ?`,
                [id, HISTORY_LIMIT]),
            pool.query<RowDataPacket[]>(
                `SELECT 'novel' AS type, s.id, s.title, s.status, s.views, s.created_at,
                        (SELECT COUNT(*) FROM chapters WHERE novel_id = s.id) AS item_count
                 FROM novels s WHERE s.author_id = ?
                 UNION ALL
                 SELECT 'comic', s.id, s.title, s.status, s.views, s.created_at,
                        (SELECT COUNT(*) FROM comic_episodes WHERE comic_id = s.id)
                 FROM comics s WHERE s.author_id = ?
                 ORDER BY created_at DESC`,
                [id, id]),
            pool.query<RowDataPacket[]>(
                `SELECT r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at, ru.name AS reporter_name,
                        COALESCE(n.title, c.title, cm.body) AS target_title,
                        CASE WHEN cm.novel_id IS NOT NULL THEN 'NOVEL' WHEN cm.comic_id IS NOT NULL THEN 'COMIC' END AS parent_type,
                        COALESCE(cm.novel_id, cm.comic_id) AS parent_id
                 FROM reports r
                 LEFT JOIN users ru ON ru.id = r.reporter_id
                 LEFT JOIN novels n ON r.target_type = 'NOVEL' AND n.id = r.target_id
                 LEFT JOIN comics c ON r.target_type = 'COMIC' AND c.id = r.target_id
                 LEFT JOIN comments cm ON r.target_type = 'COMMENT' AND cm.id = r.target_id
                 WHERE (r.target_type = 'USER' AND r.target_id = ?) OR n.author_id = ? OR c.author_id = ? OR cm.user_id = ?
                 ORDER BY r.created_at DESC LIMIT ?`,
                [id, id, id, id, HISTORY_LIMIT]),
            pool.query<RowDataPacket[]>(
                'SELECT id, admin_name, action, detail, reason, created_at FROM admin_logs WHERE target_id = ? ORDER BY created_at DESC LIMIT 20',
                [id]).catch((error) => {
                // admin_logs missing (migration not run): show the rest of the page anyway
                console.error('Failed to read admin_logs:', error);
                return [[]] as unknown as [RowDataPacket[]];
            }),
        ]);

        const isAuthor = user.base_role === 'AUTHOR' || works.length > 0;
        return NextResponse.json({
            user,
            writer_profile: writer[0] ?? null,
            author_balance: isAuthor ? await getAuthorBalance(id) : null,
            topups,
            purchases,
            supports,
            adjustments,
            works: works.map((w) => ({ ...w, views: Number(w.views) || 0, item_count: Number(w.item_count) })),
            reports,
            logs,
        });
    } catch (error) {
        console.error('Failed to fetch user detail:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}

// PATCH /api/admin/users/[id]
//   { action: 'ban', reason }  — reason required; the current role is kept in role_before_ban
//   { action: 'unban' }        — restores role_before_ban
//   { role }                   — READER | AUTHOR | ADMIN (also lifts a ban); role 'BANNED' bans with an optional reason
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
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    let op: 'ban' | 'unban' | 'role';
    if (body.action === 'ban' || body.role === 'BANNED') op = 'ban';
    else if (body.action === 'unban') op = 'unban';
    else if (body.action === undefined && ASSIGNABLE_ROLES.includes(body.role)) op = 'role';
    else return NextResponse.json({ error: 'สิทธิ์ไม่ถูกต้อง' }, { status: 400 });

    if (body.action === 'ban' && !reason) {
        return NextResponse.json({ error: 'กรุณาระบุเหตุผลที่แบน' }, { status: 400 });
    }
    if (reason.length > REASON_MAX) {
        return NextResponse.json({ error: `เหตุผลยาวได้ไม่เกิน ${REASON_MAX} ตัวอักษร` }, { status: 400 });
    }
    // Prevent admins from demoting/banning themselves and locking everyone out
    if (id === session.user.id) {
        return NextResponse.json({ error: 'ไม่สามารถเปลี่ยนบทบาทของตัวเองได้' }, { status: 400 });
    }

    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT name, email, role, role_before_ban FROM users WHERE id = ?', [id]);
        const target = rows[0];
        if (!target) {
            return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
        }
        const label = target.name || target.email;

        if (op === 'ban') {
            // Banning an already banned user only updates the reason
            if (target.role === 'BANNED') {
                await pool.query('UPDATE users SET ban_reason = ? WHERE id = ?', [reason || null, id]);
            } else {
                await pool.query(
                    "UPDATE users SET role_before_ban = ?, role = 'BANNED', ban_reason = ?, banned_at = NOW() WHERE id = ?",
                    [target.role, reason || null, id]
                );
            }
            await logAdminAction(session.user.id, { action: 'USER_BAN', targetType: 'USER', targetId: id, targetLabel: label, reason });
            return NextResponse.json({ success: true });
        }

        if (op === 'unban') {
            if (target.role !== 'BANNED') {
                return NextResponse.json({ error: 'ผู้ใช้นี้ไม่ได้ถูกแบน' }, { status: 409 });
            }
            const restored = target.role_before_ban || 'READER';
            await pool.query<ResultSetHeader>(
                'UPDATE users SET role = ?, role_before_ban = NULL, ban_reason = NULL, banned_at = NULL WHERE id = ?',
                [restored, id]
            );
            await logAdminAction(session.user.id, { action: 'USER_UNBAN', targetType: 'USER', targetId: id, targetLabel: label, detail: `คืนสิทธิ์เป็น${ROLE_LABEL[restored]}` });
            return NextResponse.json({ success: true, role: restored });
        }

        await pool.query(
            'UPDATE users SET role = ?, role_before_ban = NULL, ban_reason = NULL, banned_at = NULL WHERE id = ?',
            [body.role, id]
        );
        if (target.role !== body.role) {
            await logAdminAction(session.user.id, {
                action: target.role === 'BANNED' ? 'USER_UNBAN' : 'USER_ROLE', targetType: 'USER', targetId: id, targetLabel: label,
                detail: `${ROLE_LABEL[target.role] ?? target.role} → ${ROLE_LABEL[body.role]}`,
            });
        }
        return NextResponse.json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Failed to update user:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
