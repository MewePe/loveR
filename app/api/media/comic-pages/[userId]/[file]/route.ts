import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';
import { canAccess, AccessItem } from '@/lib/coins';
import { isOwnerOrAdmin } from '@/lib/visibility';
import { PRIVATE_COMIC_URL_PREFIX, readPrivateComicPage } from '@/lib/upload';

// GET - Serve a private comic page image if the viewer may read an episode that uses it
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string; file: string }> }) {
    const { userId, file } = await params;
    const session = await auth();

    const url = `${PRIVATE_COMIC_URL_PREFIX}${userId}/${file}`;
    const [episodes] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT e.id, e.price, c.author_id, c.status AS content_status
         FROM comic_pages p
         JOIN comic_episodes e ON p.episode_id = e.id
         JOIN comics c ON e.comic_id = c.id
         WHERE p.image_url = ?`,
        [url]
    );

    // The uploader can always see their own files (e.g. just uploaded, not yet attached to an episode)
    let allowed = isOwnerOrAdmin(session?.user, userId);
    for (const episode of episodes) {
        if (allowed) break;
        allowed = await canAccess(session?.user, 'episode', episode as AccessItem);
    }
    if (!allowed) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const image = await readPrivateComicPage(userId, file);
    if (!image) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(image.data), {
        headers: {
            'Content-Type': image.contentType,
            // private: browsers may cache it, shared caches/CDNs must not
            'Cache-Control': 'private, max-age=3600',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
