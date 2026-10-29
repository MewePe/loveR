import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { ContentType } from '@/lib/contentRef';
import { StoryRow, listStories } from '@/lib/ranking';
import { short } from '@/lib/notifications';

// Data for the home page sections (app/page.tsx). Every list only has PUBLISHED stories.

export type TypedStory = StoryRow & { type: ContentType };

const ITEMS = {
    novel: { table: 'chapters', fk: 'novel_id', order: 'chapter_order', label: 'บทที่' },
    comic: { table: 'comic_episodes', fk: 'comic_id', order: 'episode_order', label: 'ตอนที่' },
} as const;

const typed = (type: ContentType, rows: StoryRow[]) => rows.map((s) => ({ ...s, type }));

// Novels and comics merged, highest views first
async function mergedByViews(limit: number, options: Parameters<typeof listStories>[1] = {}) {
    const [novels, comics] = await Promise.all([
        listStories('novel', { ...options, sort: 'views', limit }),
        listStories('comic', { ...options, sort: 'views', limit }),
    ]);
    return [...typed('novel', novels), ...typed('comic', comics)].sort((a, b) => b.views - a.views).slice(0, limit);
}

// Banner slides: the most viewed stories that have at least one chapter, preferring ones with a cover.
// 18+ stories are left out of the banner.
export async function getFeatured(limit = 5) {
    const stories = (await mergedByViews(limit * 3, { hasItems: true }))
        .filter((s) => !s.is_mature)
        .sort((a, b) => Number(!!b.cover_image) - Number(!!a.cover_image) || b.views - a.views)
        .slice(0, limit);
    // "อ่านเลย" opens the first chapter/episode
    const first = new Map<string, string>();
    for (const type of ['novel', 'comic'] as const) {
        const ids = stories.filter((s) => s.type === type).map((s) => s.id);
        if (ids.length === 0) continue;
        const t = ITEMS[type];
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, ${t.fk} AS story_id FROM ${t.table} WHERE ${t.fk} IN (?) AND moderation_status = 'APPROVED' ORDER BY ${t.order}, created_at`, [ids]);
        for (const r of rows) if (!first.has(r.story_id)) first.set(r.story_id, r.id);
    }
    return stories.map((s) => ({ ...s, description: short(s.description, 160), first_item_id: first.get(s.id) ?? null }));
}

export const getTopStories = (limit = 10) => mergedByViews(limit);
export const getCompleted = (limit = 12) => mergedByViews(limit, { completed: true });

export type LatestUpdate = TypedStory & { latest: { id: string; title: string; number: number | null; label: string; created_at: Date } | null };

// Stories with the newest chapters/episodes, each with its latest one (title, number, when)
export async function getLatestUpdates(limit = 12): Promise<LatestUpdate[]> {
    const [novels, comics] = await Promise.all([
        listStories('novel', { sort: 'updated', limit, hasItems: true }),
        listStories('comic', { sort: 'updated', limit, hasItems: true }),
    ]);
    const stories = [...typed('novel', novels), ...typed('comic', comics)]
        .sort((a, b) => new Date(b.last_item_at ?? 0).getTime() - new Date(a.last_item_at ?? 0).getTime())
        .slice(0, limit);

    const latest = new Map<string, LatestUpdate['latest']>();
    for (const type of ['novel', 'comic'] as const) {
        const ids = stories.filter((s) => s.type === type).map((s) => s.id);
        if (ids.length === 0) continue;
        const t = ITEMS[type];
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, title, ${t.order} AS number, ${t.fk} AS story_id, created_at FROM ${t.table}
             WHERE ${t.fk} IN (?) AND moderation_status = 'APPROVED' ORDER BY created_at DESC, ${t.order} DESC`,
            [ids]
        );
        for (const r of rows) {
            if (!latest.has(r.story_id)) latest.set(r.story_id, { id: r.id, title: r.title, number: r.number, label: t.label, created_at: r.created_at });
        }
    }
    return stories.map((s) => ({ ...s, latest: latest.get(s.id) ?? null }));
}

export interface ContinueItem {
    type: ContentType; id: string; title: string; cover_image: string | null; is_mature: boolean;
    item_id: string | null; item_title: string | null; item_number: number | null; item_label: string;
    item_count: number; read_at: Date;
}

// "อ่านต่อ": the user's latest reads (reading_history), newest first. Hides stories that are no longer
// PUBLISHED unless they are the user's own (same rule as /api/history). Empty if the table is missing.
export async function getContinueReading(userId: string, limit = 12): Promise<ContinueItem[]> {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM (
                SELECT 'novel' AS type, n.id, n.title, n.cover_image, n.is_mature, h.chapter_id AS item_id, c.title AS item_title,
                       c.chapter_order AS item_number, (SELECT COUNT(*) FROM chapters WHERE novel_id = n.id AND moderation_status = 'APPROVED') AS item_count, h.read_at
                FROM reading_history h JOIN novels n ON n.id = h.novel_id LEFT JOIN chapters c ON c.id = h.chapter_id
                WHERE h.user_id = ? AND (n.status = 'PUBLISHED' OR n.author_id = ?)
                UNION ALL
                SELECT 'comic', m.id, m.title, m.cover_image, m.is_mature, h.episode_id, e.title,
                       e.episode_order, (SELECT COUNT(*) FROM comic_episodes WHERE comic_id = m.id AND moderation_status = 'APPROVED'), h.read_at
                FROM reading_history h JOIN comics m ON m.id = h.comic_id LEFT JOIN comic_episodes e ON e.id = h.episode_id
                WHERE h.user_id = ? AND (m.status = 'PUBLISHED' OR m.author_id = ?)
             ) x ORDER BY read_at DESC LIMIT ?`,
            [userId, userId, userId, userId, limit]
        );
        return rows.map((r) => ({
            type: r.type, id: r.id, title: r.title, cover_image: r.cover_image, is_mature: !!r.is_mature,
            item_id: r.item_id, item_title: r.item_title, item_number: r.item_number === null ? null : Number(r.item_number),
            item_label: ITEMS[r.type as ContentType].label, item_count: Number(r.item_count), read_at: r.read_at,
        }));
    } catch (error) {
        console.error('Failed to load continue reading:', error);
        return [];
    }
}

export interface TopAuthor { id: string; name: string | null; username: string | null; image: string | null; views: number; works: number; followers: number; }

// Authors by total views of their published stories (BANNED users never appear)
export async function getTopAuthors(limit = 12): Promise<TopAuthor[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT u.id, u.name, u.username, u.image, SUM(w.views) AS views, COUNT(*) AS works,
                (SELECT COUNT(*) FROM follows f WHERE f.author_id = u.id) AS followers
         FROM (SELECT author_id, views FROM novels WHERE status = 'PUBLISHED'
               UNION ALL SELECT author_id, views FROM comics WHERE status = 'PUBLISHED') w
         JOIN users u ON u.id = w.author_id
         WHERE u.role != 'BANNED'
         GROUP BY u.id ORDER BY views DESC, followers DESC LIMIT ?`,
        [limit]
    );
    return rows.map((r) => ({ id: r.id, name: r.name, username: r.username, image: r.image, views: Number(r.views) || 0, works: Number(r.works), followers: Number(r.followers) }));
}

export async function getCategoryList() {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, name, slug FROM categories ORDER BY name');
    return rows as { id: string; name: string; slug: string }[];
}
