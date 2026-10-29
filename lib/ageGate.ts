import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { MIN_AGE, ageOn } from '@/lib/age';
import { isOwnerOrAdmin, Viewer } from '@/lib/visibility';

// 18+ age gate. A reader who passes it is remembered: logged-in users by users.birth_date, everyone by this cookie
// (set by POST /api/age-verification). The cookie only says "passed", it has no birth date in it.
export const AGE_COOKIE = 'loveread-age-ok';
export const AGE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export async function isAgeVerified(viewer: Viewer) {
    const jar = await cookies();
    if (jar.get(AGE_COOKIE)?.value === '1') return true;
    if (!viewer?.id) return false;
    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT birth_date FROM users WHERE id = ?', [viewer.id]);
        const birth = rows[0]?.birth_date as Date | null | undefined;
        if (!birth) return false;
        return ageOn({ year: birth.getFullYear(), month: birth.getMonth() + 1, day: birth.getDate() }) >= MIN_AGE;
    } catch (error) {
        console.error('Failed to read birth date (run scripts/add_moderation.ts?):', error);
        return false;
    }
}

// Whether this viewer has to pass the age gate before seeing a story's chapters/episodes.
// The author and admins never do. `story` is a novels/comics row (or any row with its author_id and is_mature).
export async function needsAgeGate(viewer: Viewer, story: Record<string, unknown>) {
    if (!story.is_mature) return false;
    if (isOwnerOrAdmin(viewer, story.author_id as string | null | undefined)) return false;
    return !(await isAgeVerified(viewer));
}
