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
    const { status, reason } = await req.json();

    if (!['APPROVED', 'REJECTED'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Update writer profile status
        await connection.query(
            'UPDATE writer_profiles SET status = ?, rejection_reason = ? WHERE user_id = ?',
            [status, reason || null, id]
        );

        // If approved, update user role to AUTHOR
        if (status === 'APPROVED') {
            await connection.query(
                'UPDATE users SET role = "AUTHOR" WHERE id = ?',
                [id]
            );
        }

        await connection.commit();
        return NextResponse.json({ message: 'Writer request updated successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Failed to update writer request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        connection.release();
    }
}
