"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Bookmark, Palette, Trash2 } from "lucide-react";
import AuthorLink from "@/components/AuthorLink";
import StoryCover from "@/components/StoryCover";
import { useToast } from "@/components/Toast";

interface BookmarkItem {
    id: string;
    content_type: "novel" | "comic";
    content_id: string;
    title: string;
    cover_image: string | null;
    is_mature: number | boolean | null;
    author_name: string | null;
    author_id: string | null;
    author_username: string | null;
    created_at: string;
}
type Filter = "all" | "novel" | "comic";

// "บุ๊กมาร์ก" tab on your own profile (/profile/<username>?tab=bookmarks), from /api/bookmarks
export default function BookmarksTab() {
    const toast = useToast();
    const [items, setItems] = useState<BookmarkItem[] | null>(null);
    const [filter, setFilter] = useState<Filter>("all");
    const [removing, setRemoving] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/bookmarks", { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            setItems(res.ok ? data.bookmarks : []);
            if (!res.ok) toast.error(data.error || "โหลดบุ๊กมาร์กไม่สำเร็จ");
        } catch {
            setItems([]);
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
        }
    }, [toast]);
    useEffect(() => { load(); }, [load]);

    async function remove(item: BookmarkItem) {
        setRemoving(item.id);
        try {
            const res = await fetch("/api/bookmarks", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ content_type: item.content_type, content_id: item.content_id }),
            });
            if (res.ok) setItems((prev) => prev?.filter((b) => b.id !== item.id) ?? null);
            else toast.error("นำออกไม่สำเร็จ");
        } finally {
            setRemoving(null);
        }
    }

    if (!items) return <p className="p-10 text-center text-gray-500 dark:text-gray-400">กำลังโหลด...</p>;

    const shown = filter === "all" ? items : items.filter((b) => b.content_type === filter);
    const filters: { key: Filter; label: string; count: number }[] = [
        { key: "all", label: "ทั้งหมด", count: items.length },
        { key: "novel", label: "นิยาย", count: items.filter((b) => b.content_type === "novel").length },
        { key: "comic", label: "การ์ตูน", count: items.filter((b) => b.content_type === "comic").length },
    ];

    return (
        <div className="p-4">
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] mb-4" role="group" aria-label="กรองบุ๊กมาร์ก">
                {filters.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        onClick={() => setFilter(f.key)}
                        aria-pressed={filter === f.key}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${filter === f.key
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
                    >
                        {f.label} ({f.count})
                    </button>
                ))}
            </div>

            {shown.length === 0 ? (
                <div className="py-10 text-center">
                    <Bookmark className="w-10 h-10 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 mb-4">ยังไม่มีเรื่องที่บุ๊กมาร์กไว้</p>
                    <Link href="/search" className="inline-block px-5 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">ค้นหาเรื่องที่ชอบ</Link>
                </div>
            ) : (
                <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {shown.map((item) => {
                        const href = `/${item.content_type}/${item.content_id}`;
                        return (
                            <li key={item.id} className={`relative flex flex-col transition-opacity ${removing === item.id ? "opacity-50" : ""}`}>
                                <Link href={href} className="group relative block aspect-[2/3] rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-700" tabIndex={-1} aria-hidden="true">
                                    <StoryCover id={item.content_id} title={item.title} src={item.cover_image} type={item.content_type} mature={!!Number(item.is_mature)} />
                                    <span className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold text-white ${item.content_type === "novel" ? "bg-indigo-700" : "bg-pink-700"}`}>
                                        {item.content_type === "novel" ? <BookOpen className="w-3 h-3" /> : <Palette className="w-3 h-3" />}
                                        {item.content_type === "novel" ? "นิยาย" : "การ์ตูน"}
                                    </span>
                                </Link>
                                <Link href={href} className="mt-2 font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 break-words hover:underline">{item.title}</Link>
                                <AuthorLink id={item.author_id} username={item.author_username} name={item.author_name} fallback="ไม่ทราบผู้เขียน" className="text-xs text-gray-500 dark:text-gray-400 truncate" />
                                <button
                                    type="button"
                                    onClick={() => remove(item)}
                                    disabled={removing === item.id}
                                    className="mt-1 self-start inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-700 dark:hover:text-red-400"
                                >
                                    <Trash2 className="w-3 h-3" /> นำออก
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
