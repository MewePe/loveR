import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

// Ensure table exists
async function ensureTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS author_requests (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL,
            prefix VARCHAR(20),
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            id_card_number VARCHAR(20) NOT NULL,
            address TEXT NOT NULL,
            province VARCHAR(100) NOT NULL,
            district VARCHAR(100) NOT NULL,
            sub_district VARCHAR(100) NOT NULL,
            postal_code VARCHAR(10) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
            admin_note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
}

// GET - Check existing request
export async function GET() {
    try {
        await ensureTable();

        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const [users] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [session.user.email]);
        if (!users[0]) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const [requests] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM author_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [users[0].id]
        );

        return NextResponse.json({ request: requests[0] || null });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST - Submit new author request
export async function POST(req: Request) {
    try {
        await ensureTable();

        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const [users] = await pool.query<RowDataPacket[]>('SELECT id, role FROM users WHERE email = ?', [session.user.email]);
        if (!users[0]) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Check if already an author
        if (users[0].role === 'AUTHOR' || users[0].role === 'ADMIN') {
            return NextResponse.json({ error: 'คุณเป็นนักเขียนอยู่แล้ว' }, { status: 400 });
        }

        // Check for existing pending request
        const [existing] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM author_requests WHERE user_id = ? AND status = "PENDING"',
            [users[0].id]
        );

        if (existing.length > 0) {
            return NextResponse.json({ error: 'คุณมีคำขอที่รอการอนุมัติอยู่แล้ว' }, { status: 400 });
        }

        const body = await req.json();
        const { prefix, firstName, lastName, idCardNumber, address, province, district, subDistrict, postalCode, phone } = body;

        // Validate required fields
        if (!firstName || !lastName || !idCardNumber || !address || !province || !district || !subDistrict || !postalCode || !phone) {
            return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
        }

        const id = uuidv4();
        await pool.query(
            `INSERT INTO author_requests (id, user_id, prefix, first_name, last_name, id_card_number, address, province, district, sub_district, postal_code, phone)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, users[0].id, prefix, firstName, lastName, idCardNumber, address, province, district, subDistrict, postalCode, phone]
        );

        return NextResponse.json({ success: true, id });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
