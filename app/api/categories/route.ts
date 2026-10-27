import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const [rows] = await pool.query('SELECT id, name, slug FROM categories ORDER BY name');
        return NextResponse.json(rows);
    } catch (error) {
        console.error('Error fetching categories:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
