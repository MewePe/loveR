import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { purchaseItem, ItemKind } from '@/lib/coins';

// POST - Unlock a paid chapter/episode with coins. Body: { kind: 'chapter' | 'episode', id }
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { kind, id } = await req.json();
        if (!['chapter', 'episode'].includes(kind) || typeof id !== 'string') {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const result = await purchaseItem(session.user.id, kind as ItemKind, id);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }
        return NextResponse.json({ success: true, coins: result.coins });
    } catch (error) {
        console.error('Purchase failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
