import Link from 'next/link';
import type { ContentType } from '@/lib/contentRef';

export type StoryCardData = {
    id: string; title: string; cover_image?: string | null; views?: number | null;
    author_name?: string | null; category_name?: string | null; rating_avg?: number | null;
};

const STYLES = {
    novel: { href: '/novel/', cover: 'from-indigo-500 to-purple-600', hover: 'group-hover:text-indigo-600', icon: '📖', fallback: 'นิยาย' },
    comic: { href: '/comic/', cover: 'from-pink-500 to-rose-600', hover: 'group-hover:text-pink-600', icon: '🎨', fallback: 'การ์ตูน' },
};

// Cover card used in the home page grids, "similar stories" and "recommended for you"
export default function StoryCard({ story, type }: { story: StoryCardData; type: ContentType }) {
    const style = STYLES[type];
    return (
        <Link href={style.href + story.id} className="group">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700 h-full flex flex-col">
                <div className={`aspect-[2/3] bg-gradient-to-br ${style.cover} relative overflow-hidden`}>
                    {story.cover_image ? (
                        <img src={story.cover_image} alt={story.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                        <div className="flex items-center justify-center h-full text-white/50 text-4xl">{style.icon}</div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                        {story.category_name || style.fallback}
                    </div>
                </div>
                <div className="p-3 flex-1 flex flex-col">
                    <h3 className={`font-bold text-gray-900 dark:text-white ${style.hover} transition line-clamp-1 text-sm`}>{story.title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{story.author_name || 'ไม่ระบุชื่อ'}</p>
                    <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
                        <span>👁️ {(story.views || 0).toLocaleString()}</span>
                        {story.rating_avg != null && <span>⭐ {story.rating_avg.toFixed(1)}</span>}
                    </div>
                </div>
            </div>
        </Link>
    );
}
