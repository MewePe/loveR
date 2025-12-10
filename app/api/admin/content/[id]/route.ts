import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { status, type } = await req.json(); // type: 'novels' or 'comics'

    if (!['DRAFT', 'PUBLISHED', 'BANNED'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const table = type === 'comics' ? 'comics' : 'novels';

    try {
        await pool.query(`UPDATE ${table} SET status = ? WHERE id = ?`, [status, id]);
        return NextResponse.json({ message: 'Content updated successfully' });
    } catch (error) {
        console.error('Failed to update content:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
