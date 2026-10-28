import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { parsePage } from '@/lib/adminLog';
import { CATEGORY_TABLES, withCategories } from '@/lib/categories';

const PAGE_SIZE = 20;

// Fixed per type (never built from input)
const TABLES = {
    novel: { table: 'novels', items: 'chapters', itemFk: 'novel_id', purchaseCol: 'chapter_id', ref: 'novel_id', report: 'NOVEL' },
    comic: { table: 'comics', items: 'comic_episodes', itemFk: 'comic_id', purchaseCol: 'episode_id', ref: 'comic_id', report: 'COMIC' },
} as const;

// "ซ่อน" in the admin filter = everything that isn't public and isn't banned
const STATUS_FILTERS: Record<string, string> = {
    published: "s.status = 'PUBLISHED'",
    hidden: "s.status IN ('DRAFT', 'ARCHIVED')",
    banned: "s.status = 'BANNED'",
};

// GET /api/admin/content?type=novels|comics&search=&categoryId=&status=published|hidden|banned&page=
// → { items, total, page, pageSize }. Every status is listed. Each row has its stats (chapters/episodes, views,
// sales, revenue, rating, comments, bookmarks, pending reports; ratings/comments by BANNED users don't count)
// and its categories.
export async function GET(req: Request) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') === 'comics' ? 'comic' : 'novel';
        const t = TABLES[type];
        const c = CATEGORY_TABLES[type];
        const page = parsePage(searchParams.get('page'));
        const search = searchParams.get('search')?.trim();
        const categoryId = searchParams.get('categoryId');
        const status = searchParams.get('status') ?? '';

        const where: string[] = [];
        const params: (string | number)[] = [];
        if (search) {
            where.push('(s.title LIKE ? OR u.name LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }
        if (categoryId) {
            where.push(`s.id IN (SELECT ${c.fk} FROM ${c.table} WHERE category_id = ?)`);
            params.push(categoryId);
        }
        if (STATUS_FILTERS[status]) where.push(STATUS_FILTERS[status]);
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const [[count]] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS total FROM ${t.table} s LEFT JOIN users u ON u.id = s.author_id ${whereSql}`, params);
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT s.id, s.title, s.cover_image, s.status, s.is_completed, s.views, s.created_at, s.updated_at,
                    s.author_id, u.name AS author_name, u.username AS author_username,
                    (SELECT COUNT(*) FROM ${t.items} WHERE ${t.itemFk} = s.id) AS item_count,
                    (SELECT COUNT(*) FROM purchases p JOIN ${t.items} i ON i.id = p.${t.purchaseCol} WHERE i.${t.itemFk} = s.id) AS sales,
                    (SELECT COALESCE(SUM(p.price), 0) FROM purchases p JOIN ${t.items} i ON i.id = p.${t.purchaseCol} WHERE i.${t.itemFk} = s.id) AS revenue,
                    (SELECT AVG(r.score) FROM ratings r JOIN users ru ON ru.id = r.user_id WHERE r.${t.ref} = s.id AND ru.role != 'BANNED') AS rating_avg,
                    (SELECT COUNT(*) FROM ratings r JOIN users ru ON ru.id = r.user_id WHERE r.${t.ref} = s.id AND ru.role != 'BANNED') AS rating_count,
                    (SELECT COUNT(*) FROM comments cm JOIN users cu ON cu.id = cm.user_id WHERE cm.${t.ref} = s.id AND cu.role != 'BANNED') AS comments,
                    (SELECT COUNT(*) FROM bookmarks b WHERE b.${t.ref} = s.id) AS bookmarks,
                    (SELECT COUNT(*) FROM reports rp WHERE rp.target_type = '${t.report}' AND rp.target_id = s.id AND rp.status = 'PENDING') AS pending_reports
             FROM ${t.table} s LEFT JOIN users u ON u.id = s.author_id
             ${whereSql}
             ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
            [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]
        );

        const items = await withCategories(type, rows.map((r) => ({
            ...r,
            id: r.id as string,
            is_completed: !!r.is_completed,
            views: Number(r.views) || 0,
            item_count: Number(r.item_count),
            sales: Number(r.sales),
            revenue: Number(r.revenue),
            rating_avg: r.rating_avg === null ? null : Math.round(Number(r.rating_avg) * 10) / 10,
            rating_count: Number(r.rating_count),
            comments: Number(r.comments),
            bookmarks: Number(r.bookmarks),
            pending_reports: Number(r.pending_reports),
        })));
        return NextResponse.json({ items, total: Number(count.total), page, pageSize: PAGE_SIZE });
    } catch (error) {
        console.error('Failed to fetch content:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
