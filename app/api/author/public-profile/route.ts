import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { ensureUsername, parseSocialLinks } from '@/lib/authors';
import { updateProfile } from '@/lib/profile';

// Older author-only endpoint for the public profile fields. The editor is now /profile/edit (PATCH /api/profile,
// every user); this stays for compatibility and uses the same validation (lib/profile.ts).
function canEdit(role: string | undefined) {
    return role === 'AUTHOR' || role === 'ADMIN';
}

// GET - the signed-in author's public profile fields (shown at /profile/<username>)
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    if (!canEdit(session.user.role)) return NextResponse.json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' }, { status: 403 });

    try {
        await ensureUsername(session.user.id);
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id, name, image, username, bio, cover_image, social_links FROM users WHERE id = ?',
            [session.user.id]
        );
        const u = rows[0];
        if (!u) return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
        return NextResponse.json({ ...u, social_links: parseSocialLinks(u.social_links) });
    } catch (error) {
        console.error('Failed to load public profile:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}

// PATCH { username?, bio?, cover_image?, social_links? } — fields that are left out stay as they are
export async function PATCH(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    if (!canEdit(session.user.role)) return NextResponse.json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' }, { status: 403 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 400 });

    try {
        const result = await updateProfile(session.user.id, body, ['username', 'bio', 'cover_image', 'social_links']);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ success: true, username: result.username });
    } catch (error) {
        console.error('Failed to update public profile:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
