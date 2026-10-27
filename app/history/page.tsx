"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthorLink from "@/components/AuthorLink";
import { BookOpen, History, Palette, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";

interface HistoryItem {
    content_type: "novel" | "comic";
    content_id: string;
    title: string;
    cover_image: string | null;
    author_name: string | null;
    author_id: string | null;
    author_username: string | null;
    last_item_id: string | null; // null if that chapter/episode was deleted
    last_item_title: string | null;
    read_at: string;
}

function storyUrl(item: HistoryItem) {
    return item.content_type === "novel" ? `/novel/${item.content_id}` : `/comic/${item.content_id}`;
}

function continueUrl(item: HistoryItem) {
    if (!item.last_item_id) return storyUrl(item);
    return item.content_type === "novel" ? `/read/${item.last_item_id}` : `/comic/${item.content_id}/read/${item.last_item_id}`;
}

export default function HistoryPage() {
    const { status } = useSession();
    const router = useRouter();
    const confirm = useConfirm();
    const [items, setItems] = useState<HistoryItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [removing, setRemoving] = useState<string | null>(null);

    const fetchPage = useCallback(async (pageNumber: number) => {
        try {
            const res = await fetch(`/api/history?page=${pageNumber}`);
            if (res.ok) {
                const data = await res.json();
                setItems((prev) => (pageNumber === 1 ? data.items : [...prev, ...data.items]));
                setTotal(data.total);
                setPage(pageNumber);
            }
        } catch (error) {
            console.error(error);
        }
    }, []);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        } else if (status === "authenticated") {
            fetchPage(1).finally(() => setLoading(false));
        }
    }, [status, router, fetchPage]);

    async function loadMore() {
        setLoadingMore(true);
        await fetchPage(page + 1);
        setLoadingMore(false);
    }

    async function removeItem(item: HistoryItem) {
        setRemoving(item.content_id);
        try {
            const res = await fetch("/api/history", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content_type: item.content_type, content_id: item.content_id }),
            });
            if (res.ok) {
                setItems((prev) => prev.filter((i) => i.content_id !== item.content_id));
                setTotal((t) => t - 1);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setRemoving(null);
        }
    }

    async function clearAll() {
        if (!(await confirm("ล้างประวัติการอ่านทั้งหมด?", { confirmText: "ล้างประวัติ", danger: true }))) return;
        const res = await fetch("/api/history", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ all: true }),
        });
        if (res.ok) {
            setItems([]);
            setTotal(0);
        }
    }

    if (status === "loading" || loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
            <div className="container mx-auto px-4 max-w-3xl">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 mb-8">
                    <div className="flex items-center gap-3">
                        <History className="w-8 h-8 text-blue-500 dark:text-blue-400" />
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">ประวัติการอ่าน</h1>
                    </div>
                    {items.length > 0 && (
                        <button
                            onClick={clearAll}
                            className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        >
                            <Trash2 className="w-4 h-4" />
                            ล้างประวัติ
                        </button>
                    )}
                </div>

                {items.length > 0 ? (
                    <div className="space-y-3">
                        {items.map((item) => (
                            <div
                                key={`${item.content_type}-${item.content_id}`}
                                className={`flex gap-4 bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700 transition ${removing === item.content_id ? "opacity-50" : ""}`}
                            >
                                {/* Cover */}
                                <Link href={storyUrl(item)} className="shrink-0">
                                    <div className={`w-16 aspect-[2/3] rounded-lg overflow-hidden ${item.content_type === "novel"
                                        ? "bg-gradient-to-br from-indigo-500 to-purple-600"
                                        : "bg-gradient-to-br from-pink-500 to-rose-600"
                                        }`}
                                    >
                                        {item.cover_image ? (
                                            <img src={item.cover_image} alt={item.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/50 text-2xl">
                                                {item.content_type === "novel" ? "📖" : "🎨"}
                                            </div>
                                        )}
                                    </div>
                                </Link>

                                {/* Info */}
                                <div className="flex-1 min-w-0 flex flex-col">
                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                        {item.content_type === "novel" ? (
                                            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400"><BookOpen className="w-3 h-3" /> นิยาย</span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-pink-600 dark:text-pink-400"><Palette className="w-3 h-3" /> การ์ตูน</span>
                                        )}
                                        <span>· {new Date(item.read_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</span>
                                    </div>
                                    <Link href={storyUrl(item)}>
                                        <h3 className="font-bold text-gray-900 dark:text-white truncate hover:text-indigo-600 dark:hover:text-indigo-400 transition">
                                            {item.title || "ไม่ทราบชื่อ"}
                                        </h3>
                                    </Link>
                                    <AuthorLink id={item.author_id} username={item.author_username} name={item.author_name} fallback="ไม่ทราบผู้เขียน" className="block text-xs text-gray-500 dark:text-gray-400 truncate" />
                                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate mt-1">
                                        อ่านล่าสุด: {item.last_item_title || "ตอนนี้ถูกลบแล้ว"}
                                    </p>
                                    <div className="flex items-center gap-2 mt-auto pt-2">
                                        <Link
                                            href={continueUrl(item)}
                                            className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-indigo-700 transition"
                                        >
                                            อ่านต่อ
                                        </Link>
                                        <button
                                            onClick={() => removeItem(item)}
                                            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            นำออก
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {items.length < total && (
                            <button
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="w-full py-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
                            >
                                {loadingMore ? "กำลังโหลด..." : "โหลดเพิ่ม"}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <History className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-500 dark:text-gray-400 mb-2">ยังไม่มีประวัติการอ่าน</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">เรื่องที่คุณเปิดอ่านจะแสดงที่นี่ พร้อมปุ่มอ่านต่อจากตอนล่าสุด</p>
                        <Link href="/" className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition">
                            สำรวจเนื้อหา
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
