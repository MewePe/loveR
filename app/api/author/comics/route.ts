import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user ID
        const [users] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [session.user.email]);
        if (!users[0]) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        const userId = users[0].id;

        // Get comics (all status)
        const [comics] = await pool.query<RowDataPacket[]>(
            `SELECT c.*, cat.name as category_name 
             FROM comics c 
             LEFT JOIN categories cat ON c.category_id = cat.id 
             WHERE c.author_id = ? 
             ORDER BY c.created_at DESC`,
            [userId]
        );

        return NextResponse.json(comics);
    } catch (error) {
        console.error('Error fetching comics:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
