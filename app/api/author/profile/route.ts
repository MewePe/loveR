import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { savePrivateDocument } from '@/lib/upload';
import { notifyAdmins, short } from '@/lib/notifications';

// Columns a user may set on their own writer profile (status/rejection_reason are admin-only)
const TEXT_FIELDS = [
    'title', 'first_name', 'last_name', 'id_card_number', 'address', 'province', 'district',
    'sub_district', 'postal_code', 'phone_number', 'bank_name', 'bank_account_name', 'bank_account_number',
] as const;
const FILE_FIELDS = ['id_card_image', 'bank_book_image'] as const;

// Required when a reader applies to become an author
const REQUIRED_FOR_APPLICATION = [
    'first_name', 'last_name', 'id_card_number', 'address', 'province', 'district', 'sub_district', 'postal_code', 'phone_number',
] as const;

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM writer_profiles WHERE user_id = ?',
            [session.user.id]
        );
        return NextResponse.json(rows[0] || {});
    } catch (error) {
        console.error('Failed to fetch profile:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}

// POST - Create/update the writer profile. For readers this is the "become an author" application.
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const data: Record<string, string | null> = {};

        for (const key of TEXT_FIELDS) {
            const value = formData.get(key);
            if (typeof value === 'string') {
                data[key] = value.trim() || null;
            }
        }

        for (const key of FILE_FIELDS) {
            const file = formData.get(key);
            if (file instanceof File && file.size > 0) {
                const result = await savePrivateDocument(file, 'writer-docs', session.user.id);
                if ('error' in result) {
                    return NextResponse.json({ error: result.error }, { status: result.status });
                }
                data[key] = result.url;
            }
        }

        const [existing] = await pool.query<RowDataPacket[]>(
            'SELECT status FROM writer_profiles WHERE user_id = ?',
            [session.user.id]
        );

        // A reader submitting the profile is applying (or re-applying after rejection) to become an author
        const isApplying = session.user.role !== 'AUTHOR' && session.user.role !== 'ADMIN';
        if (isApplying) {
            if (existing[0]?.status === 'PENDING') {
                return NextResponse.json({ error: 'คุณมีคำขอที่รอการอนุมัติอยู่แล้ว' }, { status: 400 });
            }
            const merged = { ...existing[0], ...data };
            if (REQUIRED_FOR_APPLICATION.some(key => !merged[key])) {
                return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
            }
            data.status = 'PENDING';
            data.rejection_reason = null;
        } else if (existing.length === 0) {
            // Existing authors (e.g. approved before writer_profiles existed) are already verified
            data.status = 'APPROVED';
        }

        const columns = Object.keys(data);
        const values = Object.values(data);

        if (existing.length > 0) {
            if (columns.length > 0) {
                const updates = columns.map(key => `${key} = ?`).join(', ');
                await pool.query(`UPDATE writer_profiles SET ${updates}, updated_at = NOW() WHERE user_id = ?`, [...values, session.user.id]);
            }
        } else {
            const placeholders = ['?', ...columns.map(() => '?')].join(', ');
            await pool.query(`INSERT INTO writer_profiles (${['user_id', ...columns].join(', ')}) VALUES (${placeholders})`, [session.user.id, ...values]);
        }

        if (isApplying) {
            await notifyAdmins({
                type: 'ADMIN_WRITER_REQUEST',
                message: `${short(session.user.name, 40) || 'ผู้ใช้'} ส่งคำขอเป็นนักเขียน`,
                link: '/admin?tab=writers',
            }, session.user.id);
        }

        return NextResponse.json({ message: 'Profile saved successfully' });
    } catch (error) {
        console.error('Failed to save profile:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' }, { status: 500 });
    }
}
