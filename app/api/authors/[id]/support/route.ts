import { NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { canHaveProfile } from '@/lib/authors';
import { parseSupport, supportAuthor } from '@/lib/coins';
import { notify, short } from '@/lib/notifications';

// POST { amount, message? } — send coins to an author ("สนับสนุน"). The author gets amount x author share
// (lib/coins.ts supportAuthor) and a notification with the supporter's name and message.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 400 });
    }
    const parsed = parseSupport(body);
    if ('error' in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
        if (!(await canHaveProfile(id))) {
            return NextResponse.json({ error: 'ไม่พบนักเขียน' }, { status: 404 });
        }
        const result = await supportAuthor(session.user.id, id, parsed.amount, parsed.message);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        // The session name can be stale after a profile edit; use the current one
        const [me] = await pool.query<RowDataPacket[]>('SELECT name FROM users WHERE id = ?', [session.user.id]);
        await notify([id], {
            type: 'SUPPORT',
            message: `${short(me[0]?.name) || 'ผู้อ่าน'} สนับสนุนคุณ ${parsed.amount.toLocaleString()} เหรียญ${parsed.message ? `: "${short(parsed.message, 100)}"` : ''}`,
            link: '/author?tab=earnings',
        }, session.user.id);

        return NextResponse.json({ success: true, coins: result.coins, amount: result.amount });
    } catch (error) {
        console.error('Failed to send support:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
