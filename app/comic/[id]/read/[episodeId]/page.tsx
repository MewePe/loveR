import pool from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RowDataPacket } from 'mysql2';
import ThemeToggle from '@/components/ThemeToggle';
import Paywall from '@/components/Paywall';
import EpisodePicker from '@/components/EpisodePicker';
import { auth } from '@/lib/auth';
import { canAccess, AccessItem } from '@/lib/coins';
import { recordRead } from '@/lib/readingHistory';
import { recordView } from '@/lib/views';
import { getEpisodeList } from '@/lib/episodeList';

async function getEpisode(comicId: string, episodeId: string) {
    const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT e.*, c.title as comic_title, c.id as comic_id, c.author_id, c.status as content_status
    FROM comic_episodes e
    JOIN comics c ON e.comic_id = c.id
    WHERE e.id = ? AND e.comic_id = ?
  `, [episodeId, comicId]);
    return rows[0];
}

async function getPages(episodeId: string) {
    const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT * FROM comic_pages 
    WHERE episode_id = ? 
    ORDER BY page_order ASC
  `, [episodeId]);
    return rows;
}

async function getNextPrevEpisodes(comicId: string, currentOrder: number) {
    const [prev] = await pool.query<RowDataPacket[]>(`
    SELECT id FROM comic_episodes 
    WHERE comic_id = ? AND episode_order < ? 
    ORDER BY episode_order DESC LIMIT 1
  `, [comicId, currentOrder]);

    const [next] = await pool.query<RowDataPacket[]>(`
    SELECT id FROM comic_episodes 
    WHERE comic_id = ? AND episode_order > ? 
    ORDER BY episode_order ASC LIMIT 1
  `, [comicId, currentOrder]);

    return {
        prev: prev[0]?.id || null,
        next: next[0]?.id || null
    };
}

export default async function ReadEpisode({ params }: { params: Promise<{ id: string; episodeId: string }> }) {
    const { id: comicId, episodeId } = await params;
    const episode = await getEpisode(comicId, episodeId);

    if (!episode) notFound();

    const session = await auth();
    const unlocked = await canAccess(session?.user, 'episode', episode as AccessItem);
    // Only published comics show a paywall; unpublished ones simply don't exist for other users
    if (!unlocked && episode.content_status !== 'PUBLISHED') notFound();
    const pages = unlocked ? await getPages(episodeId) : [];
    const { prev, next } = await getNextPrevEpisodes(episode.comic_id, episode.episode_order);

    if (unlocked) {
        await recordView('comic', episodeId, session?.user?.id, episode.author_id);
        if (session?.user?.id) await recordRead(session.user.id, 'comic', episode.comic_id, episodeId);
    }
    const episodes = await getEpisodeList('comic', episode.comic_id, session?.user, { author_id: episode.author_id, status: episode.content_status });
    const hrefPrefix = `/comic/${comicId}/read/`;

    return (
        <div className="min-h-screen bg-[#f9f9f9] dark:bg-gray-900 transition-colors duration-200">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-800 transition-colors duration-200">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-4 min-w-0">
                        <Link href={`/comic/${comicId}`} className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-white transition">
                            ← กลับ
                        </Link>
                        <div className="min-w-0">
                            <p className="text-gray-500 dark:text-gray-400 text-sm truncate">{episode.comic_title}</p>
                            <h1 className="text-gray-900 dark:text-white font-bold truncate">{episode.title}</h1>
                        </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                        <EpisodePicker key={episode.id} items={episodes} currentId={episode.id} hrefPrefix={hrefPrefix} accentColor="pink" variant="compact" />
                        <ThemeToggle />
                        {/* On phones prev/next are only in the bottom bar */}
                        {prev && (
                            <Link href={`/comic/${comicId}/read/${prev}`} className="hidden sm:inline-block px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition">
                                ← ตอนก่อนหน้า
                            </Link>
                        )}
                        {next && (
                            <Link href={`/comic/${comicId}/read/${next}`} className="hidden sm:inline-block px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition">
                                ตอนถัดไป →
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Pages */}
            <div className="max-w-4xl mx-auto py-4">
                {!unlocked ? (
                    <Paywall kind="episode" itemId={episode.id} price={episode.price} loggedIn={!!session?.user} />
                ) : pages.length > 0 ? (
                    <div className="space-y-1">
                        {pages.map((page, index) => (
                            <img
                                key={page.id}
                                src={page.image_url}
                                alt={`Page ${index + 1}`}
                                className="w-full"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-gray-400 dark:text-gray-500">
                        <p className="text-6xl mb-4">🎨</p>
                        <p>ยังไม่มีหน้าในตอนนี้</p>
                    </div>
                )}
            </div>

            {/* Bottom Navigation */}
            <div className="sticky bottom-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-800 py-4 transition-colors duration-200">
                <div className="container mx-auto px-4 flex items-center justify-center gap-2 sm:gap-4">
                    {prev && (
                        <Link href={`/comic/${comicId}/read/${prev}`} className="px-4 sm:px-6 py-3 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition">
                            ← ตอนก่อนหน้า
                        </Link>
                    )}
                    <EpisodePicker key={episode.id} items={episodes} currentId={episode.id} hrefPrefix={hrefPrefix} accentColor="pink" />
                    {next && (
                        <Link href={`/comic/${comicId}/read/${next}`} className="px-4 sm:px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition">
                            ตอนถัดไป →
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
