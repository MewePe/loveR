import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

// GET - List all author requests (Admin only)
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const [users] = await pool.query<RowDataPacket[]>('SELECT role FROM users WHERE email = ?', [session.user.email]);
        if (!users[0] || users[0].role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const [requests] = await pool.query<RowDataPacket[]>(`
            SELECT ar.*, u.name as user_name, u.email as user_email
            FROM author_requests ar
            JOIN users u ON ar.user_id = u.id
            ORDER BY 
                CASE ar.status 
                    WHEN 'PENDING' THEN 1 
                    WHEN 'APPROVED' THEN 2 
                    WHEN 'REJECTED' THEN 3 
                END,
                ar.created_at DESC
        `);

        return NextResponse.json(requests);
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PATCH - Approve or reject request (Admin only)
export async function PATCH(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const [users] = await pool.query<RowDataPacket[]>('SELECT role FROM users WHERE email = ?', [session.user.email]);
        if (!users[0] || users[0].role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { requestId, action, adminNote } = body;

        if (!requestId || !action || !['APPROVED', 'REJECTED'].includes(action)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        // Get the request
        const [requests] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM author_requests WHERE id = ?',
            [requestId]
        );

        if (!requests[0]) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Update request status
        await pool.query(
            'UPDATE author_requests SET status = ?, admin_note = ? WHERE id = ?',
            [action, adminNote || null, requestId]
        );

        // If approved, update user role to AUTHOR
        if (action === 'APPROVED') {
            await pool.query(
                'UPDATE users SET role = ? WHERE id = ?',
                ['AUTHOR', requests[0].user_id]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
