// Usernames for public profiles (/profile/<username>). Pure helpers with no database access, so the
// migration script can use them too.

// Lowercase letters, digits and underscore, 3-30 characters. No "-", so a username can never look like a
// user id (UUID), which /profile/[username] also accepts.
export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

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

// Link to an author's public profile. Falls back to the user id, which /profile/[username] also accepts.
export function profileHref(author: { username?: string | null; id?: string | null }) {
    return `/profile/${encodeURIComponent(author.username || author.id || '')}`;
}
