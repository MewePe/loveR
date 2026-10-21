import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { isOwnerOrAdmin } from '@/lib/visibility';

// DELETE /api/comments/[id] — by the commenter, the author of the novel/comic, or an admin
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;

    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cm.user_id, COALESCE(n.author_id, c.author_id) AS content_author_id
             FROM comments cm
             LEFT JOIN novels n ON n.id = cm.novel_id
             LEFT JOIN comics c ON c.id = cm.comic_id
             WHERE cm.id = ?`,
            [id]
        );
        const comment = rows[0];
        if (!comment) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        }
        if (comment.user_id !== session.user.id && !isOwnerOrAdmin(session.user, comment.content_author_id)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await pool.query('DELETE FROM comments WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting comment:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
