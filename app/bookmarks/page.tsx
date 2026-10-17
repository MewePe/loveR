"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bookmark, BookOpen, Palette, Trash2 } from "lucide-react";

interface BookmarkItem {
    id: string;
    content_type: "novel" | "comic";
    content_id: string;
    title: string;
    cover_image: string | null;
    description: string | null;
    author_name: string | null;
    created_at: string;
}

export default function BookmarksPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "novel" | "comic">("all");
    const [removing, setRemoving] = useState<string | null>(null);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        } else if (status === "authenticated") {
            fetchBookmarks();
        }
    }, [status]);

    async function fetchBookmarks() {
        try {
            const res = await fetch("/api/bookmarks");
            if (res.ok) {
                const data = await res.json();
                setBookmarks(data.bookmarks);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function removeBookmark(contentType: string, contentId: string, bookmarkId: string) {
        setRemoving(bookmarkId);
        try {
            const res = await fetch("/api/bookmarks", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content_type: contentType, content_id: contentId }),
            });
            if (res.ok) {
                setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setRemoving(null);
        }
    }

    const filtered = filter === "all" ? bookmarks : bookmarks.filter((b) => b.content_type === filter);

    if (status === "loading" || loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
            <div className="container mx-auto px-4 max-w-5xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <Bookmark className="w-8 h-8 text-yellow-500" />
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">ชั้นหนังสือของฉัน</h1>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-6">
                    {[
                        { key: "all", label: "ทั้งหมด", count: bookmarks.length },
                        { key: "novel", label: "นิยาย", count: bookmarks.filter((b) => b.content_type === "novel").length },
                        { key: "comic", label: "การ์ตูน", count: bookmarks.filter((b) => b.content_type === "comic").length },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key as typeof filter)}
                            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${filter === tab.key
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500"
                                }`}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>

                {/* Bookmarks Grid */}
                {filtered.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                        {filtered.map((bookmark) => (
                            <div
                                key={bookmark.id}
                                className={`group relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 ${removing === bookmark.id ? "opacity-50 scale-95" : ""
                                    }`}
                            >
                                {/* Cover */}
                                <Link href={bookmark.content_type === "novel" ? `/novel/${bookmark.content_id}` : `/comic/${bookmark.content_id}`}>
                                    <div className={`aspect-[2/3] relative overflow-hidden ${bookmark.content_type === "novel"
                                        ? "bg-gradient-to-br from-indigo-500 to-purple-600"
                                        : "bg-gradient-to-br from-pink-500 to-rose-600"
                                        }`}
                                    >
                                        {bookmark.cover_image ? (
                                            <img
                                                src={bookmark.cover_image}
                                                alt={bookmark.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/50 text-4xl">
                                                {bookmark.content_type === "novel" ? "📖" : "🎨"}
                                            </div>
                                        )}
                                        {/* Type Badge */}
                                        <div className="absolute top-2 left-2">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold text-white ${bookmark.content_type === "novel" ? "bg-indigo-600/90" : "bg-pink-600/90"
                                                }`}>
                                                {bookmark.content_type === "novel" ? (
                                                    <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> นิยาย</span>
                                                ) : (
                                                    <span className="flex items-center gap-1"><Palette className="w-3 h-3" /> การ์ตูน</span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </Link>

                                {/* Info */}
                                <div className="p-3">
                                    <Link href={bookmark.content_type === "novel" ? `/novel/${bookmark.content_id}` : `/comic/${bookmark.content_id}`}>
                                        <h3 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                                            {bookmark.title || "ไม่ทราบชื่อ"}
                                        </h3>
                                    </Link>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{bookmark.author_name || "ไม่ทราบผู้เขียน"}</p>

                                    {/* Remove Button */}
                                    <button
                                        onClick={() => removeBookmark(bookmark.content_type, bookmark.content_id, bookmark.id)}
                                        className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        นำออก
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <Bookmark className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-500 dark:text-gray-400 mb-2">
                            {filter === "all" ? "ชั้นหนังสือว่างเปล่า" : filter === "novel" ? "ยังไม่มีนิยายที่บันทึกไว้" : "ยังไม่มีการ์ตูนที่บันทึกไว้"}
                        </h3>
                        <p className="text-gray-400 dark:text-gray-500 mb-6">ลองเพิ่มนิยายหรือการ์ตูนที่ชอบลงในชั้นหนังสือ</p>
                        <Link href="/" className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition">
                            สำรวจเนื้อหา
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
