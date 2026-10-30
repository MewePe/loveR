import Link from 'next/link';
import { Trophy } from 'lucide-react';
import AuthorLink from '@/components/AuthorLink';
import { isContentType } from '@/lib/contentRef';
import { isRankingPeriod, isSortKey, listRanking, RANKING_PERIODS, RANKING_SORTS, RankingPeriod, SORTS, StoryRow } from '@/lib/ranking';

const RANKING_SIZE = 50;

const TYPES = {
    novel: { label: 'นิยาย', href: '/novel/', active: 'bg-indigo-600 text-white', text: 'text-indigo-600 dark:text-indigo-400', cover: 'from-indigo-500 to-purple-600', icon: '📖' },
    comic: { label: 'การ์ตูน', href: '/comic/', active: 'bg-pink-600 text-white', text: 'text-pink-600 dark:text-pink-400', cover: 'from-pink-500 to-rose-600', icon: '🎨' },
};

// Gold, silver and bronze for the top three
const MEDALS = ['bg-amber-400 text-amber-950', 'bg-gray-300 text-gray-900', 'bg-orange-300 text-orange-950'];

function statLine(story: StoryRow) {
    return [
        `👁️ ${story.views.toLocaleString()}`,
        story.rating_avg != null ? `⭐ ${story.rating_avg.toFixed(1)} (${story.rating_count})` : '⭐ -',
        `🛒 ${story.sales.toLocaleString()}`,
        `🔖 ${story.bookmarks.toLocaleString()}`,
    ];
}

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ type?: string; sort?: string; period?: string }> }) {
    const params = await searchParams;
    const type = isContentType(params.type) ? params.type : 'novel';
    const sort = isSortKey(RANKING_SORTS, params.sort) ? params.sort : 'views';
    const period = isRankingPeriod(params.period) ? params.period : 'all';
    const stories = await listRanking(type, sort, period, RANKING_SIZE);
    const style = TYPES[type];
    const href = (next: { type?: string; sort?: string; period?: string }) =>
        `/ranking?type=${next.type ?? type}&sort=${next.sort ?? sort}&period=${next.period ?? period}`;

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
            <div className="container mx-auto px-4 py-10 max-w-4xl">
                <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white mb-6">
                    <Trophy className="w-8 h-8 text-amber-500 dark:text-amber-400" /> จัดอันดับ
                </h1>

                <div className="flex gap-2 mb-4">
                    {(Object.keys(TYPES) as (keyof typeof TYPES)[]).map((key) => (
                        <Link
                            key={key}
                            href={href({ type: key })}
                            className={`px-5 py-2 rounded-full font-medium transition ${key === type ? TYPES[key].active : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border dark:border-gray-700'}`}
                        >
                            {TYPES[key].label}
                        </Link>
                    ))}
                </div>

                <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                    {RANKING_SORTS.map((key) => (
                        <Link
                            key={key}
                            href={href({ sort: key })}
                            className={`shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition ${key === sort ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                        >
                            {SORTS[key].label}
                        </Link>
                    ))}
                </div>

                <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                    {(Object.keys(RANKING_PERIODS) as RankingPeriod[]).map((key) => (
                        <Link
                            key={key}
                            href={href({ period: key })}
                            className={`shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition ${key === period ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                        >
                            {RANKING_PERIODS[key].label}
                        </Link>
                    ))}
                </div>
                <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">นับจาก{RANKING_PERIODS[period].note}</p>

                {stories.length === 0 ? (
                    <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                        {period === 'all' ? `ยังไม่มี${style.label}` : `ยังไม่มีข้อมูลของ${RANKING_PERIODS[period].note}`}
                    </div>
                ) : (
                    <ol className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
                        {stories.map((story, index) => (
                            <li key={story.id} className="relative flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition group">
                                <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${MEDALS[index] ?? 'text-gray-500 dark:text-gray-400'}`}>
                                    {index + 1}
                                </span>
                                <div className={`shrink-0 w-12 sm:w-14 aspect-[2/3] rounded-md overflow-hidden bg-gradient-to-br ${style.cover}`}>
                                    {story.cover_image ? (
                                        <img src={story.cover_image} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white/60">{style.icon}</div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="font-bold text-gray-900 dark:text-white truncate">
                                        {/* Stretched over the whole row; the author link sits above it */}
                                        <Link href={style.href + story.id} className="group-hover:underline after:absolute after:inset-0">{story.title}</Link>
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                        <AuthorLink id={story.author_id} username={story.author_username} name={story.author_name} className="relative z-10" />
                                        {story.categories.length > 0 && ` · ${story.categories.map((c) => c.name).join(', ')}`}
                                    </p>
                                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                                        {statLine(story).map((stat, i) => (
                                            <span key={i} className={RANKING_SORTS[i] === sort ? `font-semibold ${style.text}` : ''}>{stat}</span>
                                        ))}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </main>
    );
}
