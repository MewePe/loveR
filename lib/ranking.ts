import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { ContentType } from '@/lib/contentRef';
import { CATEGORY_TABLES, CategoryTag, withCategories } from '@/lib/categories';

// Rankings, "similar stories" and "recommended for you". Every query here only returns PUBLISHED novels/comics,
// and every row comes back with its `categories` (lib/categories.ts).
// Table/column names and ORDER BY clauses are fixed per content type and sort key (never built from input).

const TABLES = {
    novel: { table: 'novels', items: 'chapters', itemFk: 'novel_id', purchaseCol: 'chapter_id', ref: 'novel_id' },
    comic: { table: 'comics', items: 'comic_episodes', itemFk: 'comic_id', purchaseCol: 'episode_id', ref: 'comic_id' },
} as const;

export const SORTS = {
    newest: { label: 'ใหม่ล่าสุด', order: 's.created_at DESC' },
    views: { label: 'ยอดวิว', order: 's.views DESC, s.created_at DESC' },
    // Unrated stories go last; among equal averages, more ratings first
    rating: { label: 'คะแนน', order: 'r.rating_avg IS NULL, r.rating_avg DESC, rating_count DESC, s.views DESC' },
    sales: { label: 'ยอดขาย', order: 'sales DESC, s.views DESC' },
    bookmarks: { label: 'บุ๊กมาร์ก', order: 'bookmarks DESC, s.views DESC' },
    // Latest chapter/episode first (stories without one go last); used by "อัปเดตล่าสุด" on the home page
    updated: { label: 'อัปเดตล่าสุด', order: 'last_item_at IS NULL, last_item_at DESC' },
} as const;
export type SortKey = keyof typeof SORTS;
export const RANKING_SORTS = ['views', 'rating', 'sales', 'bookmarks'] as const satisfies readonly SortKey[];
export const SEARCH_SORTS = ['newest', 'views', 'rating'] as const satisfies readonly SortKey[];

// days = today plus the days before it (a rolling window, so "รายสัปดาห์" isn't nearly empty on a Monday).
// 'all' uses the all-time totals.
export const RANKING_PERIODS = {
    day: { label: 'รายวัน', note: 'วันนี้', days: 1 },
    week: { label: 'รายสัปดาห์', note: '7 วันล่าสุด', days: 7 },
    month: { label: 'รายเดือน', note: '30 วันล่าสุด', days: 30 },
    all: { label: 'ทั้งหมด', note: 'ตลอดกาล', days: null },
} as const;
export type RankingPeriod = keyof typeof RANKING_PERIODS;

export function isRankingPeriod(value: unknown): value is RankingPeriod {
    return typeof value === 'string' && Object.keys(RANKING_PERIODS).includes(value);
}

// Inside a period only stories with activity for that stat rank, so a quiet day shows an empty state
// instead of 50 stories tied at zero.
const PERIOD_RANKINGS = {
    views: { filter: 'v.views > 0', order: 'v.views DESC, s.views DESC' },
    rating: { filter: 'r.rating_count > 0', order: 'r.rating_avg DESC, rating_count DESC, v.views DESC' },
    sales: { filter: 'p.sales > 0', order: 'sales DESC, v.views DESC' },
    bookmarks: { filter: 'b.bookmarks > 0', order: 'bookmarks DESC, v.views DESC' },
} as const;

export function isSortKey<T extends readonly SortKey[]>(allowed: T, value: unknown): value is T[number] {
    return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

export type StoryRow = RowDataPacket & {
    id: string; title: string; description: string | null; cover_image: string | null; views: number;
    author_id: string | null; author_name: string | null; author_username: string | null; categories: CategoryTag[];
    rating_avg: number | null; rating_count: number; sales: number; bookmarks: number;
    item_count: number; last_item_at: Date | null; is_completed: boolean; is_mature: boolean;
};

// s.* plus the author's name/username and the aggregated stats (item_count / last_item_at = number of chapters or
// episodes and when the newest was added, counting only ones that passed the content check). Ratings by BANNED
// users don't count (same as /api/ratings).
// With a period the ratings, sales and bookmarks only count what happened in it (a rating by when it was last
// given or changed) and period_views holds the views. item_count stays the story's total.
function baseSql(type: ContentType, period: RankingPeriod = 'all') {
    const t = TABLES[type];
    const { days } = RANKING_PERIODS[period];
    const since = days ? `DATE_SUB(CURDATE(), INTERVAL ${days - 1} DAY)` : null;
    const inPeriod = (column: string) => (since ? ` AND ${column} >= ${since}` : '');
    return `
    SELECT s.*, u.name AS author_name, u.username AS author_username,${since ? ' COALESCE(v.views, 0) AS period_views,' : ''}
           r.rating_avg, COALESCE(r.rating_count, 0) AS rating_count,
           COALESCE(p.sales, 0) AS sales, COALESCE(b.bookmarks, 0) AS bookmarks,
           COALESCE(ic.item_count, 0) AS item_count, ic.last_item_at
    FROM ${t.table} s
    LEFT JOIN users u ON u.id = s.author_id
    LEFT JOIN (SELECT r.${t.ref} AS cid, AVG(r.score) AS rating_avg, COUNT(*) AS rating_count
               FROM ratings r JOIN users ru ON ru.id = r.user_id
               WHERE r.${t.ref} IS NOT NULL AND ru.role != 'BANNED'${inPeriod('r.updated_at')} GROUP BY r.${t.ref}) r ON r.cid = s.id
    LEFT JOIN (SELECT i.${t.itemFk} AS cid, COUNT(*) AS sales
               FROM purchases p JOIN ${t.items} i ON i.id = p.${t.purchaseCol}${inPeriod('p.created_at')} GROUP BY i.${t.itemFk}) p ON p.cid = s.id
    LEFT JOIN (SELECT ${t.ref} AS cid, COUNT(*) AS bookmarks
               FROM bookmarks WHERE ${t.ref} IS NOT NULL${inPeriod('created_at')} GROUP BY ${t.ref}) b ON b.cid = s.id
    LEFT JOIN (SELECT ${t.itemFk} AS cid, COUNT(*) AS item_count, MAX(created_at) AS last_item_at
               FROM ${t.items} WHERE moderation_status = 'APPROVED' GROUP BY ${t.itemFk}) ic ON ic.cid = s.id
    ${since ? `LEFT JOIN (SELECT ${t.ref} AS cid, SUM(views) AS views FROM story_views_daily
               WHERE ${t.ref} IS NOT NULL${inPeriod('view_date')} GROUP BY ${t.ref}) v ON v.cid = s.id` : ''}
    WHERE s.status = 'PUBLISHED'`;
}

// mysql2 returns AVG()/COUNT() as strings; normalise so pages and JSON get numbers. Also attaches categories.
async function normalise(type: ContentType, rows: RowDataPacket[]) {
    const stories = await withCategories(type, rows.map((row) => ({
        ...row,
        id: row.id as string,
        views: Number(row.period_views ?? row.views) || 0,
        rating_avg: row.rating_avg === null ? null : Math.round(Number(row.rating_avg) * 10) / 10,
        rating_count: Number(row.rating_count),
        sales: Number(row.sales),
        bookmarks: Number(row.bookmarks),
        item_count: Number(row.item_count),
        is_completed: !!row.is_completed,
        is_mature: !!row.is_mature,
    })));
    return stories as StoryRow[];
}

// Public list for /api/novels, /api/comics, /ranking and /category/[slug]
export async function listStories(type: ContentType, options: {
    sort?: SortKey; categoryIds?: string[]; search?: string | null; limit?: number; completed?: boolean; hasItems?: boolean;
} = {}) {
    let sql = baseSql(type);
    const params: (string | number | string[])[] = [];
    // Only stories that have every one of the chosen categories
    if (options.categoryIds?.length) {
        const c = CATEGORY_TABLES[type];
        sql += ` AND s.id IN (SELECT ${c.fk} FROM ${c.table} WHERE category_id IN (?) GROUP BY ${c.fk} HAVING COUNT(*) = ?)`;
        params.push(options.categoryIds, options.categoryIds.length);
    }
    if (options.completed) sql += ' AND s.is_completed = 1';
    if (options.hasItems) sql += ' AND ic.item_count > 0';
    if (options.search) {
        sql += ' AND (s.title LIKE ? OR s.description LIKE ?)';
        params.push(`%${options.search}%`, `%${options.search}%`);
    }
    sql += ` ORDER BY ${SORTS[options.sort ?? 'newest'].order}`;
    if (options.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
    }
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    return normalise(type, rows);
}

// /ranking: every stat on the rows (views included) covers the chosen period
export async function listRanking(type: ContentType, sort: (typeof RANKING_SORTS)[number], period: RankingPeriod, limit: number) {
    if (period === 'all') return listStories(type, { sort, limit });
    const { filter, order } = PERIOD_RANKINGS[sort];
    const [rows] = await pool.query<RowDataPacket[]>(`${baseSql(type, period)} AND ${filter} ORDER BY ${order} LIMIT ?`, [limit]);
    return normalise(type, rows);
}

// Other stories for the detail page: the most categories in common first, then the most viewed, so the section
// is never empty just because the categories are small (or the story has none).
export async function getSimilarStories(type: ContentType, storyId: string, limit = 6) {
    const c = CATEGORY_TABLES[type];
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT s.*, COALESCE(m.shared, 0) AS shared FROM (${baseSql(type)}) s
         LEFT JOIN (SELECT ${c.fk} AS sid, COUNT(*) AS shared FROM ${c.table}
                    WHERE category_id IN (SELECT category_id FROM ${c.table} WHERE ${c.fk} = ?)
                    GROUP BY ${c.fk}) m ON m.sid = s.id
         WHERE s.id != ?
         ORDER BY shared DESC, s.views DESC, s.created_at DESC LIMIT ?`,
        [storyId, storyId, limit]
    );
    return normalise(type, rows);
}

// "แนะนำสำหรับคุณ": every category of each story the user bookmarked gets weight 2, of each story they read
// weight 1, counting novels and comics together. A story scores the sum of the weights of all its categories.
// Minus what they've already read or bookmarked and their own work. Empty when the user has no history yet.
export async function getRecommendations(userId: string, limit = 6) {
    const weightsSql = `
        SELECT category_id, SUM(w) AS weight FROM (
            SELECT nc.category_id, 2 AS w FROM bookmarks b JOIN novel_categories nc ON nc.novel_id = b.novel_id WHERE b.user_id = ?
            UNION ALL SELECT cc.category_id, 2 FROM bookmarks b JOIN comic_categories cc ON cc.comic_id = b.comic_id WHERE b.user_id = ?
            UNION ALL SELECT nc.category_id, 1 FROM reading_history h JOIN novel_categories nc ON nc.novel_id = h.novel_id WHERE h.user_id = ?
            UNION ALL SELECT cc.category_id, 1 FROM reading_history h JOIN comic_categories cc ON cc.comic_id = h.comic_id WHERE h.user_id = ?
        ) x GROUP BY category_id`;

    const lists = await Promise.all((['novel', 'comic'] as const).map(async (type) => {
        const ref = TABLES[type].ref;
        const c = CATEGORY_TABLES[type];
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT s.*, w.weight FROM (${baseSql(type)}) s
             JOIN (SELECT sc.${c.fk} AS sid, SUM(uw.weight) AS weight
                   FROM ${c.table} sc JOIN (${weightsSql}) uw ON uw.category_id = sc.category_id
                   GROUP BY sc.${c.fk}) w ON w.sid = s.id
             WHERE NOT (s.author_id <=> ?)
               AND s.id NOT IN (SELECT ${ref} FROM reading_history WHERE user_id = ? AND ${ref} IS NOT NULL)
               AND s.id NOT IN (SELECT ${ref} FROM bookmarks WHERE user_id = ? AND ${ref} IS NOT NULL)
             ORDER BY w.weight DESC, s.views DESC LIMIT ?`,
            [userId, userId, userId, userId, userId, userId, userId, limit]
        );
        return (await normalise(type, rows)).map((row) => ({ ...row, type, weight: Number(row.weight) }));
    }));

    return lists.flat()
        .sort((a, b) => b.weight - a.weight || b.views - a.views)
        .slice(0, limit);
}
