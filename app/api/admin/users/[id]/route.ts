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
    const { role } = await req.json();

    if (!['READER', 'WRITER', 'ADMIN', 'BANNED'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    try {
        await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
        return NextResponse.json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Failed to update user:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
