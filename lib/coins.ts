import pool from '@/lib/db';
import { RowDataPacket, PoolConnection } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { isOwnerOrAdmin, Viewer } from '@/lib/visibility';

export type ItemKind = 'chapter' | 'episode';

export const MIN_WITHDRAWAL = 100; // baht

// A chapter/episode plus what access depends on. content_status is the parent novel/comic status.
export type AccessItem = { id: string; price: number; author_id: string; content_status: string };

// Price, owning author and parent status of a chapter/episode, or undefined if it doesn't exist
export async function getItem(kind: ItemKind, id: string) {
    const sql = kind === 'chapter'
        ? `SELECT c.id, c.title, c.price, n.author_id, n.status AS content_status FROM chapters c JOIN novels n ON c.novel_id = n.id WHERE c.id = ?`
        : `SELECT e.id, e.title, e.price, c.author_id, c.status AS content_status FROM comic_episodes e JOIN comics c ON e.comic_id = c.id WHERE e.id = ?`;
    const [rows] = await pool.query<RowDataPacket[]>(sql, [id]);
    return rows[0] as (AccessItem & { title: string }) | undefined;
}

// Who can read a chapter/episode:
// - the author and admins: always
// - PUBLISHED: free items for everyone, paid items for buyers
// - ARCHIVED: only people who bought it before it was archived
// - DRAFT / BANNED: nobody else
export async function canAccess(viewer: Viewer, kind: ItemKind, item: AccessItem) {
    if (isOwnerOrAdmin(viewer, item.author_id)) return true;
    if (item.content_status === 'PUBLISHED') {
        if (!item.price || item.price <= 0) return true;
    } else if (item.content_status !== 'ARCHIVED' || !item.price || item.price <= 0) {
        return false;
    }
    if (!viewer?.id) return false;
    const column = kind === 'chapter' ? 'chapter_id' : 'episode_id';
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM purchases WHERE user_id = ? AND ${column} = ? LIMIT 1`,
        [viewer.id, item.id]
    );
    return rows.length > 0;
}

// IDs the user has bought among the given items (for showing lock/unlocked badges in lists)
export async function getPurchasedIds(userId: string | undefined | null, kind: ItemKind, ids: string[]) {
    if (!userId || ids.length === 0) return new Set<string>();
    const column = kind === 'chapter' ? 'chapter_id' : 'episode_id';
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ${column} AS item_id FROM purchases WHERE user_id = ? AND ${column} IN (?)`,
        [userId, ids]
    );
    return new Set(rows.map(r => r.item_id as string));
}

export async function getAuthorSharePercent(conn: PoolConnection | typeof pool = pool) {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT author_share_percent FROM system_settings WHERE id = "1"');
    const value = Number(rows[0]?.author_share_percent);
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : 70;
}

// Earnings minus withdrawals that are pending or paid out. Rejected withdrawals return to the balance.
export async function getAuthorBalance(authorId: string, conn: PoolConnection | typeof pool = pool) {
    const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT
            (SELECT COALESCE(SUM(author_earning), 0) FROM purchases WHERE author_id = ?) AS earned,
            (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE user_id = ? AND status IN ('PENDING', 'APPROVED')) AS withdrawn`,
        [authorId, authorId]
    );
    const earned = Number(rows[0].earned);
    const withdrawn = Number(rows[0].withdrawn);
    return { earned, withdrawn, balance: Math.round((earned - withdrawn) * 100) / 100 };
}

export type PurchaseResult =
    // charged/title/authorId are only set when this call made the sale (not when the item was already owned)
    | { ok: true; coins: number; charged?: number; title?: string; authorId?: string }
    | { ok: false; status: number; error: string };

// Spend the buyer's coins to unlock a chapter/episode. Runs in a transaction with the buyer row locked
// so concurrent requests can't double-spend or double-buy.
export async function purchaseItem(userId: string, kind: ItemKind, itemId: string): Promise<PurchaseResult> {
    const item = await getItem(kind, itemId);
    if (!item || item.content_status !== 'PUBLISHED') return { ok: false, status: 404, error: 'ไม่พบตอนนี้' };
    if (!item.price || item.price <= 0) return { ok: false, status: 400, error: 'ตอนนี้อ่านฟรี' };
    if (item.author_id === userId) return { ok: false, status: 400, error: 'คุณเป็นเจ้าของผลงานนี้' };

    const column = kind === 'chapter' ? 'chapter_id' : 'episode_id';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [users] = await conn.query<RowDataPacket[]>('SELECT coins FROM users WHERE id = ? FOR UPDATE', [userId]);
        if (!users[0]) {
            await conn.rollback();
            return { ok: false, status: 404, error: 'ไม่พบผู้ใช้' };
        }

        const [owned] = await conn.query<RowDataPacket[]>(
            `SELECT 1 FROM purchases WHERE user_id = ? AND ${column} = ? LIMIT 1`,
            [userId, itemId]
        );
        if (owned.length > 0) {
            await conn.rollback();
            return { ok: true, coins: users[0].coins };
        }

        if (users[0].coins < item.price) {
            await conn.rollback();
            return { ok: false, status: 402, error: 'เหรียญไม่พอ กรุณาเติมเหรียญ' };
        }

        const share = await getAuthorSharePercent(conn);
        const authorEarning = Math.round(item.price * share) / 100;

        await conn.query('UPDATE users SET coins = coins - ? WHERE id = ?', [item.price, userId]);
        await conn.query(
            `INSERT INTO purchases (id, user_id, ${column}, item_title, author_id, price, author_earning) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), userId, itemId, item.title, item.author_id, item.price, authorEarning]
        );

        await conn.commit();
        return { ok: true, coins: users[0].coins - item.price, charged: item.price, title: item.title, authorId: item.author_id };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

// Parse a coin price from user input: whole number 0..10000
export function parsePrice(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return 0;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 10000) return null;
    return n;
}
