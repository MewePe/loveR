import pool from '@/lib/db';
import { ContentType } from '@/lib/contentRef';

// One view adds 1 to both the chapter/episode and its novel/comic, so the totals used for
// "ยอดนิยม" and the author dashboard move together. The SQL is fixed per content type (never built from input).
const VIEW_SQL = {
    novel: `UPDATE chapters c JOIN novels n ON n.id = c.novel_id
            SET c.views = COALESCE(c.views, 0) + 1, n.views = COALESCE(n.views, 0) + 1 WHERE c.id = ?`,
    comic: `UPDATE comic_episodes e JOIN comics c ON c.id = e.comic_id
            SET e.views = COALESCE(e.views, 0) + 1, c.views = COALESCE(c.views, 0) + 1 WHERE e.id = ?`,
} as const;

// Called by the reader pages only after canAccess() let the viewer see the chapter/episode (paywall
// pages don't count). Authors reading their own work don't count either. Failures are logged and
// swallowed so counting can never stop someone from reading.
export async function recordView(type: ContentType, itemId: string, viewerId: string | undefined, authorId: string) {
    if (viewerId && viewerId === authorId) return;
    try {
        await pool.query(VIEW_SQL[type], [itemId]);
    } catch (error) {
        console.error('Failed to record view:', error);
    }
}
