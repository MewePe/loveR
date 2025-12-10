import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
        await pool.query('DELETE FROM categories WHERE id = ?', [id]);
        return NextResponse.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Failed to delete category:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
