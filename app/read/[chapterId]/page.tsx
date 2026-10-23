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

// Content is loaded separately, only after the access check, so a locked chapter's text is never
// fetched for the request (React dev mode also serializes awaited query results into the page).
async function getChapter(id: string) {
    const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT c.id, c.title, c.chapter_order, c.novel_id, c.price, n.title as novel_title, n.author_id, n.status as content_status
    FROM chapters c
    JOIN novels n ON c.novel_id = n.id
    WHERE c.id = ?
  `, [id]);
    return rows[0];
}

async function getChapterContent(id: string) {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT content FROM chapters WHERE id = ?', [id]);
    return rows[0]?.content as string | null;
}

async function getAdjacentChapters(novelId: string, currentOrder: number) {
    const [prev] = await pool.query<RowDataPacket[]>(`
    SELECT id FROM chapters WHERE novel_id = ? AND chapter_order < ? ORDER BY chapter_order DESC LIMIT 1
  `, [novelId, currentOrder]);

    const [next] = await pool.query<RowDataPacket[]>(`
    SELECT id FROM chapters WHERE novel_id = ? AND chapter_order > ? ORDER BY chapter_order ASC LIMIT 1
  `, [novelId, currentOrder]);

    return { prev: prev[0], next: next[0] };
}

export default async function ReadChapter({ params }: { params: Promise<{ chapterId: string }> }) {
    const { chapterId } = await params;
    const chapter = await getChapter(chapterId);

    if (!chapter) notFound();

    const session = await auth();
    const unlocked = await canAccess(session?.user, 'chapter', chapter as AccessItem);
    // Only published novels show a paywall; unpublished ones simply don't exist for other users
    if (!unlocked && chapter.content_status !== 'PUBLISHED') notFound();

    const { prev, next } = await getAdjacentChapters(chapter.novel_id, chapter.chapter_order);
    const content = unlocked ? await getChapterContent(chapter.id) : null;
    if (unlocked) {
        await recordView('novel', chapter.id, session?.user?.id, chapter.author_id);
        if (session?.user?.id) await recordRead(session.user.id, 'novel', chapter.novel_id, chapter.id);
    }
    const episodes = await getEpisodeList('novel', chapter.novel_id, session?.user, { author_id: chapter.author_id, status: chapter.content_status });

    return (
        <div className="min-h-screen bg-[#f9f9f9] dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-serif transition-colors duration-200">
            {/* Top Navigation */}
            <div className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/95 backdrop-blur-md border-b dark:border-gray-800 shadow-sm px-4 py-3 flex items-center justify-between transition-colors duration-200">
                <Link href={`/novel/${chapter.novel_id}`} className="text-sm font-medium text-gray-500 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 truncate max-w-[200px] flex items-center gap-1 transition-colors">
                    &larr; <span className="hidden sm:inline">{chapter.novel_title}</span>
                </Link>
                <h1 className="text-sm md:text-base font-bold text-center truncate px-2 dark:text-white">{chapter.title}</h1>
                <div className="shrink-0 flex justify-end items-center gap-2 text-sm">
                    <EpisodePicker key={chapter.id} items={episodes} currentId={chapter.id} hrefPrefix="/read/" variant="compact" />
                    <button className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-1" aria-label="ตั้งค่าตัวอักษร">Aa</button>
                    <ThemeToggle />
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-6 py-12 md:py-20">
                {unlocked ? (
                    // Rendered as plain text (never as HTML): chapter content is author input, and HTML here
                    // would let an author run scripts in readers' browsers
                    <div className="reading-content whitespace-pre-line text-lg md:text-xl leading-relaxed text-gray-800 dark:text-gray-100">
                        {content || ''}
                    </div>
                ) : (
                    <Paywall kind="chapter" itemId={chapter.id} price={chapter.price} loggedIn={!!session?.user} />
                )}
            </div>

            {/* Bottom Navigation */}
            <div className="max-w-3xl mx-auto px-6 pb-20">
                <div className="flex items-center justify-between gap-2 sm:gap-4 border-t dark:border-gray-800 pt-8 transition-colors duration-200">
                    {prev ? (
                        <Link
                            href={`/read/${prev.id}`}
                            className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-2 py-4 rounded-xl text-center font-medium text-sm sm:text-base hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
                        >
                            &larr; บทก่อนหน้า
                        </Link>
                    ) : (
                        <button disabled className="flex-1 bg-gray-100 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 px-2 py-4 rounded-xl text-center font-medium text-sm sm:text-base cursor-not-allowed border border-transparent dark:border-gray-800">
                            บทก่อนหน้า
                        </button>
                    )}

                    <EpisodePicker key={chapter.id} items={episodes} currentId={chapter.id} hrefPrefix="/read/" />

                    {next ? (
                        <Link
                            href={`/read/${next.id}`}
                            className="flex-1 bg-indigo-600 dark:bg-indigo-700 text-white px-2 py-4 rounded-xl text-center font-medium text-sm sm:text-base hover:bg-indigo-700 dark:hover:bg-indigo-600 transition shadow-lg hover:shadow-indigo-500/30"
                        >
                            บทถัดไป &rarr;
                        </Link>
                    ) : (
                        <button disabled className="flex-1 bg-gray-100 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 px-2 py-4 rounded-xl text-center font-medium text-sm sm:text-base cursor-not-allowed border border-transparent dark:border-gray-800">
                            บทถัดไป
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
