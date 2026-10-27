import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

// Every notification type the app creates. Stored as VARCHAR, so this list is the whitelist.
export const NOTIFICATION_TYPES = [
    // readers
    'NEW_CHAPTER', 'NEW_STORY', 'TOPUP_APPROVED', 'TOPUP_REJECTED', 'COMMENT_REPLY',
    // authors
    'NEW_COMMENT', 'NEW_RATING', 'PURCHASE', 'SUPPORT', 'WRITER_APPROVED', 'WRITER_REJECTED', 'WITHDRAWAL_APPROVED', 'WITHDRAWAL_REJECTED',
    // admins
    'ADMIN_TOPUP', 'ADMIN_WRITER_REQUEST', 'ADMIN_WITHDRAWAL', 'ADMIN_REPORT',
] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

export interface NotificationInput {
    type: NotificationType;
    message: string; // plain text, rendered as text (never HTML)
    link: string; // in-app path the notification opens, e.g. /novel/<id>#comments
}

const MAX_MESSAGE = 500;

// Shorten user-supplied text (titles, names, reasons) before putting it in a message
export function short(text: string | null | undefined, max = 60) {
    const t = (text ?? '').trim().replace(/\s+/g, ' ');
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

// Create the same notification for each recipient. `actorId` (whoever caused it) never notifies themselves, and
// deleting that user deletes the notifications they caused (notifications.actor_id ON DELETE CASCADE).
// Failures are logged and swallowed: a notification must never break the action that triggered it.
export async function notify(recipients: (string | null | undefined)[], n: NotificationInput, actorId?: string | null) {
    const ids = [...new Set(recipients.filter((id): id is string => !!id && id !== actorId))];
    if (ids.length === 0) return;
    const message = n.message.slice(0, MAX_MESSAGE);
    try {
        // Chunked so a story with many bookmarks doesn't build one huge statement
        for (let i = 0; i < ids.length; i += 500) {
            const rows = ids.slice(i, i + 500).map((userId) => [uuidv4(), userId, actorId ?? null, n.type, message, n.link]);
            await pool.query('INSERT INTO notifications (id, user_id, actor_id, type, message, link) VALUES ?', [rows]);
        }
    } catch (error) {
        console.error(`Failed to create ${n.type} notification (run scripts/add_notifications.ts?):`, error);
    }
}

export async function notifyAdmins(n: NotificationInput, actorId?: string | null) {
    try {
        const [admins] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE role = 'ADMIN'");
        await notify(admins.map((a) => a.id), n, actorId);
    } catch (error) {
        console.error('Failed to look up admins for notification:', error);
    }
}

async function followerIds(authorId: string) {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT follower_id FROM follows WHERE author_id = ?', [authorId]);
    return rows.map((r) => r.follower_id as string);
}

// Readers who bookmarked a published novel/comic, or follow its author, hear about each new chapter/episode
// (once each, even if both)
export async function notifyNewItem(kind: 'novel' | 'comic', content: { id: string; title: string; author_id: string; status: string }, itemId: string, itemTitle: string) {
    if (content.status !== 'PUBLISHED') return;
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT user_id FROM bookmarks WHERE ${kind === 'novel' ? 'novel_id' : 'comic_id'} = ?`,
            [content.id]
        );
        await notify([...rows.map((r) => r.user_id), ...await followerIds(content.author_id)], {
            type: 'NEW_CHAPTER',
            message: `"${short(content.title)}" มี${kind === 'novel' ? 'บท' : 'ตอน'}ใหม่: ${short(itemTitle)}`,
            link: kind === 'novel' ? `/read/${itemId}` : `/comic/${content.id}/read/${itemId}`,
        }, content.author_id);
    } catch (error) {
        console.error('Failed to notify bookmarkers:', error);
    }
}

// Followers of the author hear about a story when it is first published. Announced only once per story,
// so switching it back to draft and publishing again doesn't notify everyone again.
export async function notifyNewStory(kind: 'novel' | 'comic', content: { id: string; title: string; author_id: string }, authorName: string | null) {
    const link = `/${kind}/${content.id}`;
    try {
        const [sent] = await pool.query<RowDataPacket[]>("SELECT 1 FROM notifications WHERE type = 'NEW_STORY' AND link = ? LIMIT 1", [link]);
        if (sent.length > 0) return;
        await notify(await followerIds(content.author_id), {
            type: 'NEW_STORY',
            message: `${short(authorName) || 'นักเขียนที่คุณติดตาม'} ลง${kind === 'novel' ? 'นิยาย' : 'การ์ตูน'}เรื่องใหม่: ${short(content.title)}`,
            link,
        }, content.author_id);
    } catch (error) {
        console.error('Failed to notify followers about a new story:', error);
    }
}

export const baht = (n: number | string) => Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
