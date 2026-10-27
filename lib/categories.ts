import pool from '@/lib/db';
import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { ContentType } from '@/lib/contentRef';

// Multiple categories per novel/comic, stored in novel_categories / comic_categories in the order the author
// picked them. novels.category_id / comics.category_id mirror the first one (kept for older code and backups);
// read the junction tables, not that column. Table/column names come from here, never from input.

export const MAX_CATEGORIES = 5;

export const CATEGORY_TABLES = {
    novel: { table: 'novel_categories', fk: 'novel_id', parent: 'novels' },
    comic: { table: 'comic_categories', fk: 'comic_id', parent: 'comics' },
} as const;

export type CategoryTag = { id: string; name: string; slug: string };

// Validate a list of category ids from a request body: unique, at most MAX_CATEGORIES, and all existing.
// Returns the ids in the given order, or an error message for the user.
export async function parseCategoryIds(value: unknown): Promise<{ ids: string[] } | { error: string }> {
    if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
        return { error: 'หมวดหมู่ไม่ถูกต้อง' };
    }
    const ids = [...new Set((value as string[]).filter(Boolean))];
    if (ids.length > MAX_CATEGORIES) {
        return { error: `เลือกหมวดหมู่ได้ไม่เกิน ${MAX_CATEGORIES} หมวด` };
    }
    if (ids.length > 0) {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM categories WHERE id IN (?)', [ids]);
        if (rows.length !== ids.length) return { error: 'หมวดหมู่ไม่ถูกต้อง' };
    }
    return { ids };
}

// Request bodies send categoryIds (array). The old single categoryId field is still accepted.
// undefined = leave the categories as they are.
export function categoryIdsFromBody(body: { categoryIds?: unknown; categoryId?: unknown }): unknown {
    if (body.categoryIds !== undefined) return body.categoryIds;
    if (body.categoryId !== undefined) return body.categoryId ? [body.categoryId] : [];
    return undefined;
}

// Replace a story's categories (ids already validated by parseCategoryIds). Run inside the caller's transaction.
export async function setStoryCategories(conn: PoolConnection, type: ContentType, storyId: string, ids: string[]) {
    const t = CATEGORY_TABLES[type];
    await conn.query(`DELETE FROM ${t.table} WHERE ${t.fk} = ?`, [storyId]);
    if (ids.length > 0) {
        await conn.query(
            `INSERT INTO ${t.table} (${t.fk}, category_id, sort_order) VALUES ?`,
            [ids.map((id, i) => [storyId, id, i])]
        );
    }
    await conn.query(`UPDATE ${t.parent} SET category_id = ? WHERE id = ?`, [ids[0] ?? null, storyId]);
}

// { storyId: [tags in the author's order] } for the given stories
export async function getCategoriesFor(type: ContentType, storyIds: string[]): Promise<Map<string, CategoryTag[]>> {
    const map = new Map<string, CategoryTag[]>();
    if (storyIds.length === 0) return map;
    const t = CATEGORY_TABLES[type];
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT sc.${t.fk} AS story_id, c.id, c.name, c.slug
         FROM ${t.table} sc JOIN categories c ON c.id = sc.category_id
         WHERE sc.${t.fk} IN (?) ORDER BY sc.sort_order, c.name`,
        [storyIds]
    );
    for (const row of rows) {
        const list = map.get(row.story_id) ?? [];
        list.push({ id: row.id, name: row.name, slug: row.slug });
        map.set(row.story_id, list);
    }
    return map;
}

// Adds `categories` (CategoryTag[]) to each row
export async function withCategories<T extends { id: string }>(type: ContentType, rows: T[]): Promise<(T & { categories: CategoryTag[] })[]> {
    const map = await getCategoriesFor(type, rows.map((r) => r.id));
    return rows.map((row) => ({ ...row, categories: map.get(row.id) ?? [] }));
}

export async function getCategoryBySlug(slug: string): Promise<CategoryTag | null> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, name, slug FROM categories WHERE slug = ?', [slug]);
    return (rows[0] as CategoryTag | undefined) ?? null;
}

// Filter values from a query string: ?categoryId=a&categoryId=b or ?categoryId=a,b
export function categoryIdsFromQuery(searchParams: URLSearchParams): string[] {
    return [...new Set(searchParams.getAll('categoryId').flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean))]
        .slice(0, MAX_CATEGORIES);
}
