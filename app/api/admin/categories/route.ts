import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';

export async function GET() {
    try {
        const [categories] = await pool.query<RowDataPacket[]>('SELECT * FROM categories ORDER BY name ASC');
        return NextResponse.json(categories);
    } catch (error) {
        console.error('Failed to fetch categories:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { name, slug } = await req.json();

        if (!name || !slug) {
            return NextResponse.json({ error: 'Name and Slug are required' }, { status: 400 });
        }

        const id = uuidv4();
        await pool.query('INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)', [id, name, slug]);

        return NextResponse.json({ message: 'Category created successfully', id });
    } catch (error) {
        console.error('Failed to create category:', error);
        if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ error: 'Category name or slug already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
