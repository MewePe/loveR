import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM writer_profiles WHERE user_id = ?',
            [session.user.id]
        );
        return NextResponse.json(rows[0] || {});
    } catch (error) {
        console.error('Failed to fetch profile:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const data: any = {};
        const files: any = {};

        // Extract fields and files
        for (const [key, value] of formData.entries()) {
            if (value instanceof File) {
                files[key] = value;
            } else {
                data[key] = value;
            }
        }

        // Handle file uploads
        const uploadDir = path.join(process.cwd(), 'public/uploads/writers');
        // Ensure directory exists (you might want to use fs.mkdir with recursive: true here if not guaranteed)

        for (const [key, file] of Object.entries(files)) {
            if (file instanceof File && file.size > 0) {
                const buffer = Buffer.from(await file.arrayBuffer());
                const filename = `${session.user.id}-${key}-${Date.now()}${path.extname(file.name)}`;
                await writeFile(path.join(uploadDir, filename), buffer);
                data[key] = `/uploads/writers/${filename}`;
            }
        }

        // Check if profile exists
        const [existing] = await pool.query<RowDataPacket[]>(
            'SELECT user_id FROM writer_profiles WHERE user_id = ?',
            [session.user.id]
        );

        if (existing.length > 0) {
            // Update
            const updates = Object.keys(data).map(key => `${key} = ?`).join(', ');
            const values = [...Object.values(data), session.user.id];
            await pool.query(`UPDATE writer_profiles SET ${updates}, updated_at = NOW() WHERE user_id = ?`, values);
        } else {
            // Insert
            const columns = ['user_id', ...Object.keys(data)].join(', ');
            const placeholders = ['?', ...Object.keys(data).map(() => '?')].join(', ');
            const values = [session.user.id, ...Object.values(data)];
            await pool.query(`INSERT INTO writer_profiles (${columns}) VALUES (${placeholders})`, values);
        }

        return NextResponse.json({ message: 'Profile saved successfully' });
    } catch (error) {
        console.error('Failed to save profile:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
