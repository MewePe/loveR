import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { CATEGORY_TABLES } from '@/lib/categories';
import { RowDataPacket } from 'mysql2';
import { logAdminAction } from '@/lib/adminLog';

// Deleting a category removes it from every story that has it (novel_categories / comic_categories cascade).
// The old novels.category_id / comics.category_id column would block the delete, so it is moved to the
// story's next category (or NULL) first.
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const { id } = await params;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [cats] = await conn.query<RowDataPacket[]>('SELECT name FROM categories WHERE id = ?', [id]);
        for (const t of Object.values(CATEGORY_TABLES)) {
            await conn.query(
                `UPDATE ${t.parent} s SET s.category_id = (
                     SELECT sc.category_id FROM ${t.table} sc
                     WHERE sc.${t.fk} = s.id AND sc.category_id != ? ORDER BY sc.sort_order LIMIT 1
                 ) WHERE s.category_id = ?`,
                [id, id]
            );
        }
        await conn.query('DELETE FROM categories WHERE id = ?', [id]);
        if (cats[0]) await logAdminAction(session.user.id, { action: 'CATEGORY_DELETE', targetType: 'CATEGORY', targetId: id, targetLabel: cats[0].name }, conn);
        await conn.commit();
        return NextResponse.json({ success: true });
    } catch (error) {
        await conn.rollback();
        console.error('Failed to delete category:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    } finally {
        conn.release();
    }
}
