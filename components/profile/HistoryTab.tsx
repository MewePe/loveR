"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, History, Palette, Trash2 } from "lucide-react";
import AuthorLink from "@/components/AuthorLink";
import StoryCover from "@/components/StoryCover";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

interface HistoryItem {
    content_type: "novel" | "comic";
    content_id: string;
    title: string;
    cover_image: string | null;
    is_mature: number | boolean | null;
    author_name: string | null;
    author_id: string | null;
    author_username: string | null;
    last_item_id: string | null; // null if that chapter/episode was deleted
    last_item_title: string | null;
    read_at: string;
}

const storyUrl = (item: HistoryItem) => `/${item.content_type}/${item.content_id}`;
function continueUrl(item: HistoryItem) {
    if (!item.last_item_id) return storyUrl(item);
    return item.content_type === "novel" ? `/read/${item.last_item_id}` : `/comic/${item.content_id}/read/${item.last_item_id}`;
}

// "ประวัติการอ่าน" tab on your own profile (/profile/<username>?tab=history), from /api/history (20 per page)
export default function HistoryTab() {
    const toast = useToast();
    const confirm = useConfirm();
    const [items, setItems] = useState<HistoryItem[] | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [removing, setRemoving] = useState<string | null>(null);

    const fetchPage = useCallback(async (pageNumber: number) => {
        try {
            const res = await fetch(`/api/history?page=${pageNumber}`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.error || "โหลดประวัติการอ่านไม่สำเร็จ");
                setItems((prev) => prev ?? []);
                return;
            }
            setItems((prev) => (pageNumber === 1 ? data.items : [...(prev ?? []), ...data.items]));
            setTotal(data.total);
            setPage(pageNumber);
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
            setItems((prev) => prev ?? []);
        }
    }, [toast]);
    useEffect(() => { fetchPage(1); }, [fetchPage]);

    async function remove(item: HistoryItem) {
        setRemoving(item.content_id);
        try {
            const res = await fetch("/api/history", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ content_type: item.content_type, content_id: item.content_id }),
            });
            if (res.ok) {
                setItems((prev) => prev?.filter((i) => i.content_id !== item.content_id) ?? null);
                setTotal((t) => t - 1);
            } else {
                toast.error("นำออกไม่สำเร็จ");
            }
        } finally {
            setRemoving(null);
        }
    }

    async function clearAll() {
        if (!(await confirm("ล้างประวัติการอ่านทั้งหมด?", { confirmText: "ล้างประวัติ", danger: true }))) return;
        const res = await fetch("/api/history", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ all: true }),
        });
        if (res.ok) {
            setItems([]);
            setTotal(0);
            toast.success("ล้างประวัติการอ่านแล้ว");
        } else {
            toast.error("ล้างประวัติไม่สำเร็จ");
        }
    }

    if (!items) return <p className="p-10 text-center text-gray-500 dark:text-gray-400">กำลังโหลด...</p>;

    if (items.length === 0) {
        return (
            <div className="p-10 text-center">
                <History className="w-10 h-10 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">ยังไม่มีประวัติการอ่าน</p>
                <Link href="/" className="inline-block px-5 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">ไปหน้าแรก</Link>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="flex justify-end mb-2">
                <button type="button" onClick={clearAll} className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-700 dark:hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 className="w-4 h-4" /> ล้างประวัติ
                </button>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.map((item) => (
                    <li key={`${item.content_type}-${item.content_id}`} className={`flex gap-4 py-3 transition-opacity ${removing === item.content_id ? "opacity-50" : ""}`}>
                        <Link href={storyUrl(item)} tabIndex={-1} aria-hidden="true" className="relative shrink-0 w-16 aspect-[2/3] rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                            <StoryCover id={item.content_id} title={item.title || ""} src={item.cover_image} type={item.content_type} mature={!!Number(item.is_mature)} compact />
                        </Link>
                        <div className="min-w-0 flex-1 flex flex-col">
                            <p className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-gray-400">
                                {item.content_type === "novel"
                                    ? <span className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-400"><BookOpen className="w-3 h-3" /> นิยาย</span>
                                    : <span className="inline-flex items-center gap-1 text-pink-700 dark:text-pink-400"><Palette className="w-3 h-3" /> การ์ตูน</span>}
                                <span>{new Date(item.read_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</span>
                            </p>
                            <Link href={storyUrl(item)} className="font-bold text-gray-900 dark:text-white truncate hover:underline">{item.title || "ไม่ทราบชื่อ"}</Link>
                            <AuthorLink id={item.author_id} username={item.author_username} name={item.author_name} fallback="ไม่ทราบผู้เขียน" className="block text-xs text-gray-500 dark:text-gray-400 truncate" />
                            <p className="text-sm text-gray-600 dark:text-gray-300 truncate mt-1">อ่านล่าสุด: {item.last_item_title || "ตอนนี้ถูกลบแล้ว"}</p>
                            <div className="flex items-center gap-2 mt-auto pt-2">
                                <Link href={continueUrl(item)} className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-indigo-700">อ่านต่อ</Link>
                                <button type="button" onClick={() => remove(item)} disabled={removing === item.content_id} className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-700 dark:hover:text-red-400 px-2 py-1.5">
                                    <Trash2 className="w-3 h-3" /> นำออก
                                </button>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
            {items.length < total && (
                <button
                    type="button"
                    onClick={async () => { setLoadingMore(true); await fetchPage(page + 1); setLoadingMore(false); }}
                    disabled={loadingMore}
                    className="w-full mt-2 py-2.5 text-sm font-medium text-indigo-700 dark:text-indigo-400 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                    {loadingMore ? "กำลังโหลด..." : "โหลดเพิ่ม"}
                </button>
            )}
        </div>
    );
}
