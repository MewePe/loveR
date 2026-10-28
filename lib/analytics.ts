import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Time buckets for the dashboard charts: the last 30 days by day, or the last 12 months by month.
// Bucket keys come from MySQL's own clock (CURDATE()) so they match DATE_FORMAT() in the queries.
export const RANGES = {
    '30d': { format: '%Y-%m-%d', start: 'CURDATE() - INTERVAL 29 DAY' },
    '12m': { format: '%Y-%m', start: "DATE_FORMAT(CURDATE() - INTERVAL 11 MONTH, '%Y-%m-01')" },
} as const;
export type RangeKey = keyof typeof RANGES;

export function parseRange(value: string | null): RangeKey {
    return value === '12m' ? '12m' : '30d';
}

// Every bucket key in the range, oldest first, so days/months without data still show as 0
export async function bucketKeys(range: RangeKey) {
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today`);
    const [y, m, d] = (rows[0].today as string).split('-').map(Number);
    const pad = (n: number) => String(n).padStart(2, '0');
    const keys: string[] = [];
    if (range === '30d') {
        for (let i = 29; i >= 0; i--) {
            const day = new Date(Date.UTC(y, m - 1, d - i));
            keys.push(`${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`);
        }
    } else {
        for (let i = 11; i >= 0; i--) {
            const month = new Date(Date.UTC(y, m - 1 - i, 1));
            keys.push(`${month.getUTCFullYear()}-${pad(month.getUTCMonth() + 1)}`);
        }
    }
    return keys;
}

// Run a "SELECT <bucket> AS bucket, <values...> ... GROUP BY bucket" query (built by the caller with
// `bucketExpr()` and `rangeStart()`) and spread it over every bucket key, filling gaps with 0.
export async function seriesByBucket<K extends string>(keys: string[], fields: K[], sql: string, params: unknown[]) {
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    const byKey = new Map(rows.map((r) => [r.bucket as string, r]));
    return keys.map((key) => {
        const row = byKey.get(key);
        const point: Record<string, string | number> = { bucket: key };
        for (const field of fields) point[field] = Number(row?.[field] ?? 0);
        return point as { bucket: string } & Record<K, number>;
    });
}

export function bucketExpr(range: RangeKey, column: string) {
    return `DATE_FORMAT(${column}, '${RANGES[range].format}')`;
}

export function rangeStart(range: RangeKey) {
    return RANGES[range].start;
}

// Every coin spent: chapter/episode purchases plus supports sent to authors (amount, author_earning, created_at).
// The platform's share of each row is amount - author_earning.
export const SPENT_SQL = `(SELECT price AS amount, author_earning, created_at FROM purchases
                    UNION ALL SELECT amount, author_earning, created_at FROM supports)`;
