import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { isPublicUploadUrl } from '@/lib/upload';
import { ensureUsername, parseSocialLinks, validateSocialLinks } from '@/lib/authors';
import { normalizeUsername } from '@/lib/username';

const MAX_BIO = 1000;

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
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 400 });

    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (body.username !== undefined) {
        const username = normalizeUsername(body.username);
        if (!username) {
            return NextResponse.json({ error: 'ชื่อผู้ใช้ต้องมี 3-30 ตัว ใช้ได้เฉพาะ a-z, 0-9 และ _' }, { status: 400 });
        }
        updates.push('username = ?');
        values.push(username);
    }
    if (body.bio !== undefined) {
        if (body.bio !== null && typeof body.bio !== 'string') return NextResponse.json({ error: 'ข้อความแนะนำตัวไม่ถูกต้อง' }, { status: 400 });
        const bio = (body.bio ?? '').trim();
        if (bio.length > MAX_BIO) return NextResponse.json({ error: `ข้อความแนะนำตัวยาวได้ไม่เกิน ${MAX_BIO} ตัวอักษร` }, { status: 400 });
        updates.push('bio = ?');
        values.push(bio || null);
    }
    if (body.cover_image !== undefined) {
        if (body.cover_image && !isPublicUploadUrl(body.cover_image)) {
            return NextResponse.json({ error: 'รูปปกไม่ถูกต้อง' }, { status: 400 });
        }
        updates.push('cover_image = ?');
        values.push(body.cover_image || null);
    }
    if (body.social_links !== undefined) {
        const parsed = validateSocialLinks(body.social_links);
        if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
        updates.push('social_links = ?');
        values.push(Object.keys(parsed.links).length ? JSON.stringify(parsed.links) : null);
    }
    if (updates.length === 0) return NextResponse.json({ error: 'ไม่มีข้อมูลที่ต้องแก้ไข' }, { status: 400 });

    try {
        values.push(session.user.id);
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
        const [rows] = await pool.query<RowDataPacket[]>('SELECT username FROM users WHERE id = ?', [session.user.id]);
        return NextResponse.json({ success: true, username: rows[0]?.username });
    } catch (error) {
        if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ error: 'ชื่อผู้ใช้นี้มีคนใช้แล้ว' }, { status: 409 });
        }
        console.error('Failed to update public profile:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
