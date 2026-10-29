import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { MIN_AGE, ageOn, parseBirthDate, toIsoDate } from '@/lib/age';
import { AGE_COOKIE, AGE_COOKIE_MAX_AGE } from '@/lib/ageGate';

// POST /api/age-verification { day, month, year (พ.ศ.) } → { allowed }
// The age is worked out here, not in the browser. A pass is remembered in a cookie for everyone and, for a
// logged-in user, as users.birth_date so it follows them to other browsers. A fail stores nothing.
export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const birth = parseBirthDate(body?.day, body?.month, body?.year);
    if (!birth) {
        return NextResponse.json({ error: 'วันเกิดไม่ถูกต้อง' }, { status: 400 });
    }

    const allowed = ageOn(birth) >= MIN_AGE;
    if (!allowed) return NextResponse.json({ allowed: false });

    const session = await auth();
    if (session?.user?.id) {
        try {
            await pool.query('UPDATE users SET birth_date = ? WHERE id = ?', [toIsoDate(birth), session.user.id]);
        } catch (error) {
            // The cookie below still lets them in on this browser
            console.error('Failed to save birth date (run scripts/add_moderation.ts?):', error);
        }
    }

    const res = NextResponse.json({ allowed: true });
    res.cookies.set(AGE_COOKIE, '1', {
        maxAge: AGE_COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    });
    return res;
}
