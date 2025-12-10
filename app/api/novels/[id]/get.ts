import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

// GET - Fetch single novel
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        const [novels] = await pool.query<RowDataPacket[]>(
            `SELECT n.*, u.name as author_name, c.name as category_name 
             FROM novels n 
             LEFT JOIN users u ON n.author_id = u.id 
             LEFT JOIN categories c ON n.category_id = c.id 
             WHERE n.id = ?`,
            [id]
        );

        if (!novels[0]) {
            return NextResponse.json({ error: 'Novel not found' }, { status: 404 });
        }

        return NextResponse.json(novels[0]);
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
