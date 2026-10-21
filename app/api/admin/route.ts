import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

export async function GET() {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check admin role
    const [users] = await pool.query<RowDataPacket[]>('SELECT role FROM users WHERE email = ?', [session.user.email]);
    if (users[0]?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const [userCount] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM users');
        const [novelCount] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM novels');
        const [chapterCount] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM chapters');
        const [comicCount] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM comics');
        const [reportCount] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM reports WHERE status = "PENDING"');

        return NextResponse.json({
            users: userCount[0].count,
            novels: novelCount[0].count,
            chapters: chapterCount[0].count,
            comics: comicCount[0].count,
            reports: reportCount[0].count,
        });
    } catch (error) {
        console.error('Failed to fetch admin stats:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
