import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { ResultSetHeader } from 'mysql2';

// BANNED users can't log in and existing sessions end on their next request (see lib/auth.ts)
const ASSIGNABLE_ROLES = ['READER', 'AUTHOR', 'ADMIN', 'BANNED'];

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

    if (!ASSIGNABLE_ROLES.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    // Prevent admins from demoting/banning themselves and locking everyone out
    if (id === session.user.id) {
        return NextResponse.json({ error: 'ไม่สามารถเปลี่ยนบทบาทของตัวเองได้' }, { status: 400 });
    }

    try {
        const [result] = await pool.query<ResultSetHeader>('UPDATE users SET role = ? WHERE id = ?', [role, id]);
        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        return NextResponse.json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Failed to update user:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
