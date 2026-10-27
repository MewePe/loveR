import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

export async function GET() {
    try {
        const [settings] = await pool.query<RowDataPacket[]>('SELECT * FROM system_settings WHERE id = "1"');
        return NextResponse.json(settings[0] || {});
    } catch (error) {
        console.error('Failed to fetch settings:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    try {
        const body = await req.json();

        if (body.author_share_percent !== undefined) {
            const share = Number(body.author_share_percent);
            if (!Number.isInteger(share) || share < 0 || share > 100) {
                return NextResponse.json({ error: 'ส่วนแบ่งนักเขียนต้องเป็นจำนวนเต็ม 0-100' }, { status: 400 });
            }
        }

        // Only update fields that were sent, so forms that show a subset of settings don't wipe the rest
        const fields = ['site_name', 'site_description', 'contact_email', 'maintenance_mode', 'author_share_percent', 'payment_info']
            .filter(key => body[key] !== undefined);
        if (fields.length === 0) {
            return NextResponse.json({ error: 'ไม่มีการตั้งค่าที่ต้องบันทึก' }, { status: 400 });
        }

        await pool.query(
            `UPDATE system_settings SET ${fields.map(key => `${key} = ?`).join(', ')} WHERE id = "1"`,
            fields.map(key => body[key])
        );

        return NextResponse.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Failed to update settings:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
