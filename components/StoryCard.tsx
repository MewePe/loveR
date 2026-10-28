import Link from 'next/link';
import { BookOpen, Eye, Star } from 'lucide-react';
import type { ContentType } from '@/lib/contentRef';
import CategoryTags, { CategoryTagData } from '@/components/CategoryTags';
import AuthorLink from '@/components/AuthorLink';
import StoryCover from '@/components/StoryCover';

export type StoryCardData = {
    id: string; title: string; cover_image?: string | null; views?: number | null;
    author_id?: string | null; author_name?: string | null; author_username?: string | null;
    categories?: CategoryTagData[]; rating_avg?: number | null; is_completed?: boolean | number | null;
    is_mature?: boolean | number | null; item_count?: number | null;
};

const STYLES = {
    novel: { href: '/novel/', hover: 'hover:text-indigo-700 dark:hover:text-indigo-400', badge: 'bg-indigo-600', label: 'นิยาย', unit: 'บท' },
    comic: { href: '/comic/', hover: 'hover:text-pink-700 dark:hover:text-pink-400', badge: 'bg-pink-700', label: 'การ์ตูน', unit: 'ตอน' },
};

// 1.2K / 3.4M, for views on small cards
export function compactNumber(n: number) {
    return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

// Cover card used in the home page rows, search results, category pages, "similar stories" and
// "recommended for you". The author name and category tags are their own links, so the story link is split
// into the cover and the title instead of wrapping the whole card.
export default function StoryCard({ story, type, maxTags }: { story: StoryCardData; type: ContentType; maxTags?: number }) {
    const style = STYLES[type];
    const href = style.href + story.id;
    const categories = maxTags === undefined ? story.categories : story.categories?.slice(0, maxTags);
    return (
        <article className="relative group bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 motion-reduce:transition-none motion-reduce:hover:translate-y-0 overflow-hidden border border-gray-100 dark:border-gray-700 h-full flex flex-col">
            {/* Same target as the title link, so keep it out of the tab order */}
            <Link href={href} tabIndex={-1} aria-hidden="true" className="block aspect-[2/3] relative overflow-hidden bg-gray-200 dark:bg-gray-700">
                <StoryCover id={story.id} title={story.title} src={story.cover_image} type={type} mature={!!story.is_mature} />
                <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1">
                    <span className={`${style.badge} text-white text-[11px] font-medium px-2 py-0.5 rounded-full shadow`}>{style.label}</span>
                    {!!story.is_mature && <span className="bg-red-700 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow">18+</span>}
                </div>
                {!!story.is_completed && (
                    <span className="absolute bottom-2 left-2 bg-emerald-700 text-white text-[11px] font-medium px-2 py-0.5 rounded-full shadow">จบแล้ว</span>
                )}
            </Link>
            <div className="p-3 pb-2 flex-1 flex flex-col">
                <Link href={href} className={`font-bold text-gray-900 dark:text-white ${style.hover} transition line-clamp-2 text-sm leading-snug`}>
                    {story.title}
                </Link>
                <AuthorLink
                    id={story.author_id}
                    username={story.author_username}
                    name={story.author_name}
                    className="block text-gray-500 dark:text-gray-400 text-xs mt-1 truncate"
                />
                <div className="mt-auto pt-2 flex items-center gap-x-2.5 gap-y-1 flex-wrap text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1" title={`${(story.views || 0).toLocaleString('th-TH')} วิว`}>
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" /><span className="sr-only">ยอดวิว</span>{compactNumber(story.views || 0)}
                    </span>
                    {story.rating_avg != null && (
                        <span className="inline-flex items-center gap-1" title="คะแนนเฉลี่ย">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden="true" /><span className="sr-only">คะแนน</span>{story.rating_avg.toFixed(1)}
                        </span>
                    )}
                    {story.item_count != null && (
                        <span className="inline-flex items-center gap-1" title={`${story.item_count} ${style.unit}`}>
                            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />{story.item_count} {style.unit}
                        </span>
                    )}
                </div>
            </div>
            <CategoryTags categories={categories} type={type} className="px-3 pb-3" />
        </article>
    );
}
