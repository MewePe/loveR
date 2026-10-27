import Link from 'next/link';
import type { ContentType } from '@/lib/contentRef';
import CategoryTags, { CategoryTagData } from '@/components/CategoryTags';
import AuthorLink from '@/components/AuthorLink';

export type StoryCardData = {
    id: string; title: string; cover_image?: string | null; views?: number | null;
    author_id?: string | null; author_name?: string | null; author_username?: string | null;
    categories?: CategoryTagData[]; rating_avg?: number | null; is_completed?: boolean | number | null;
};

const STYLES = {
    novel: { href: '/novel/', cover: 'from-indigo-500 to-purple-600', hover: 'hover:text-indigo-600 dark:hover:text-indigo-400', icon: '📖', label: 'นิยาย' },
    comic: { href: '/comic/', cover: 'from-pink-500 to-rose-600', hover: 'hover:text-pink-600 dark:hover:text-pink-400', icon: '🎨', label: 'การ์ตูน' },
};

// Cover card used in the home page grids, search results, category pages, "similar stories" and
// "recommended for you". The author name and category tags are their own links, so the story link is split
// into the cover and the title instead of wrapping the whole card.
export default function StoryCard({ story, type }: { story: StoryCardData; type: ContentType }) {
    const style = STYLES[type];
    const href = style.href + story.id;
    return (
        <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700 h-full flex flex-col">
            {/* Same target as the title link, so keep it out of the tab order */}
            <Link href={href} tabIndex={-1} aria-hidden="true" className={`block aspect-[2/3] bg-gradient-to-br ${style.cover} relative overflow-hidden`}>
                {story.cover_image ? (
                    <img src={story.cover_image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="flex items-center justify-center h-full text-white/50 text-4xl">{style.icon}</div>
                )}
                <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                    {style.label}
                </div>
                {!!story.is_completed && (
                    <div className="absolute top-2 left-2 bg-emerald-700 text-white text-xs font-medium px-2 py-1 rounded">จบแล้ว</div>
                )}
            </Link>
            <div className="p-3 pb-2 flex-1 flex flex-col">
                <Link href={href} className={`font-bold text-gray-900 dark:text-white ${style.hover} transition line-clamp-1 text-sm`}>
                    {story.title}
                </Link>
                <AuthorLink
                    id={story.author_id}
                    username={story.author_username}
                    name={story.author_name}
                    className="block text-gray-500 dark:text-gray-400 text-xs mt-1 truncate"
                />
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                    <span>👁️ {(story.views || 0).toLocaleString()}</span>
                    {story.rating_avg != null && <span>⭐ {story.rating_avg.toFixed(1)}</span>}
                </div>
            </div>
            <CategoryTags categories={story.categories} type={type} className="px-3 pb-3" />
        </div>
    );
}
