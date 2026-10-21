"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { markRead, NotificationIcon, NotificationItem, notificationsChanged, timeAgo } from "@/components/NotificationBell";

export default function NotificationsPage() {
    const { status } = useSession();
    const router = useRouter();
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [total, setTotal] = useState(0);
    const [unread, setUnread] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const fetchPage = useCallback(async (pageNumber: number) => {
        try {
            const res = await fetch(`/api/notifications?page=${pageNumber}`);
            if (res.ok) {
                const data = await res.json();
                // Skip ones already shown: new notifications shift the pages while reading
                setItems((prev) => (pageNumber === 1 ? data.items : [...prev, ...data.items.filter((n: NotificationItem) => !prev.some((p) => p.id === n.id))]));
                setTotal(data.total);
                setUnread(data.unread);
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

    function openItem(n: NotificationItem) {
        if (!n.is_read) markRead(n.id);
        router.push(n.link);
    }

    async function readAll() {
        const res = await fetch("/api/notifications/read-all", { method: "POST" });
        if (res.ok) {
            setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
            setUnread(0);
            notificationsChanged();
        }
    }

    async function loadMore() {
        setLoadingMore(true);
        await fetchPage(page + 1);
        setLoadingMore(false);
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
                <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
                    <div className="flex items-center gap-3">
                        <Bell className="w-8 h-8 text-indigo-500" />
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">การแจ้งเตือน</h1>
                    </div>
                    {unread > 0 && (
                        <button onClick={readAll} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                            อ่านทั้งหมดแล้ว ({unread})
                        </button>
                    )}
                </div>

                {items.length > 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        {items.map((n) => (
                            <button
                                key={n.id}
                                onClick={() => openItem(n)}
                                className={`w-full flex gap-3 px-4 py-4 text-left border-b last:border-b-0 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${n.is_read ? "" : "bg-indigo-50/60 dark:bg-indigo-900/20"}`}
                            >
                                <NotificationIcon type={n.type} />
                                <span className="flex-1 min-w-0">
                                    <span className={`block break-words ${n.is_read ? "text-gray-600 dark:text-gray-300" : "text-gray-900 dark:text-white font-medium"}`}>{n.message}</span>
                                    <span className="block text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</span>
                                </span>
                                {!n.is_read && <span className="w-2.5 h-2.5 mt-1.5 rounded-full bg-indigo-600 flex-shrink-0" aria-label="ยังไม่อ่าน" />}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <Bell className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-500 dark:text-gray-400">ยังไม่มีการแจ้งเตือน</h3>
                    </div>
                )}

                {items.length < total && (
                    <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="w-full mt-4 py-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
                    >
                        {loadingMore ? "กำลังโหลด..." : "โหลดเพิ่ม"}
                    </button>
                )}
            </div>
        </div>
    );
}
