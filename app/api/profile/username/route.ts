import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkUsername } from '@/lib/profile';

// GET /api/profile/username?username= — live check on /profile/edit while typing
// → { available, username?, current?, error? } (available is true for your own current username too)
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    const raw = new URL(req.url).searchParams.get('username') ?? '';
    try {
        const result = await checkUsername(session.user.id, raw);
        if ('error' in result) return NextResponse.json({ available: false, error: result.error, taken: result.taken });
        return NextResponse.json({ available: true, username: result.username, current: result.current });
    } catch (error) {
        console.error('Failed to check username:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
