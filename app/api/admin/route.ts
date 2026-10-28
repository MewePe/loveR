import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { SPENT_SQL } from '@/lib/analytics';
import { listStories } from '@/lib/ranking';

const ACTIVITY_LIMIT = 10;

// GET /api/admin — numbers for the admin overview: stat cards, the 5 most viewed published stories
// (novels and comics together) and the latest activity across the site.
// "This month"/"today" use MySQL's clock, like lib/analytics.ts.
export async function GET() {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' }, { status: 403 });
    }

    try {
        const [[stats]] = await pool.query<RowDataPacket[]>(`
            SELECT
                (SELECT COUNT(*) FROM users) AS users,
                (SELECT COUNT(*) FROM users WHERE created_at >= CURDATE()) AS new_users_today,
                (SELECT COUNT(*) FROM users WHERE role = 'AUTHOR') AS authors,
                (SELECT COUNT(*) FROM users WHERE role = 'BANNED') AS banned_users,
                (SELECT COUNT(*) FROM novels) AS novels,
                (SELECT COUNT(*) FROM comics) AS comics,
                (SELECT COUNT(*) FROM chapters) AS chapters,
                (SELECT COUNT(*) FROM reports WHERE status = 'PENDING') AS reports,
                (SELECT COALESCE(SUM(amount), 0) FROM coin_topups
                 WHERE status = 'APPROVED' AND updated_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS topup_month,
                (SELECT COALESCE(SUM(amount - author_earning), 0) FROM ${SPENT_SQL} spent) AS platform_revenue,
                (SELECT COALESCE(SUM(amount - author_earning), 0) FROM ${SPENT_SQL} spent
                 WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS platform_revenue_month`);

        const [novels, comics] = await Promise.all([
            listStories('novel', { sort: 'views', limit: 5 }),
            listStories('comic', { sort: 'views', limit: 5 }),
        ]);
        const topStories = [
            ...novels.map((s) => ({ type: 'novel' as const, s })),
            ...comics.map((s) => ({ type: 'comic' as const, s })),
        ]
            .sort((a, b) => b.s.views - a.s.views)
            .slice(0, 5)
            .map(({ type, s }) => ({
                type, id: s.id, title: s.title, cover_image: s.cover_image, views: s.views, author_name: s.author_name,
                rating_avg: s.rating_avg, sales: s.sales,
            }));

        // Latest events of each kind, merged. user_id lets the page open the user's detail view.
        const [activity] = await pool.query<RowDataPacket[]>(`
            SELECT * FROM (
                (SELECT 'USER_REGISTER' AS kind, u.id AS user_id, u.name AS user_name, NULL AS label, NULL AS amount, NULL AS status, u.created_at
                 FROM users u ORDER BY u.created_at DESC LIMIT ${ACTIVITY_LIMIT})
                UNION ALL
                (SELECT 'NOVEL_CREATE', s.author_id, u.name, s.title, NULL, s.status, s.created_at
                 FROM novels s LEFT JOIN users u ON u.id = s.author_id ORDER BY s.created_at DESC LIMIT ${ACTIVITY_LIMIT})
                UNION ALL
                (SELECT 'COMIC_CREATE', s.author_id, u.name, s.title, NULL, s.status, s.created_at
                 FROM comics s LEFT JOIN users u ON u.id = s.author_id ORDER BY s.created_at DESC LIMIT ${ACTIVITY_LIMIT})
                UNION ALL
                (SELECT 'TOPUP', t.user_id, u.name, NULL, t.amount, t.status, t.created_at
                 FROM coin_topups t LEFT JOIN users u ON u.id = t.user_id ORDER BY t.created_at DESC LIMIT ${ACTIVITY_LIMIT})
                UNION ALL
                (SELECT 'PURCHASE', p.user_id, u.name, p.item_title, p.price, NULL, p.created_at
                 FROM purchases p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT ${ACTIVITY_LIMIT})
                UNION ALL
                (SELECT 'WITHDRAWAL', w.user_id, u.name, NULL, w.amount, w.status, w.created_at
                 FROM withdrawals w LEFT JOIN users u ON u.id = w.user_id ORDER BY w.created_at DESC LIMIT ${ACTIVITY_LIMIT})
                UNION ALL
                (SELECT 'REPORT', r.reporter_id, u.name, r.target_type, NULL, r.status, r.created_at
                 FROM reports r LEFT JOIN users u ON u.id = r.reporter_id ORDER BY r.created_at DESC LIMIT ${ACTIVITY_LIMIT})
            ) a ORDER BY created_at DESC LIMIT ${ACTIVITY_LIMIT}`);

        const n = (v: unknown) => Number(v) || 0;
        return NextResponse.json({
            users: n(stats.users),
            new_users_today: n(stats.new_users_today),
            authors: n(stats.authors),
            banned_users: n(stats.banned_users),
            novels: n(stats.novels),
            comics: n(stats.comics),
            stories: n(stats.novels) + n(stats.comics),
            chapters: n(stats.chapters),
            reports: n(stats.reports),
            topup_month: n(stats.topup_month),
            platform_revenue: Math.round(n(stats.platform_revenue) * 100) / 100,
            platform_revenue_month: Math.round(n(stats.platform_revenue_month) * 100) / 100,
            top_stories: topStories,
            activity: activity.map((a) => ({ ...a, amount: a.amount === null ? null : Number(a.amount) })),
        });
    } catch (error) {
        console.error('Failed to fetch admin stats:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
