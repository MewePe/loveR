import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { canAccess, AccessItem } from '@/lib/coins';
import { canViewContent, isOwnerOrAdmin } from '@/lib/visibility';
import { needsAgeGate } from '@/lib/ageGate';

// Chapters are created via POST /api/novels/[id]/chapters (which checks ownership)
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const novelId = searchParams.get('novelId');
    const chapterId = searchParams.get('chapterId');

    try {
        const session = await auth();

        if (chapterId) {
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT c.id, c.title, c.chapter_order, c.novel_id, c.views, c.price, c.moderation_status, c.created_at, c.updated_at,
                        n.title as novel_title, n.author_id, n.status as content_status, n.is_mature
         FROM chapters c
         JOIN novels n ON c.novel_id = n.id
         WHERE c.id = ?`,
                [chapterId]
            );
            const chapter = rows[0];
            if (!chapter) return NextResponse.json({ error: 'ไม่พบบทนี้' }, { status: 404 });

            if (!(await canAccess(session?.user, 'chapter', chapter as AccessItem))) {
                // Unpublished novels and unchecked chapters don't exist for other users; published paid chapters are just locked
                if (chapter.content_status !== 'PUBLISHED' || chapter.moderation_status !== 'APPROVED') {
                    return NextResponse.json({ error: 'ไม่พบบทนี้' }, { status: 404 });
                }
                return NextResponse.json({ ...chapter, content: null, locked: true });
            }
            if (await needsAgeGate(session?.user, chapter)) {
                return NextResponse.json({ error: 'เนื้อหานี้สำหรับผู้มีอายุ 18 ปีขึ้นไป กรุณายืนยันอายุก่อน', age_required: true }, { status: 403 });
            }
            const [content] = await pool.query<RowDataPacket[]>('SELECT content FROM chapters WHERE id = ?', [chapterId]);
            return NextResponse.json({ ...chapter, content: content[0]?.content ?? null, locked: false });
        }

        if (novelId) {
            const [novels] = await pool.query<RowDataPacket[]>('SELECT status, author_id FROM novels WHERE id = ?', [novelId]);
            if (!novels[0] || !canViewContent(session?.user, novels[0])) {
                return NextResponse.json({ error: 'ไม่พบนิยายเรื่องนี้' }, { status: 404 });
            }
            const approvedOnly = !isOwnerOrAdmin(session?.user, novels[0].author_id);
            const [rows] = await pool.query(
                `SELECT id, title, chapter_order, price, created_at
         FROM chapters
         WHERE novel_id = ? ${approvedOnly ? "AND moderation_status = 'APPROVED'" : ''}
         ORDER BY chapter_order ASC`,
                [novelId]
            );
            return NextResponse.json(rows);
        }

        return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
