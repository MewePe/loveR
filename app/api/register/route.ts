import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';

export async function POST(req: Request) {
    try {
        const { name, email, password } = await req.json();

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
