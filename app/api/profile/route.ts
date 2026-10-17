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

        // Get user profile
        const [users] = await pool.query<RowDataPacket[]>(
            'SELECT id, name, email, image, role, coins, created_at FROM users WHERE email = ?',
            [session.user.email]
        );

        if (!users[0]) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const user = users[0];

        // Get stats (basic placeholders - can be enhanced later)
        const [bookmarks] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?',
            [user.id]
        );

        const stats = {
            novelsRead: 0, // Can track reading history later
            comicsRead: 0,
            bookmarks: bookmarks[0]?.count || 0
        };

        return NextResponse.json({ user, stats });
    } catch (error) {
        console.error('Error fetching profile:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { name, image } = body;

        const updates: string[] = [];
        const values: any[] = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (image !== undefined) {
            updates.push('image = ?');
            values.push(image);
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        values.push(session.user.email);
        await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE email = ?`,
            values
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating profile:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
