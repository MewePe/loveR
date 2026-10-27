import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { canHaveProfile, getFollowCounts } from '@/lib/authors';

// POST follows the author, DELETE unfollows. Both are idempotent and return { following, followers }.
async function handle(method: 'POST' | 'DELETE', { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const { id } = await params;

    try {
        if (method === 'POST') {
            if (id === session.user.id) {
                return NextResponse.json({ error: 'ติดตามตัวเองไม่ได้' }, { status: 400 });
            }
            if (!(await canHaveProfile(id))) {
                return NextResponse.json({ error: 'ไม่พบนักเขียน' }, { status: 404 });
            }
            await pool.query('INSERT IGNORE INTO follows (follower_id, author_id) VALUES (?, ?)', [session.user.id, id]);
        } else {
            await pool.query('DELETE FROM follows WHERE follower_id = ? AND author_id = ?', [session.user.id, id]);
        }
        const { followers } = await getFollowCounts(id);
        return NextResponse.json({ following: method === 'POST', followers });
    } catch (error) {
        console.error('Failed to update follow:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    return handle('POST', ctx);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    return handle('DELETE', ctx);
}
