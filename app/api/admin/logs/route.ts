import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { parseDateParam, parsePage } from '@/lib/adminLog';
import { isAdminAction } from '@/lib/adminActions';

const PAGE_SIZE = 30;

// GET /api/admin/logs?action=&adminId=&targetId=&from=&to=&page= → { logs, total, page, pageSize, admins }
// Newest first. `admins` lists everyone who appears in the log, for the filter dropdown.
export async function GET(req: Request) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const page = parsePage(searchParams.get('page'));
        const where: string[] = [];
        const params: string[] = [];
        const action = searchParams.get('action');
        if (isAdminAction(action)) {
            where.push('l.action = ?');
            params.push(action);
        }
        for (const [param, column] of [['adminId', 'l.admin_id'], ['targetId', 'l.target_id']] as const) {
            const value = searchParams.get(param);
            if (value) {
                where.push(`${column} = ?`);
                params.push(value);
            }
        }
        const from = parseDateParam(searchParams.get('from'));
        const to = parseDateParam(searchParams.get('to'));
        if (from) {
            where.push('l.created_at >= ?');
            params.push(from);
        }
        if (to) {
            where.push('l.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
            params.push(to);
        }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const [[count]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM admin_logs l ${whereSql}`, params);
        const [logs] = await pool.query<RowDataPacket[]>(
            `SELECT l.id, l.admin_id, COALESCE(u.name, l.admin_name) AS admin_name, l.action, l.target_type, l.target_id,
                    l.target_label, l.detail, l.reason, l.created_at
             FROM admin_logs l LEFT JOIN users u ON u.id = l.admin_id
             ${whereSql} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
            [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]
        );
        const [admins] = await pool.query<RowDataPacket[]>(
            `SELECT DISTINCT l.admin_id AS id, COALESCE(u.name, l.admin_name) AS name
             FROM admin_logs l LEFT JOIN users u ON u.id = l.admin_id WHERE l.admin_id IS NOT NULL ORDER BY name`);
        return NextResponse.json({ logs, total: Number(count.total), page, pageSize: PAGE_SIZE, admins });
    } catch (error) {
        console.error('Failed to fetch admin logs:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
