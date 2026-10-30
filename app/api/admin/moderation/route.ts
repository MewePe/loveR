import { chapterPlainText } from '@/lib/chapterContent';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { parsePage } from '@/lib/adminLog';
import { ModerationAnalysis } from '@/lib/moderationLabels';
import { QUEUE_SQL } from '@/lib/moderation';

const PAGE_SIZE = 20;

const FILTERS: Record<string, string> = {
    PENDING: QUEUE_SQL,
    CLEARED: "m.status = 'CLEARED'",
    APPROVED: "m.status = 'APPROVED'",
    REJECTED: "m.status = 'REJECTED'",
    all: "m.status <> 'SUPERSEDED'",
};

function parseAnalysis(value: unknown): ModerationAnalysis {
    try {
        const a = JSON.parse(String(value ?? ''));
        return { summary: String(a.summary ?? ''), issues: Array.isArray(a.issues) ? a.issues : [] };
    } catch {
        return { summary: '', issues: [] };
    }
}

const EXCERPT_LENGTH = 600;
const EXCERPT_SOURCE = 6000; // characters read to get that much text: HTML chapters have tags in between

// GET /api/admin/moderation?status=PENDING|CLEARED|APPROVED|REJECTED|all&page= → { items, total, page, pageSize }
// Each item has the API's verdict and Thai analysis, the chapter/episode and story, and for comics every page
// (url + number) so the admin can look at the flagged ones; chapters get a text excerpt.
export async function GET(req: Request) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? 'PENDING';
    const where = FILTERS[status] ?? FILTERS.PENDING;
    const page = parsePage(searchParams.get('page'));
    // Oldest first while waiting, newest first in the history views
    const order = where === QUEUE_SQL ? 'm.created_at ASC' : 'COALESCE(m.reviewed_at, m.created_at) DESC';

    try {
        const [countRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM moderation_checks m WHERE ${where}`);
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT m.id, m.item_type, m.chapter_id, m.episode_id, m.story_id, m.source, m.declared_mature, m.verdict, m.analysis,
                    m.model, m.status, m.review_note, m.reviewed_at, m.created_at,
                    COALESCE(ch.title, ep.title) AS item_title,
                    COALESCE(ch.chapter_order, ep.episode_order) AS item_number,
                    COALESCE(ch.moderation_status, ep.moderation_status) AS item_status,
                    COALESCE(n.title, c.title) AS story_title,
                    COALESCE(n.is_mature, c.is_mature) AS story_mature,
                    LEFT(ch.content, ${EXCERPT_SOURCE}) AS excerpt, ch.content_format,
                    u.name AS author_name, r.name AS reporter_name, rv.name AS reviewer_name
             FROM moderation_checks m
             LEFT JOIN chapters ch ON ch.id = m.chapter_id
             LEFT JOIN novels n ON n.id = ch.novel_id
             LEFT JOIN comic_episodes ep ON ep.id = m.episode_id
             LEFT JOIN comics c ON c.id = ep.comic_id
             LEFT JOIN users u ON u.id = m.author_id
             LEFT JOIN users r ON r.id = m.reporter_id
             LEFT JOIN users rv ON rv.id = m.reviewer_id
             WHERE ${where}
             ORDER BY ${order}
             LIMIT ? OFFSET ?`,
            [PAGE_SIZE, (page - 1) * PAGE_SIZE]
        );

        const episodeIds = rows.map((r) => r.episode_id).filter(Boolean);
        const pages = new Map<string, { url: string; number: number }[]>();
        if (episodeIds.length > 0) {
            const [pageRows] = await pool.query<RowDataPacket[]>(
                'SELECT episode_id, image_url, page_order FROM comic_pages WHERE episode_id IN (?) ORDER BY page_order', [episodeIds]);
            for (const p of pageRows) {
                if (!pages.has(p.episode_id)) pages.set(p.episode_id, []);
                pages.get(p.episode_id)!.push({ url: p.image_url, number: Number(p.page_order) });
            }
        }

        const items = rows.map((r) => ({
            ...r,
            declared_mature: !!r.declared_mature,
            story_mature: r.story_mature === null ? null : !!r.story_mature,
            excerpt: r.excerpt === null ? null : chapterPlainText(r.excerpt, r.content_format).slice(0, EXCERPT_LENGTH),
            item_number: r.item_number === null ? null : Number(r.item_number),
            // Stuck checks show as waiting, with no verdict
            status: r.status === 'CHECKING' ? 'PENDING' : r.status,
            analysis: parseAnalysis(r.analysis),
            pages: r.episode_id ? pages.get(r.episode_id) ?? [] : [],
        }));
        return NextResponse.json({ items, total: Number(countRows[0].total), page, pageSize: PAGE_SIZE });
    } catch (error) {
        console.error('Failed to load moderation queue (run scripts/add_moderation.ts?):', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
