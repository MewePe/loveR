import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { withCategories } from '@/lib/categories';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
        }

        // Get user ID
        const [users] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [session.user.email]);
        if (!users[0]) {
            return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
        }
        const userId = users[0].id;

        // Get comics (all status)
        const [comics] = await pool.query<RowDataPacket[]>(
            `SELECT c.*
             FROM comics c 
             WHERE c.author_id = ? 
             ORDER BY c.created_at DESC`,
            [userId]
        );

        return NextResponse.json(await withCategories('comic', comics as (RowDataPacket & { id: string })[]));
    } catch (error) {
        console.error('Error fetching comics:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
