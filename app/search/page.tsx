"use client";
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, BookOpen, ImageIcon, X, ChevronDown } from 'lucide-react';
import StoryCard, { StoryCardData } from '@/components/StoryCard';
import CategoryPicker from '@/components/CategoryPicker';

// Same keys as SEARCH_SORTS in lib/ranking.ts (not imported: that module uses the database)
const SORT_OPTIONS = [
    { value: 'newest', label: 'ใหม่ล่าสุด' },
    { value: 'views', label: 'ยอดวิวสูงสุด' },
    { value: 'rating', label: 'คะแนนสูงสุด' },
] as const;
type SortValue = typeof SORT_OPTIONS[number]['value'];

// The API reads at most this many category filters (MAX_CATEGORIES in lib/categories.ts)
const MAX_FILTER_CATEGORIES = 5;

interface Category {
    id: string;
    name: string;
}

function SearchContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [query, setQuery] = useState(searchParams.get('q') || '');
    const validTypes = ['all', 'novels', 'comics'] as const;
    const rawType = searchParams.get('type');
    const [type, setType] = useState<'all' | 'novels' | 'comics'>(
        validTypes.includes(rawType as 'all' | 'novels' | 'comics') ? (rawType as 'all' | 'novels' | 'comics') : 'all'
    );
    // ?category=a,b (or repeated ?category=)
    const [categoryIds, setCategoryIds] = useState<string[]>(() =>
        [...new Set(searchParams.getAll('category').flatMap((v) => v.split(',')).filter(Boolean))].slice(0, MAX_FILTER_CATEGORIES)
    );
    const rawSort = searchParams.get('sort');
    const [sort, setSort] = useState<SortValue>(SORT_OPTIONS.find((o) => o.value === rawSort)?.value ?? 'newest');
    const [novels, setNovels] = useState<StoryCardData[]>([]);
    const [comics, setComics] = useState<StoryCardData[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = useCallback(async () => {
        setLoading(true);
        try {
            const p = new URLSearchParams();
            if (query) p.set('search', query);
            for (const id of categoryIds) p.append('categoryId', id);
            p.set('sort', sort);

            if (type === 'all' || type === 'novels') {
                const res = await fetch(`/api/novels?${p}`);
                if (res.ok) setNovels(await res.json());
            } else {
                setNovels([]);
            }

            if (type === 'all' || type === 'comics') {
                const res = await fetch(`/api/comics?${p}`);
                if (res.ok) setComics(await res.json());
            } else {
                setComics([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [query, type, categoryIds, sort]);

    useEffect(() => {
        fetchCategories();
        handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        handleSearch();
    }, [type, categoryIds, sort, handleSearch]);

    async function fetchCategories() {
        try {
            const res = await fetch('/api/categories');
            if (res.ok) setCategories(await res.json());
        } catch (e) {
            console.error(e);
        }
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        handleSearch();
        const p = new URLSearchParams();
        if (query) p.set('q', query);
        if (type !== 'all') p.set('type', type);
        if (categoryIds.length > 0) p.set('category', categoryIds.join(','));
        if (sort !== 'newest') p.set('sort', sort);
        router.push(`/search?${p}`);
    }

    const totalResults = novels.length + comics.length;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Search Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 py-12">
                <div className="container mx-auto px-4">
                    <h1 className="text-3xl font-bold text-white text-center mb-6">ค้นหานิยายและการ์ตูน</h1>
                    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="ค้นหาชื่อเรื่อง..."
                                className="w-full pl-12 pr-4 py-4 rounded-full text-lg outline-none focus:ring-4 focus:ring-white/30 bg-white text-gray-900 dark:bg-gray-800 dark:text-white"
                            />
                            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 text-white px-6 py-2 rounded-full hover:bg-indigo-700 transition">
                                ค้นหา
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                {/* Filters */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Type Filter */}
                        <div className="flex bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm">
                            <button
                                onClick={() => setType('all')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition ${type === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                                ทั้งหมด
                            </button>
                            <button
                                onClick={() => setType('novels')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${type === 'novels' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                                <BookOpen className="w-4 h-4" /> นิยาย
                            </button>
                            <button
                                onClick={() => setType('comics')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${type === 'comics' ? 'bg-pink-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                                <ImageIcon className="w-4 h-4" /> การ์ตูน
                            </button>
                        </div>

                        {/* Sort */}
                        <div className="relative">
                            <select
                                value={sort}
                                onChange={(e) => setSort(e.target.value as SortValue)}
                                aria-label="เรียงตาม"
                                className="appearance-none bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg px-4 py-2 pr-10 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                {SORT_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
                        </div>

                        {categoryIds.length > 0 && (
                            <button onClick={() => setCategoryIds([])} className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 hover:text-red-700">
                                <X className="w-4 h-4" /> ล้างหมวดหมู่
                            </button>
                        )}
                    </div>

                    <p className="text-gray-500 dark:text-gray-400">
                        พบ <span className="font-bold text-gray-900 dark:text-white">{totalResults}</span> รายการ
                    </p>
                </div>

                {/* Category Filter */}
                {categories.length > 0 && (
                    <div className="mb-8">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            หมวดหมู่ <span className="font-normal text-gray-500 dark:text-gray-400">(เลือกหลายหมวด = ต้องมีครบทุกหมวดที่เลือก)</span>
                        </p>
                        <CategoryPicker
                            label="กรองตามหมวดหมู่"
                            options={categories}
                            value={categoryIds}
                            onChange={setCategoryIds}
                            max={MAX_FILTER_CATEGORIES}
                        />
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    </div>
                ) : (
                    <>
                        {/* Novels Section */}
                        {novels.length > 0 && (type === 'all' || type === 'novels') && (
                            <div className="mb-12">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> นิยาย ({novels.length})
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 sm:gap-6">
                                    {novels.map((novel) => <StoryCard key={novel.id} story={novel} type="novel" />)}
                                </div>
                            </div>
                        )}

                        {/* Comics Section */}
                        {comics.length > 0 && (type === 'all' || type === 'comics') && (
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                    <ImageIcon className="w-5 h-5 text-pink-600 dark:text-pink-400" /> การ์ตูน ({comics.length})
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 sm:gap-6">
                                    {comics.map((comic) => <StoryCard key={comic.id} story={comic} type="comic" />)}
                                </div>
                            </div>
                        )}

                        {/* No Results */}
                        {totalResults === 0 && !loading && (
                            <div className="text-center py-16">
                                <Search className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">ไม่พบผลลัพธ์</h3>
                                <p className="text-gray-500 dark:text-gray-400">ลองค้นหาด้วยคำอื่น หรือเปลี่ยนตัวกรอง</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// useSearchParams() ต้องอยู่ใน Suspense ไม่งั้น next build จะ prerender หน้านี้ไม่ได้
export default function SearchPage() {
    return (
        <Suspense>
            <SearchContent />
        </Suspense>
    );
}
