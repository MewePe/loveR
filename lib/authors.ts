import pool from '@/lib/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { defaultUsername, normalizeUsername } from '@/lib/username';
export { profileHref } from '@/lib/username';
import { CategoryTag, withCategories } from '@/lib/categories';
import type { ContentType } from '@/lib/contentRef';

// Public author profiles (/profile/[username]): lookup, follow counts, top fans and published works.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------- social links ----------

export const SOCIAL_PLATFORMS = [
    { key: 'facebook', label: 'Facebook' },
    { key: 'x', label: 'X' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'tiktok', label: 'TikTok' },
    { key: 'youtube', label: 'YouTube' },
    { key: 'website', label: 'เว็บไซต์' },
] as const;
export type SocialKey = typeof SOCIAL_PLATFORMS[number]['key'];
export type SocialLinks = Partial<Record<SocialKey, string>>;
const MAX_URL = 300;

// Only absolute http(s) URLs: anything else (javascript:, data:, relative paths) is rejected
export function isSafeUrl(value: string) {
    if (value.length > MAX_URL) return false;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
}

// Stored JSON -> links, dropping anything unknown or unsafe (the column could predate validation)
export function parseSocialLinks(json: string | null | undefined): SocialLinks {
    if (!json) return {};
    try {
        const data = JSON.parse(json);
        const links: SocialLinks = {};
        for (const { key } of SOCIAL_PLATFORMS) {
            if (typeof data?.[key] === 'string' && isSafeUrl(data[key])) links[key] = data[key];
        }
        return links;
    } catch {
        return {};
    }
}

// Request body -> links to store. Empty strings clear a platform.
export function validateSocialLinks(input: unknown): { links: SocialLinks } | { error: string } {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return { error: 'ลิงก์โซเชียลไม่ถูกต้อง' };
    const links: SocialLinks = {};
    for (const { key, label } of SOCIAL_PLATFORMS) {
        const value = (input as Record<string, unknown>)[key];
        if (value === undefined || value === null || value === '') continue;
        if (typeof value !== 'string' || !isSafeUrl(value.trim())) {
            return { error: `ลิงก์ ${label} ต้องขึ้นต้นด้วย https:// และยาวไม่เกิน ${MAX_URL} ตัวอักษร` };
        }
        links[key] = value.trim();
    }
    return { links };
}

// ---------- profile lookup ----------

export type PublicAuthor = {
    id: string; name: string | null; username: string | null; image: string | null;
    bio: string | null; cover_image: string | null; social_links: SocialLinks;
};

// The author shown at /profile/<param>. <param> is a username, or a user id (old links / users without one).
// Only authors and admins, or anyone with a published story, have a public profile; banned users don't.
export async function getPublicAuthor(param: string): Promise<PublicAuthor | null> {
    const byId = UUID_PATTERN.test(param);
    const username = byId ? null : normalizeUsername(param);
    if (!byId && !username) return null;
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT u.id, u.name, u.username, u.image, u.bio, u.cover_image, u.social_links, u.role,
                (EXISTS (SELECT 1 FROM novels WHERE author_id = u.id AND status = 'PUBLISHED')
                 OR EXISTS (SELECT 1 FROM comics WHERE author_id = u.id AND status = 'PUBLISHED')) AS has_published
         FROM users u WHERE ${byId ? 'u.id' : 'u.username'} = ?`,
        [byId ? param : username]
    );
    const u = rows[0];
    if (!u || u.role === 'BANNED') return null;
    if (u.role !== 'AUTHOR' && u.role !== 'ADMIN' && !Number(u.has_published)) return null;
    return {
        id: u.id, name: u.name, username: u.username, image: u.image, bio: u.bio,
        cover_image: u.cover_image, social_links: parseSocialLinks(u.social_links),
    };
}

export async function canHaveProfile(userId: string) {
    return !!(await getPublicAuthor(userId));
}

// Give a user a username if they don't have one (new sign-ups, accounts created by scripts)
export async function ensureUsername(userId: string) {
    for (let attempt = 0; attempt < 7; attempt++) {
        const [result] = await pool.query<ResultSetHeader>(
            'UPDATE IGNORE users SET username = ? WHERE id = ? AND username IS NULL',
            [defaultUsername(userId, attempt), userId]
        );
        if (result.affectedRows > 0) return;
        const [rows] = await pool.query<RowDataPacket[]>('SELECT username FROM users WHERE id = ?', [userId]);
        if (!rows[0] || rows[0].username) return;
    }
}

// ---------- follows ----------

export async function getFollowCounts(userId: string) {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT (SELECT COUNT(*) FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.author_id = ? AND u.role != 'BANNED') AS followers,
                (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following`,
        [userId, userId]
    );
    return { followers: Number(rows[0].followers), following: Number(rows[0].following) };
}

export async function isFollowing(followerId: string | null | undefined, authorId: string) {
    if (!followerId) return false;
    const [rows] = await pool.query<RowDataPacket[]>('SELECT 1 FROM follows WHERE follower_id = ? AND author_id = ?', [followerId, authorId]);
    return rows.length > 0;
}

export async function getFollowerIds(authorId: string) {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT follower_id FROM follows WHERE author_id = ?', [authorId]);
    return rows.map((r) => r.follower_id as string);
}

// ---------- top fans ----------

export const TOP_FANS = 10;

// Readers who spent the most coins on this author: chapter/episode purchases plus supports. Banned users and
// the author themselves are left out. Ties go to whoever spent first. Amounts stay private (not returned).
export async function getTopFans(authorId: string, limit = TOP_FANS) {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT u.id, u.name, u.image, SUM(x.amount) AS total, MIN(x.created_at) AS since
         FROM (SELECT user_id, price AS amount, created_at FROM purchases WHERE author_id = ?
               UNION ALL SELECT user_id, amount, created_at FROM supports WHERE author_id = ?) x
         JOIN users u ON u.id = x.user_id
         WHERE u.role != 'BANNED' AND u.id != ?
         GROUP BY u.id, u.name, u.image
         HAVING total > 0
         ORDER BY total DESC, since ASC
         LIMIT ?`,
        [authorId, authorId, authorId, limit]
    );
    return rows.map((r) => ({ id: r.id as string, name: r.name as string | null, image: r.image as string | null }));
}

// ---------- works ----------

export type AuthorWork = {
    id: string; title: string; description: string | null; cover_image: string | null; is_completed: boolean;
    views: number; items: number; comments: number; categories: CategoryTag[];
};

const WORK_TABLES = {
    novel: { table: 'novels', items: 'chapters', itemFk: 'novel_id', commentFk: 'novel_id' },
    comic: { table: 'comics', items: 'comic_episodes', itemFk: 'comic_id', commentFk: 'comic_id' },
} as const;

// Published stories of one type with chapter/episode count, views and comment count (comments by banned
// users don't count, same as the comment list)
export async function getAuthorWorks(authorId: string, type: ContentType): Promise<AuthorWork[]> {
    const t = WORK_TABLES[type];
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.title, s.description, s.cover_image, s.is_completed, s.views,
                (SELECT COUNT(*) FROM ${t.items} i WHERE i.${t.itemFk} = s.id AND i.moderation_status = 'APPROVED') AS items,
                (SELECT COUNT(*) FROM comments c JOIN users cu ON cu.id = c.user_id
                 WHERE c.${t.commentFk} = s.id AND cu.role != 'BANNED') AS comments
         FROM ${t.table} s WHERE s.author_id = ? AND s.status = 'PUBLISHED'
         ORDER BY s.updated_at DESC`,
        [authorId]
    );
    const works = rows.map((r) => ({
        id: r.id as string, title: r.title as string, description: r.description as string | null,
        cover_image: r.cover_image as string | null, is_completed: !!r.is_completed,
        views: Number(r.views) || 0, items: Number(r.items), comments: Number(r.comments),
    }));
    return withCategories(type, works);
}
