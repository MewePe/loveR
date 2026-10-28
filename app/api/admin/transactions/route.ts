import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { parseDateParam, parsePage } from '@/lib/adminLog';

const PAGE_SIZE = 30;

// One SELECT per kind of money movement, all with the same column names (each must name its own, because any one
// of them can be the first or only SELECT of the UNION). Purchases, supports and coin adjustments are
// final as soon as they exist, so their status is COMPLETED. `counterparty` is the author (purchase/support) or the
// admin (adjustment); `amount` is negative when an adjustment removed coins.
const KINDS = {
    TOPUP: `SELECT 'TOPUP' AS kind, t.id, t.user_id, u.name AS user_name, t.amount, t.status, t.rejection_reason AS detail,
                   NULL AS counterparty, t.slip_image, t.created_at
            FROM coin_topups t LEFT JOIN users u ON u.id = t.user_id`,
    PURCHASE: `SELECT 'PURCHASE' AS kind, p.id, p.user_id, u.name AS user_name, p.price AS amount, 'COMPLETED' AS status, p.item_title AS detail,
                      a.name AS counterparty, NULL AS slip_image, p.created_at
               FROM purchases p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN users a ON a.id = p.author_id`,
    SUPPORT: `SELECT 'SUPPORT' AS kind, s.id, s.user_id, u.name AS user_name, s.amount, 'COMPLETED' AS status, s.message AS detail,
                     a.name AS counterparty, NULL AS slip_image, s.created_at
              FROM supports s LEFT JOIN users u ON u.id = s.user_id LEFT JOIN users a ON a.id = s.author_id`,
    WITHDRAWAL: `SELECT 'WITHDRAWAL' AS kind, w.id, w.user_id, u.name AS user_name, w.amount, w.status,
                        CONCAT_WS(' ', w.bank_name, w.bank_account_number, w.rejection_reason) AS detail, NULL AS counterparty, w.slip_image, w.created_at
                 FROM withdrawals w LEFT JOIN users u ON u.id = w.user_id`,
    ADJUSTMENT: `SELECT 'ADJUSTMENT' AS kind, c.id, c.user_id, u.name AS user_name, c.amount, 'COMPLETED' AS status, c.reason AS detail,
                        a.name AS counterparty, NULL AS slip_image, c.created_at
                 FROM coin_adjustments c LEFT JOIN users u ON u.id = c.user_id LEFT JOIN users a ON a.id = c.admin_id`,
} as const;
type Kind = keyof typeof KINDS;
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'];

// GET /api/admin/transactions?type=TOPUP|PURCHASE|SUPPORT|WITHDRAWAL|ADJUSTMENT&status=&from=&to=&search=&page=
// → { items, total, page, pageSize, sums: { [kind]: total amount within the filter } }. Newest first.
export async function GET(req: Request) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type');
        const kinds = (type && Object.hasOwn(KINDS, type) ? [type] : Object.keys(KINDS)) as Kind[];
        const page = parsePage(searchParams.get('page'));

        const where: string[] = [];
        const params: string[] = [];
        const status = searchParams.get('status');
        if (status && STATUSES.includes(status)) {
            where.push('status = ?');
            params.push(status);
        }
        const from = parseDateParam(searchParams.get('from'));
        const to = parseDateParam(searchParams.get('to'));
        if (from) {
            where.push('created_at >= ?');
            params.push(from);
        }
        if (to) {
            where.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)');
            params.push(to);
        }
        const search = searchParams.get('search')?.trim();
        if (search) {
            where.push('(user_name LIKE ? OR counterparty LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        const fromSql = `(${kinds.map((k) => KINDS[k]).join(' UNION ALL ')}) tx ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
        const [sums] = await pool.query<RowDataPacket[]>(
            `SELECT kind, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount FROM ${fromSql} GROUP BY kind`, params);
        const [items] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM ${fromSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]);

        return NextResponse.json({
            items: items.map((i) => ({ ...i, amount: Number(i.amount) })),
            total: sums.reduce((n, s) => n + Number(s.count), 0),
            page,
            pageSize: PAGE_SIZE,
            sums: Object.fromEntries(sums.map((s) => [s.kind, Math.round(Number(s.amount) * 100) / 100])),
        });
    } catch (error) {
        console.error('Failed to fetch transactions:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
