import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { ensureUsername, parseSocialLinks } from '@/lib/authors';
import { updateProfile } from '@/lib/profile';

// GET - the signed-in user's account and profile fields (Navbar, /profile/edit) plus reading stats
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
        }
        await ensureUsername(session.user.id);

        const [users] = await pool.query<RowDataPacket[]>(
            'SELECT id, name, email, image, role, coins, username, bio, cover_image, social_links, created_at FROM users WHERE id = ?',
            [session.user.id]
        );
        if (!users[0]) {
            return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
        }
        const user = { ...users[0], social_links: parseSocialLinks(users[0].social_links) };

        const userId = session.user.id;
        const [bookmarks] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?', [userId]);
        // Number of different novels/comics the user has opened a chapter/episode of (lib/readingHistory.ts)
        const [read] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(novel_id) AS novels, COUNT(comic_id) AS comics FROM reading_history WHERE user_id = ?',
            [userId]
        );
        const stats = {
            novelsRead: Number(read[0]?.novels) || 0,
            comicsRead: Number(read[0]?.comics) || 0,
            bookmarks: Number(bookmarks[0]?.count) || 0,
        };

        return NextResponse.json({ user, stats });
    } catch (error) {
        console.error('Error fetching profile:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}

// PATCH { name?, image?, username?, bio?, cover_image?, social_links? } — any signed-in user edits their own
// profile (lib/profile.ts). Username taken → 409.
export async function PATCH(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return NextResponse.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 400 });
    }
    try {
        const result = await updateProfile(session.user.id, body);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ success: true, username: result.username });
    } catch (error) {
        console.error('Error updating profile:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
