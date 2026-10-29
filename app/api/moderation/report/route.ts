import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { mockDirective, reportMislabel } from '@/lib/moderation';

// POST /api/moderation/report { item_type: 'chapter' | 'episode', item_id } — "รายงานว่าติดป้ายผิด" from the reader
// pages. Sends the chapter/episode back to the admin content check queue with a fresh API check → { queued }
// (false when it is already waiting there).
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const itemType = body?.item_type;
    if ((itemType !== 'chapter' && itemType !== 'episode') || typeof body?.item_id !== 'string') {
        return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }

    try {
        const result = await reportMislabel(session.user.id, itemType, body.item_id, mockDirective(req));
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ success: true, queued: result.queued });
    } catch (error) {
        console.error('Failed to report a wrong content label:', error);
        return NextResponse.json({ error: 'ส่งรายงานไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
    }
}
