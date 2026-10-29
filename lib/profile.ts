import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { isPublicUploadUrl } from '@/lib/upload';
import { validateSocialLinks } from '@/lib/authors';
import { normalizeUsername, usernameProblem } from '@/lib/username';

// Editing your own profile (/profile/edit → PATCH /api/profile). Every field is optional; left out = unchanged.
export const MAX_NAME = 100;
export const MAX_BIO = 1000;
export const PROFILE_FIELDS = ['name', 'image', 'username', 'bio', 'cover_image', 'social_links'] as const;
export type ProfileField = typeof PROFILE_FIELDS[number];

type Result = { ok: true; username: string | null } | { ok: false; status: number; error: string };

async function currentUsername(userId: string) {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT username FROM users WHERE id = ?', [userId]);
    return (rows[0]?.username as string | null | undefined) ?? null;
}

// Whether `raw` can become this user's username → { username } (normalised) or { error, taken }
export async function checkUsername(userId: string, raw: unknown) {
    if (typeof raw !== 'string') return { error: 'ชื่อผู้ใช้ไม่ถูกต้อง', taken: false };
    const current = await currentUsername(userId);
    const typed = raw.trim().replace(/^@/, '').toLowerCase();
    const username = normalizeUsername(typed);
    if (!username) return { error: usernameProblem(typed) ?? 'ชื่อผู้ใช้ไม่ถูกต้อง', taken: false };
    if (username === current) return { username, current: true };
    // "Taken" first: it's the more useful message for someone else's name, even a reserved-looking one
    const [rows] = await pool.query<RowDataPacket[]>('SELECT 1 FROM users WHERE username = ? AND id <> ? LIMIT 1', [username, userId]);
    if (rows.length > 0) return { error: 'ชื่อผู้ใช้นี้มีคนใช้แล้ว', taken: true };
    const problem = usernameProblem(username, current);
    if (problem) return { error: problem, taken: false };
    return { username, current: false };
}

// Validate and save the given fields (only those in `allowed`). Column names come from the fixed list above.
export async function updateProfile(userId: string, body: Record<string, unknown>, allowed: readonly ProfileField[] = PROFILE_FIELDS): Promise<Result> {
    const updates: string[] = [];
    const values: (string | null)[] = [];
    const has = (field: ProfileField) => allowed.includes(field) && body[field] !== undefined;

    if (has('name')) {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name || name.length > MAX_NAME) return { ok: false, status: 400, error: `ชื่อที่แสดงต้องมี 1-${MAX_NAME} ตัวอักษร` };
        updates.push('name = ?');
        values.push(name);
    }
    if (has('image')) {
        if (body.image && !isPublicUploadUrl(body.image)) return { ok: false, status: 400, error: 'รูปโปรไฟล์ไม่ถูกต้อง' };
        updates.push('image = ?');
        values.push((body.image as string) || null);
    }
    if (has('username')) {
        const checked = await checkUsername(userId, body.username);
        if ('error' in checked) return { ok: false, status: checked.taken ? 409 : 400, error: checked.error! };
        updates.push('username = ?');
        values.push(checked.username);
    }
    if (has('bio')) {
        if (body.bio !== null && typeof body.bio !== 'string') return { ok: false, status: 400, error: 'ข้อความแนะนำตัวไม่ถูกต้อง' };
        const bio = ((body.bio as string | null) ?? '').trim();
        if (bio.length > MAX_BIO) return { ok: false, status: 400, error: `ข้อความแนะนำตัวยาวได้ไม่เกิน ${MAX_BIO} ตัวอักษร` };
        updates.push('bio = ?');
        values.push(bio || null);
    }
    if (has('cover_image')) {
        if (body.cover_image && !isPublicUploadUrl(body.cover_image)) return { ok: false, status: 400, error: 'รูปปกไม่ถูกต้อง' };
        updates.push('cover_image = ?');
        values.push((body.cover_image as string) || null);
    }
    if (has('social_links')) {
        const parsed = validateSocialLinks(body.social_links);
        if ('error' in parsed) return { ok: false, status: 400, error: parsed.error };
        updates.push('social_links = ?');
        values.push(Object.keys(parsed.links).length ? JSON.stringify(parsed.links) : null);
    }
    if (updates.length === 0) return { ok: false, status: 400, error: 'ไม่มีข้อมูลที่ต้องแก้ไข' };

    try {
        values.push(userId);
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    } catch (error) {
        // Two people saving the same new username at once: the UNIQUE index decides
        if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return { ok: false, status: 409, error: 'ชื่อผู้ใช้นี้มีคนใช้แล้ว' };
        throw error;
    }
    return { ok: true, username: await currentUsername(userId) };
}
