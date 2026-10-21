"use client";
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, BookOpen, ImageIcon, X, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface Novel {
    id: string;
    title: string;
    description: string;
    cover_image: string | null;
    author_name: string;
    category_name: string;
    views: number;
}

interface Comic {
    id: string;
    title: string;
    description: string;
    cover_image: string | null;
    author_name: string;
    category_name: string;
    views: number;
}

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
    const [categoryId, setCategoryId] = useState(searchParams.get('category') || '');
    const [novels, setNovels] = useState<Novel[]>([]);
    const [comics, setComics] = useState<Comic[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);


    const handleSearch = useCallback(async () => {
        setLoading(true);
        try {
            const p = new URLSearchParams();
            if (query) p.set('search', query);
            if (categoryId) p.set('categoryId', categoryId);
            p.set('status', 'PUBLISHED');

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
    }, [query, type, categoryId]);

    useEffect(() => {
        fetchCategories();
        handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        handleSearch();
    }, [type, categoryId, handleSearch]);

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
        if (categoryId) p.set('category', categoryId);
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
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="ค้นหาชื่อเรื่อง..."
                                className="w-full pl-12 pr-4 py-4 rounded-full text-lg outline-none focus:ring-4 focus:ring-white/30 dark:bg-gray-800 dark:text-white"
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
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
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

                        {/* Category Filter */}
                        <div className="relative">
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="appearance-none bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg px-4 py-2 pr-10 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="">หมวดหมู่ทั้งหมด</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>

                        {categoryId && (
                            <button onClick={() => setCategoryId('')} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600">
                                <X className="w-4 h-4" /> ล้างตัวกรอง
                            </button>
                        )}
                    </div>

                    <p className="text-gray-500 dark:text-gray-400">
                        พบ <span className="font-bold text-gray-900 dark:text-white">{totalResults}</span> รายการ
                    </p>
                </div>

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
                                    <BookOpen className="w-5 h-5 text-indigo-600" /> นิยาย ({novels.length})
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                                    {novels.map(novel => (
                                        <Link key={novel.id} href={`/novel/${novel.id}`} className="group">
                                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden hover:shadow-lg transition">
                                                <div className="relative aspect-[3/4]">
                                                    {novel.cover_image ? (
                                                        <Image src={novel.cover_image} alt={novel.title} fill className="object-cover group-hover:scale-105 transition" />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                                            <BookOpen className="w-12 h-12 text-white/70" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-3">
                                                    <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2 text-sm group-hover:text-indigo-600 transition">{novel.title}</h3>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{novel.author_name}</p>
                                                    <p className="text-xs text-gray-400 mt-1">👁 {novel.views?.toLocaleString() || 0}</p>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Comics Section */}
                        {comics.length > 0 && (type === 'all' || type === 'comics') && (
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                    <ImageIcon className="w-5 h-5 text-pink-600" /> การ์ตูน ({comics.length})
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                                    {comics.map(comic => (
                                        <Link key={comic.id} href={`/comic/${comic.id}`} className="group">
                                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden hover:shadow-lg transition">
                                                <div className="relative aspect-[3/4]">
                                                    {comic.cover_image ? (
                                                        <Image src={comic.cover_image} alt={comic.title} fill className="object-cover group-hover:scale-105 transition" />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-pink-500 to-red-600 flex items-center justify-center">
                                                            <ImageIcon className="w-12 h-12 text-white/70" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-3">
                                                    <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2 text-sm group-hover:text-pink-600 transition">{comic.title}</h3>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{comic.author_name}</p>
                                                    <p className="text-xs text-gray-400 mt-1">👁 {comic.views?.toLocaleString() || 0}</p>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
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
