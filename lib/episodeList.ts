import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { ContentType } from '@/lib/contentRef';
import { getPurchasedIds } from '@/lib/coins';
import { getReadItemIds } from '@/lib/readingHistory';
import { isOwnerOrAdmin, Viewer } from '@/lib/visibility';

// One row of the episode picker on the reader pages. No content, only what the list shows.
export type EpisodeListItem = { id: string; number: number; title: string; price: number; locked: boolean; read: boolean };

// The SQL is fixed per content type (never built from input)
const LIST_SQL = {
    novel: `SELECT id, chapter_order AS number, title, price FROM chapters WHERE novel_id = ? ORDER BY chapter_order ASC, created_at ASC`,
    comic: `SELECT id, episode_order AS number, title, price FROM comic_episodes WHERE comic_id = ? ORDER BY episode_order ASC, created_at ASC`,
} as const;

// All chapters/episodes of a novel/comic in reading order, with the same lock rules as canAccess():
// the author and admins see everything unlocked; others need to have bought paid items. When the story
// isn't PUBLISHED (only reachable here when ARCHIVED and the viewer bought this item), other viewers only
// get the items they bought, since every other item would be a 404.
export async function getEpisodeList(
    type: ContentType, contentId: string, viewer: Viewer, content: { author_id: string; status: string }
): Promise<EpisodeListItem[]> {
    const [rows] = await pool.query<RowDataPacket[]>(LIST_SQL[type], [contentId]);
    const ids = rows.map(r => r.id as string);
    const privileged = isOwnerOrAdmin(viewer, content.author_id);
    const [purchased, read] = await Promise.all([
        privileged ? Promise.resolve(new Set<string>()) : getPurchasedIds(viewer?.id, type === 'novel' ? 'chapter' : 'episode', ids),
        getReadItemIds(viewer?.id, type, ids),
    ]);

    const items = rows.map(r => ({
        id: r.id as string,
        number: Number(r.number),
        title: r.title as string,
        price: Number(r.price) || 0,
        locked: !privileged && Number(r.price) > 0 && !purchased.has(r.id),
        read: read.has(r.id),
    }));
    if (privileged || content.status === 'PUBLISHED') return items;
    return items.filter(item => purchased.has(item.id));
}
