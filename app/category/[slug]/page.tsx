import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Tag } from 'lucide-react';
import StoryCard from '@/components/StoryCard';
import { getCategoryBySlug } from '@/lib/categories';
import { isSortKey, listStories, SEARCH_SORTS, SORTS } from '@/lib/ranking';

const PER_TYPE = 60;

const SECTIONS = [
    { type: 'novel', label: 'นิยาย' },
    { type: 'comic', label: 'การ์ตูน' },
] as const;

// Every published novel and comic in one category (where the category tags link to)
export default async function CategoryPage({ params, searchParams }: {
    params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string }>;
}) {
    const { slug } = await params;
    const { sort: rawSort } = await searchParams;
    let decoded = slug;
    try { decoded = decodeURIComponent(slug); } catch { /* already decoded */ }
    const category = await getCategoryBySlug(decoded);
    if (!category) notFound();

    const sort = isSortKey(SEARCH_SORTS, rawSort) ? rawSort : 'views';
    const [novels, comics] = await Promise.all(
        SECTIONS.map((s) => listStories(s.type, { categoryIds: [category.id], sort, limit: PER_TYPE }))
    );
    const results = { novel: novels, comic: comics };
    const base = `/category/${encodeURIComponent(category.slug)}`;

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
            <div className="container mx-auto px-4 py-10">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">หมวดหมู่</p>
                <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white mb-6 break-words">
                    <Tag className="w-7 h-7 shrink-0 text-indigo-600 dark:text-indigo-400" /> {category.name}
                </h1>

                <div className="flex flex-wrap items-center gap-2 mb-8">
                    {SEARCH_SORTS.map((key) => (
                        <Link
                            key={key}
                            href={`${base}?sort=${key}`}
                            className={`shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition ${key === sort ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                        >
                            {SORTS[key].label}
                        </Link>
                    ))}
                    <Link href={`/search?category=${encodeURIComponent(category.id)}`} className="ml-auto text-sm text-indigo-700 dark:text-indigo-400 hover:underline">
                        ค้นหาหรือกรองเพิ่มเติม
                    </Link>
                </div>

                {novels.length === 0 && comics.length === 0 ? (
                    <div className="text-center py-16 text-gray-500 dark:text-gray-400">ยังไม่มีเรื่องในหมวดนี้</div>
                ) : SECTIONS.map(({ type, label }) => results[type].length > 0 && (
                    <section key={type} className="mb-12">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">{label} ({results[type].length})</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 sm:gap-6">
                            {results[type].map((story) => <StoryCard key={story.id} story={story} type={type} />)}
                        </div>
                    </section>
                ))}
            </div>
        </main>
    );
}
