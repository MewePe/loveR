import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { parsePage } from '@/lib/adminLog';

const PAGE_SIZE = 20;
// A banned user's role is BANNED; the role they had before is in role_before_ban
const EFFECTIVE_ROLE = "CASE WHEN role = 'BANNED' THEN COALESCE(role_before_ban, 'READER') ELSE role END";

// GET /api/admin/users?search=&role=READER|AUTHOR|ADMIN&status=active|banned&page=
// → { users, total, page, pageSize }. `role` filters on the role before the ban too.
export async function GET(req: Request) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search')?.trim() || '';
        const role = searchParams.get('role');
        const status = searchParams.get('status');
        const page = parsePage(searchParams.get('page'));

        const where: string[] = [];
        const params: (string | number)[] = [];
        if (search) {
            where.push('(name LIKE ? OR email LIKE ? OR username LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (role && ['READER', 'AUTHOR', 'ADMIN'].includes(role)) {
            where.push(`${EFFECTIVE_ROLE} = ?`);
            params.push(role);
        }
        if (status === 'banned') where.push("role = 'BANNED'");
        else if (status === 'active') where.push("role != 'BANNED'");
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const [[count]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM users ${whereSql}`, params);
        const [users] = await pool.query<RowDataPacket[]>(
            `SELECT id, name, email, username, image, role, ${EFFECTIVE_ROLE} AS base_role, role = 'BANNED' AS is_banned,
                    ban_reason, banned_at, coins, created_at
             FROM users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]
        );
        return NextResponse.json({
            users: users.map((u) => ({ ...u, is_banned: !!u.is_banned })),
            total: Number(count.total),
            page,
            pageSize: PAGE_SIZE,
        });
    } catch (error) {
        console.error('Failed to fetch users:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
