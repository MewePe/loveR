import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || '';

        let query = 'SELECT id, name, email, role, created_at FROM users';
        const params: any[] = [];

        if (search) {
            query += ' WHERE name LIKE ? OR email LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY created_at DESC LIMIT 50';

        const [users] = await pool.query<RowDataPacket[]>(query, params);
        return NextResponse.json(users);
    } catch (error) {
        console.error('Failed to fetch users:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
