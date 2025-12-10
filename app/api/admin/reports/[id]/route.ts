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
    const { status } = await req.json();

    if (!['PENDING', 'RESOLVED', 'IGNORED'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    try {
        await pool.query('UPDATE reports SET status = ? WHERE id = ?', [status, id]);
        return NextResponse.json({ message: 'Report updated successfully' });
    } catch (error) {
        console.error('Failed to update report:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
