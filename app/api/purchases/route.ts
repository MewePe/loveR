import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { purchaseItem, ItemKind } from '@/lib/coins';
import { notify, short } from '@/lib/notifications';

// POST - Unlock a paid chapter/episode with coins. Body: { kind: 'chapter' | 'episode', id }
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    try {
        const { kind, id } = await req.json();
        if (!['chapter', 'episode'].includes(kind) || typeof id !== 'string') {
            return NextResponse.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 400 });
        }

        const result = await purchaseItem(session.user.id, kind as ItemKind, id);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }
        // Only for an actual sale (buying something already owned charges nothing). Buyers stay anonymous.
        if (result.charged) {
            await notify([result.authorId], {
                type: 'PURCHASE',
                message: `มีผู้อ่านซื้อ${kind === 'chapter' ? 'บท' : 'ตอน'} "${short(result.title)}" ราคา ${result.charged} เหรียญ`,
                link: '/author?tab=earnings',
            }, session.user.id);
        }
        return NextResponse.json({ success: true, coins: result.coins });
    } catch (error) {
        console.error('Purchase failed:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
