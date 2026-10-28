import pool from '@/lib/db';
import { PoolConnection } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { AdminAction } from '@/lib/adminActions';

export interface AdminLogInput {
    action: AdminAction;
    targetType?: 'USER' | 'NOVEL' | 'COMIC' | 'COMMENT' | 'REPORT' | 'TOPUP' | 'WITHDRAWAL' | 'CATEGORY' | 'SETTINGS';
    targetId?: string | null;
    targetLabel?: string | null; // name/title at the time
    detail?: string | null; // plain text written by the server
    reason?: string | null; // what the admin typed
}

// Record an admin action in admin_logs. Pass the transaction's connection when there is one, so the entry commits
// with the change. Failures (e.g. scripts/add_admin_tools.ts not run yet) are logged and swallowed, like notify():
// the audit log must never stop the action itself.
export async function logAdminAction(adminId: string, entry: AdminLogInput, conn: PoolConnection | typeof pool = pool) {
    try {
        await conn.query(
            `INSERT INTO admin_logs (id, admin_id, admin_name, action, target_type, target_id, target_label, detail, reason)
             VALUES (?, ?, (SELECT name FROM users WHERE id = ?), ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), adminId, adminId, entry.action, entry.targetType ?? null, entry.targetId ?? null,
                entry.targetLabel?.slice(0, 255) ?? null, entry.detail?.slice(0, 500) ?? null, entry.reason || null]
        );
    } catch (error) {
        console.error(`Failed to write admin log ${entry.action} (run scripts/add_admin_tools.ts?):`, error);
    }
}

// YYYY-MM-DD query params for the date filters (?from=&to=); anything else is ignored
export function parseDateParam(value: string | null) {
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : null;
}

// ?page= as a positive integer (default 1)
export function parsePage(value: string | null) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : 1;
}

// WHERE clause for the payment lists: ?status=PENDING|APPROVED|REJECTED, ?from=/?to= (YYYY-MM-DD, `to` inclusive)
// on <alias>.created_at. `alias` is a fixed table alias from the caller, never input.
export function listFilters(searchParams: URLSearchParams, alias: string) {
    const where: string[] = [];
    const params: string[] = [];
    const status = searchParams.get('status');
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
        where.push(`${alias}.status = ?`);
        params.push(status);
    }
    const from = parseDateParam(searchParams.get('from'));
    const to = parseDateParam(searchParams.get('to'));
    if (from) {
        where.push(`${alias}.created_at >= ?`);
        params.push(from);
    }
    if (to) {
        where.push(`${alias}.created_at < DATE_ADD(?, INTERVAL 1 DAY)`);
        params.push(to);
    }
    return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}
