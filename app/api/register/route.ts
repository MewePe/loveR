import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import { clientIp } from '@/lib/loginThrottle';
import { hitRegisterLimit } from '@/lib/registerThrottle';

export async function POST(req: Request) {
    try {
        const { name, email, password } = await req.json();

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
            return NextResponse.json({ error: 'ชื่อต้องมี 1-100 ตัวอักษร' }, { status: 400 });
        }
        if (typeof email !== 'string' || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: 'อีเมลไม่ถูกต้อง' }, { status: 400 });
        }
        // bcrypt only uses the first 72 bytes, so cap the length too
        if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
            return NextResponse.json({ error: 'รหัสผ่านต้องมี 8-72 ตัวอักษร' }, { status: 400 });
        }

        // Counted before the existing-email check so that check can't be used to enumerate accounts.
        // If the throttle table is unavailable (migration not run) we log it and still allow the sign-up.
        let limited = false;
        try {
            limited = await hitRegisterLimit(clientIp(req));
        } catch (error) {
            console.error('Register throttle unavailable (run scripts/add_register_attempts.ts):', error);
        }
        if (limited) {
            return NextResponse.json({ error: 'สมัครสมาชิกบ่อยเกินไป กรุณาลองใหม่ภายหลัง' }, { status: 429 });
        }

        // Check if user exists
        const [existingUsers] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return NextResponse.json({ error: 'User already exists' }, { status: 409 });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const id = uuidv4();

        // Insert user
        await pool.query(
            'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
            [id, name, email, hashedPassword, 'READER']
        );

        return NextResponse.json({ message: 'User created successfully' }, { status: 201 });
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
