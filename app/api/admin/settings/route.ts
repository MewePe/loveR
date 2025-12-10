import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
    try {
        const [settings] = await pool.query<RowDataPacket[]>('SELECT * FROM system_settings WHERE id = "1"');
        return NextResponse.json(settings[0] || {});
    } catch (error) {
        console.error('Failed to fetch settings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { site_name, site_description, contact_email, maintenance_mode } = await req.json();

        await pool.query(
            `UPDATE system_settings 
             SET site_name = ?, site_description = ?, contact_email = ?, maintenance_mode = ? 
             WHERE id = "1"`,
            [site_name, site_description, contact_email, maintenance_mode]
        );

        return NextResponse.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Failed to update settings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
