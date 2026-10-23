import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { ContentType } from '@/lib/contentRef';

// Rankings, "similar stories" and "recommended for you". Every query here only returns PUBLISHED novels/comics.
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
} as const;
export type SortKey = keyof typeof SORTS;
export const RANKING_SORTS = ['views', 'rating', 'sales', 'bookmarks'] as const satisfies readonly SortKey[];
export const SEARCH_SORTS = ['newest', 'views', 'rating'] as const satisfies readonly SortKey[];

export function isSortKey<T extends readonly SortKey[]>(allowed: T, value: unknown): value is T[number] {
    return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

export type StoryRow = RowDataPacket & {
    id: string; title: string; cover_image: string | null; views: number;
    author_name: string | null; category_name: string | null;
    rating_avg: number | null; rating_count: number; sales: number; bookmarks: number;
};

// s.* plus author/category names and the aggregated stats. Ratings by BANNED users don't count (same as /api/ratings).
function baseSql(type: ContentType) {
    const t = TABLES[type];
    return `
    SELECT s.*, u.name AS author_name, cat.name AS category_name,
           r.rating_avg, COALESCE(r.rating_count, 0) AS rating_count,
           COALESCE(p.sales, 0) AS sales, COALESCE(b.bookmarks, 0) AS bookmarks
    FROM ${t.table} s
    LEFT JOIN users u ON u.id = s.author_id
    LEFT JOIN categories cat ON cat.id = s.category_id
    LEFT JOIN (SELECT r.${t.ref} AS cid, AVG(r.score) AS rating_avg, COUNT(*) AS rating_count
               FROM ratings r JOIN users ru ON ru.id = r.user_id
               WHERE r.${t.ref} IS NOT NULL AND ru.role != 'BANNED' GROUP BY r.${t.ref}) r ON r.cid = s.id
    LEFT JOIN (SELECT i.${t.itemFk} AS cid, COUNT(*) AS sales
               FROM purchases p JOIN ${t.items} i ON i.id = p.${t.purchaseCol} GROUP BY i.${t.itemFk}) p ON p.cid = s.id
    LEFT JOIN (SELECT ${t.ref} AS cid, COUNT(*) AS bookmarks
               FROM bookmarks WHERE ${t.ref} IS NOT NULL GROUP BY ${t.ref}) b ON b.cid = s.id
    WHERE s.status = 'PUBLISHED'`;
}

// mysql2 returns AVG()/COUNT() as strings; normalise so pages and JSON get numbers
function normalise(rows: RowDataPacket[]) {
    return rows.map((row) => ({
        ...row,
        views: Number(row.views) || 0,
        rating_avg: row.rating_avg === null ? null : Math.round(Number(row.rating_avg) * 10) / 10,
        rating_count: Number(row.rating_count),
        sales: Number(row.sales),
        bookmarks: Number(row.bookmarks),
    })) as StoryRow[];
}

// Public list for /api/novels, /api/comics and /ranking
export async function listStories(type: ContentType, options: {
    sort?: SortKey; categoryId?: string | null; search?: string | null; limit?: number;
} = {}) {
    let sql = baseSql(type);
    const params: (string | number)[] = [];
    if (options.categoryId) {
        sql += ' AND s.category_id = ?';
        params.push(options.categoryId);
    }
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
    return normalise(rows);
}

// Other stories for the detail page: same category first, then the most viewed, so the section is never empty
// just because a category is small.
export async function getSimilarStories(type: ContentType, story: { id: string; category_id: string | null }, limit = 6) {
    const [rows] = await pool.query<RowDataPacket[]>(
        `${baseSql(type)} AND s.id != ?
         ORDER BY (s.category_id <=> ?) DESC, s.views DESC, s.created_at DESC LIMIT ?`,
        [story.id, story.category_id, limit]
    );
    return normalise(rows);
}

// "แนะนำสำหรับคุณ": stories in the categories the user bookmarks (weight 2) and reads (weight 1), counting
// novels and comics together, minus what they've already read or bookmarked and their own work.
// Empty when the user has no history yet.
export async function getRecommendations(userId: string, limit = 6) {
    const weightsSql = `
        SELECT category_id, SUM(w) AS weight FROM (
            SELECT n.category_id, 2 AS w FROM bookmarks b JOIN novels n ON n.id = b.novel_id WHERE b.user_id = ?
            UNION ALL SELECT c.category_id, 2 FROM bookmarks b JOIN comics c ON c.id = b.comic_id WHERE b.user_id = ?
            UNION ALL SELECT n.category_id, 1 FROM reading_history h JOIN novels n ON n.id = h.novel_id WHERE h.user_id = ?
            UNION ALL SELECT c.category_id, 1 FROM reading_history h JOIN comics c ON c.id = h.comic_id WHERE h.user_id = ?
        ) x WHERE category_id IS NOT NULL GROUP BY category_id`;

    const lists = await Promise.all((['novel', 'comic'] as const).map(async (type) => {
        const ref = TABLES[type].ref;
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM (${baseSql(type)}) s
             JOIN (${weightsSql}) w ON w.category_id = s.category_id
             WHERE NOT (s.author_id <=> ?)
               AND s.id NOT IN (SELECT ${ref} FROM reading_history WHERE user_id = ? AND ${ref} IS NOT NULL)
               AND s.id NOT IN (SELECT ${ref} FROM bookmarks WHERE user_id = ? AND ${ref} IS NOT NULL)
             ORDER BY w.weight DESC, s.views DESC LIMIT ?`,
            [userId, userId, userId, userId, userId, userId, userId, limit]
        );
        return normalise(rows).map((row) => ({ ...row, type, weight: Number(row.weight) }));
    }));

    return lists.flat()
        .sort((a, b) => b.weight - a.weight || b.views - a.views)
        .slice(0, limit);
}
