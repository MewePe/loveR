import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { isOwnerOrAdmin } from '@/lib/visibility';
import { logAdminAction } from '@/lib/adminLog';
import { short } from '@/lib/notifications';

// DELETE /api/comments/[id] — by the commenter, the author of the novel/comic, or an admin
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const { id } = await params;

    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cm.user_id, cm.body, COALESCE(n.author_id, c.author_id) AS content_author_id, cu.name AS user_name
             FROM comments cm
             LEFT JOIN novels n ON n.id = cm.novel_id
             LEFT JOIN comics c ON c.id = cm.comic_id
             LEFT JOIN users cu ON cu.id = cm.user_id
             WHERE cm.id = ?`,
            [id]
        );
        const comment = rows[0];
        if (!comment) {
            return NextResponse.json({ error: 'ไม่พบคอมเมนต์' }, { status: 404 });
        }
        if (comment.user_id !== session.user.id && !isOwnerOrAdmin(session.user, comment.content_author_id)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' }, { status: 403 });
        }

        await pool.query('DELETE FROM comments WHERE id = ?', [id]);
        // Moderation by an admin (not their own comment or a comment on their own story) goes in the admin log
        if (session.user.role === 'ADMIN' && comment.user_id !== session.user.id && comment.content_author_id !== session.user.id) {
            await logAdminAction(session.user.id, {
                action: 'COMMENT_DELETE', targetType: 'COMMENT', targetId: id, targetLabel: comment.user_name,
                detail: short(comment.body, 200),
            });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting comment:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
