// Usernames for public profiles (/profile/<username>). Pure helpers with no database access, so the
// migration script can use them too.

// Lowercase letters, digits and underscore, 3-30 characters. No "-", so a username can never look like a
// user id (UUID), which /profile/[username] also accepts.
export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

// Can't be chosen: paths under /profile that would shadow a profile, and names that look official
export const RESERVED_USERNAMES = ['edit', 'me', 'settings', 'admin', 'administrator', 'loveread', 'support', 'help', 'system', 'moderator'];

export function normalizeUsername(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const name = value.trim().replace(/^@/, '').toLowerCase();
    return USERNAME_PATTERN.test(name) ? name : null;
}

// Default username for a new or existing user: "user_" + hex from their id. Not derived from the email
// (that would publish part of it). `attempt` > 0 takes more of the id when the short form is taken.
export function defaultUsername(userId: string, attempt = 0) {
    const hex = userId.replace(/[^0-9a-f]/gi, '').toLowerCase();
    return `user_${hex.slice(0, 8 + attempt * 4) || hex}`;
}

// Still the automatic "user_<hex>" name (any length defaultUsername() can produce for this id): the owner is asked
// to pick a real one
export function isDefaultUsername(userId: string, username: string | null | undefined) {
    if (!username) return true;
    const hex = userId.replace(/[^0-9a-f]/gi, '').toLowerCase();
    return username.startsWith('user_') && hex.startsWith(username.slice(5)) && username.length > 5;
}

// Why a username someone typed can't be used, or null if the format is fine (whether it's taken is checked on
// the server). Messages are shown as you type on /profile/edit. "user_..." is kept for automatic names, so nobody
// can take a name that looks like someone else's default.
export function usernameProblem(raw: string, currentUsername?: string | null): string | null {
    const name = raw.trim().replace(/^@/, '');
    if (name.length < USERNAME_MIN) return `ต้องมีอย่างน้อย ${USERNAME_MIN} ตัวอักษร`;
    if (name.length > USERNAME_MAX) return `ยาวได้ไม่เกิน ${USERNAME_MAX} ตัวอักษร`;
    if (!/^[a-z0-9_]+$/.test(name)) return 'ใช้ได้เฉพาะ a-z ตัวเล็ก, 0-9 และ _';
    if (name === currentUsername) return null;
    if (name.startsWith('user_')) return 'ชื่อที่ขึ้นต้นด้วย user_ สงวนไว้สำหรับชื่ออัตโนมัติ';
    if (RESERVED_USERNAMES.includes(name)) return 'ชื่อนี้สงวนไว้ ใช้ไม่ได้';
    return null;
}

// Link to an author's public profile. Falls back to the user id, which /profile/[username] also accepts.
export function profileHref(author: { username?: string | null; id?: string | null }) {
    return `/profile/${encodeURIComponent(author.username || author.id || '')}`;
}
