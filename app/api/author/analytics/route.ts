import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { bucketExpr, bucketKeys, parseRange, rangeStart, seriesByBucket } from '@/lib/analytics';

// Per-work stats for one content type. Table/column names are fixed here (never built from input).
// Ratings and comments by BANNED users don't count, matching what readers see.
const WORKS_SQL = (type: 'novel' | 'comic') => {
    const t = type === 'novel'
        ? { table: 'novels', items: 'chapters', itemFk: 'novel_id', purchaseCol: 'chapter_id', ref: 'novel_id' }
        : { table: 'comics', items: 'comic_episodes', itemFk: 'comic_id', purchaseCol: 'episode_id', ref: 'comic_id' };
    return `
    SELECT '${type}' AS type, s.id, s.title, s.status, COALESCE(s.views, 0) AS views,
           (SELECT COUNT(*) FROM ${t.items} i WHERE i.${t.itemFk} = s.id) AS items,
           (SELECT COUNT(*) FROM purchases p JOIN ${t.items} i ON i.id = p.${t.purchaseCol} WHERE i.${t.itemFk} = s.id) AS sales,
           (SELECT COALESCE(SUM(p.author_earning), 0) FROM purchases p JOIN ${t.items} i ON i.id = p.${t.purchaseCol} WHERE i.${t.itemFk} = s.id) AS earning,
           (SELECT AVG(r.score) FROM ratings r JOIN users u ON u.id = r.user_id WHERE r.${t.ref} = s.id AND u.role != 'BANNED') AS rating_avg,
           (SELECT COUNT(*) FROM ratings r JOIN users u ON u.id = r.user_id WHERE r.${t.ref} = s.id AND u.role != 'BANNED') AS rating_count,
           (SELECT COUNT(*) FROM comments c JOIN users u ON u.id = c.user_id WHERE c.${t.ref} = s.id AND u.role != 'BANNED') AS comments,
           (SELECT COUNT(*) FROM bookmarks b WHERE b.${t.ref} = s.id) AS bookmarks
    FROM ${t.table} s WHERE s.author_id = ?`;
};

// GET /api/author/analytics?range=30d|12m — the author's earnings over time and stats for each of their works
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const authorId = session.user.id;
        const range = parseRange(req.nextUrl.searchParams.get('range'));
        const keys = await bucketKeys(range);

        const series = await seriesByBucket(keys, ['earning', 'sales'],
            `SELECT ${bucketExpr(range, 'created_at')} AS bucket, SUM(author_earning) AS earning, COUNT(*) AS sales
             FROM purchases WHERE author_id = ? AND created_at >= ${rangeStart(range)} GROUP BY bucket`, [authorId]);

        const [works] = await pool.query<RowDataPacket[]>(
            `${WORKS_SQL('novel')} UNION ALL ${WORKS_SQL('comic')} ORDER BY views DESC, title ASC`,
            [authorId, authorId]
        );

        return NextResponse.json({
            range,
            series: series.map((p) => ({ ...p, earning: Math.round(p.earning * 100) / 100 })),
            works: works.map((w) => ({
                type: w.type, id: w.id, title: w.title, status: w.status,
                views: Number(w.views), items: Number(w.items), sales: Number(w.sales),
                earning: Math.round(Number(w.earning) * 100) / 100,
                rating_avg: w.rating_avg === null ? null : Math.round(Number(w.rating_avg) * 10) / 10,
                rating_count: Number(w.rating_count), comments: Number(w.comments), bookmarks: Number(w.bookmarks),
            })),
        });
    } catch (error) {
        console.error('Failed to load author analytics:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
