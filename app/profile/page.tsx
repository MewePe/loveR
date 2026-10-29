import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { ensureUsername } from '@/lib/authors';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { profileHref } from '@/lib/username';

const TABS = ['novels', 'comics', 'bookmarks', 'history', 'wallet'];

// /profile → your own profile page (/profile/<username>), keeping ?tab= (e.g. /profile?tab=bookmarks).
// The profile is edited at /profile/edit.
export default async function MyProfile({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    const { tab } = await searchParams;
    const session = await auth();
    if (!session?.user?.id) redirect('/login');

    await ensureUsername(session.user.id);
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, username FROM users WHERE id = ?', [session.user.id]);
    if (!rows[0]) redirect('/login');
    redirect(profileHref({ id: rows[0].id as string, username: rows[0].username as string | null }) + (tab&& TABS.includes(tab) ? `?tab=${tab}` : ''));
}
