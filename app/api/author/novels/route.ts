import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

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

        // Get novels (all status)
        const [novels] = await pool.query<RowDataPacket[]>(
            `SELECT n.*, c.name as category_name 
             FROM novels n 
             LEFT JOIN categories c ON n.category_id = c.id 
             WHERE n.author_id = ? 
             ORDER BY n.created_at DESC`,
            [userId]
        );

        return NextResponse.json(novels);
    } catch (error) {
        console.error('Error fetching novels:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
