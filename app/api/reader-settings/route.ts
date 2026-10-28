import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { isValidReaderSettings, parseReaderSettings } from '@/lib/readerSettings';

// GET /api/reader-settings → { settings } (null when the user has never saved any)
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT reader_settings FROM users WHERE id = ?', [session.user.id]);
        const raw = rows[0]?.reader_settings;
        return NextResponse.json({ settings: raw ? parseReaderSettings(raw) : null });
    } catch (error) {
        console.error('Failed to load reader settings (run scripts/add_reader_settings.ts?):', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}

// PUT /api/reader-settings { size, leading, font, theme, width } — every field, each from lib/readerSettings.ts.
// DELETE clears them (back to the defaults).
export async function PUT(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    if (!isValidReaderSettings(body)) {
        return NextResponse.json({ error: 'ค่าการตั้งค่าไม่ถูกต้อง' }, { status: 400 });
    }
    try {
        await pool.query('UPDATE users SET reader_settings = ? WHERE id = ?', [JSON.stringify(parseReaderSettings(body)), session.user.id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to save reader settings (run scripts/add_reader_settings.ts?):', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}

export async function DELETE() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    try {
        await pool.query('UPDATE users SET reader_settings = NULL WHERE id = ?', [session.user.id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to clear reader settings:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
