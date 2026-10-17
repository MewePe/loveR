import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { RowDataPacket } from 'mysql2';
import pool from '@/lib/db';

// Node.js runtime so the middleware can query MySQL (stable since Next 15.5)
export const config = {
    runtime: 'nodejs',
    matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)'],
};

// Paths that stay reachable during maintenance so admins can log in and turn it off
const ALWAYS_ALLOWED = ['/maintenance', '/login', '/api/auth', '/api/admin/settings'];

const CACHE_MS = 10_000;
let cached: { value: boolean; at: number } | null = null;

async function isMaintenanceMode(): Promise<boolean> {
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT maintenance_mode FROM system_settings WHERE id = "1"');
        cached = { value: !!rows[0]?.maintenance_mode, at: Date.now() };
    } catch (error) {
        // If the DB is unreachable, don't lock everyone out because of it
        console.error('Failed to read maintenance mode:', error);
        cached = { value: false, at: Date.now() };
    }
    return cached.value;
}

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    if (ALWAYS_ALLOWED.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
        return NextResponse.next();
    }

    if (!(await isMaintenanceMode())) {
        return NextResponse.next();
    }

    const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET,
        secureCookie: req.nextUrl.protocol === 'https:',
    });
    if (token?.role === 'ADMIN') {
        return NextResponse.next();
    }

    if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'ระบบปิดปรับปรุงชั่วคราว' }, { status: 503 });
    }
    return NextResponse.rewrite(new URL('/maintenance', req.url), { status: 503 });
}
