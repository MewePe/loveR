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

        // Get novel count
        const [novelCount] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM novels WHERE author_id = ?', [userId]);

        // Get comic count
        const [comicCount] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM comics WHERE author_id = ?', [userId]);

        // Sum views from novels and comics
        const [novelViews] = await pool.query<RowDataPacket[]>('SELECT SUM(views) as views FROM novels WHERE author_id = ?', [userId]);
        const [comicViews] = await pool.query<RowDataPacket[]>('SELECT SUM(views) as views FROM comics WHERE author_id = ?', [userId]);

        return NextResponse.json({
            novels: novelCount[0].count,
            comics: comicCount[0].count,
            // SUM() comes back from mysql2 as a DECIMAL string, so convert before adding ("0" + "0" would be "00")
            views: Number(novelViews[0].views || 0) + Number(comicViews[0].views || 0)
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
