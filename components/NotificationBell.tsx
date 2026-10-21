"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BookOpen, CheckCircle, Coins, Flag, MessageCircle, ShoppingCart, Star, UserCheck, Wallet, XCircle } from "lucide-react";

export interface NotificationItem {
    id: string;
    type: string;
    message: string;
    link: string;
    is_read: boolean;
    created_at: string;
}

const POLL_MS = 30_000;
const DROPDOWN_LIMIT = 10;

// Icon and colour per notification type (lib/notifications.ts NOTIFICATION_TYPES)
const ICONS: Record<string, { icon: typeof Bell; color: string }> = {
    NEW_CHAPTER: { icon: BookOpen, color: "text-indigo-500" },
    TOPUP_APPROVED: { icon: Coins, color: "text-green-500" },
    TOPUP_REJECTED: { icon: XCircle, color: "text-red-500" },
    COMMENT_REPLY: { icon: MessageCircle, color: "text-blue-500" },
    NEW_COMMENT: { icon: MessageCircle, color: "text-blue-500" },
    NEW_RATING: { icon: Star, color: "text-yellow-500" },
    PURCHASE: { icon: ShoppingCart, color: "text-green-500" },
    WRITER_APPROVED: { icon: UserCheck, color: "text-green-500" },
    WRITER_REJECTED: { icon: XCircle, color: "text-red-500" },
    WITHDRAWAL_APPROVED: { icon: Wallet, color: "text-green-500" },
    WITHDRAWAL_REJECTED: { icon: Wallet, color: "text-red-500" },
    ADMIN_TOPUP: { icon: Coins, color: "text-amber-500" },
    ADMIN_WRITER_REQUEST: { icon: UserCheck, color: "text-purple-500" },
    ADMIN_WITHDRAWAL: { icon: Wallet, color: "text-amber-500" },
    ADMIN_REPORT: { icon: Flag, color: "text-red-500" },
};

export function NotificationIcon({ type }: { type: string }) {
    const { icon: Icon, color } = ICONS[type] ?? { icon: CheckCircle, color: "text-gray-400" };
    return <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />;
}

export function timeAgo(iso: string) {
    const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return "เมื่อสักครู่";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ชั่วโมงที่แล้ว`;
    if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)} วันที่แล้ว`;
    return new Date(iso).toLocaleDateString("th-TH");
}

const CHANGED_EVENT = "notifications:changed";

// Tell the bell to re-read its unread count (e.g. after marking things read on /notifications)
export function notificationsChanged() {
    window.dispatchEvent(new Event(CHANGED_EVENT));
}

// Mark read without waiting: keepalive lets the request finish even though we navigate away right after
export function markRead(id: string) {
    fetch(`/api/notifications/${id}`, { method: "PATCH", keepalive: true })
        .then(notificationsChanged)
        .catch(console.error);
}

// Bell with an unread badge for the Navbar. Polls the unread count every 30 s while the tab is visible and
// loads the latest notifications when opened.
export default function NotificationBell() {
    const router = useRouter();
    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<NotificationItem[] | null>(null);

    const refreshCount = useCallback(async () => {
        try {
            const res = await fetch("/api/notifications/count");
            if (res.ok) setUnread((await res.json()).unread);
        } catch {
            // offline or server restarting: try again on the next tick
        }
    }, []);

    useEffect(() => {
        refreshCount();
        const timer = setInterval(() => {
            if (document.visibilityState === "visible") refreshCount();
        }, POLL_MS);
        const onVisible = () => {
            if (document.visibilityState === "visible") refreshCount();
        };
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener(CHANGED_EVENT, refreshCount);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener(CHANGED_EVENT, refreshCount);
        };
    }, [refreshCount]);

    async function toggle() {
        const next = !open;
        setOpen(next);
        if (!next) return;
        try {
            const res = await fetch(`/api/notifications?limit=${DROPDOWN_LIMIT}`);
            if (res.ok) {
                const data = await res.json();
                setItems(data.items);
                setUnread(data.unread);
            }
        } catch (error) {
            console.error(error);
        }
    }

    function openItem(n: NotificationItem) {
        if (!n.is_read) {
            markRead(n.id);
            setItems((prev) => prev?.map((i) => (i.id === n.id ? { ...i, is_read: true } : i)) ?? null);
            setUnread((u) => Math.max(0, u - 1));
        }
        setOpen(false);
        router.push(n.link);
    }

    async function readAll() {
        const res = await fetch("/api/notifications/read-all", { method: "POST" });
        if (res.ok) {
            setItems((prev) => prev?.map((i) => ({ ...i, is_read: true })) ?? null);
            setUnread(0);
        }
    }

    return (
        <div className="relative">
            <button
                onClick={toggle}
                aria-label={unread > 0 ? `การแจ้งเตือน (${unread} รายการที่ยังไม่อ่าน)` : "การแจ้งเตือน"}
                className="relative p-2 rounded-full text-gray-600 hover:text-indigo-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-indigo-400 dark:hover:bg-gray-800"
            >
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-[1.125rem] text-center">
                        {unread > 99 ? "99+" : unread}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    {/* Phones: full width under the Navbar (the bell isn't at the screen edge there); md+: anchored to the bell */}
                    <div className="fixed inset-x-4 top-16 md:absolute md:inset-x-auto md:top-auto md:right-0 md:mt-2 md:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 z-20 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                            <span className="font-semibold text-gray-900 dark:text-white">การแจ้งเตือน</span>
                            {unread > 0 && (
                                <button onClick={readAll} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                                    อ่านทั้งหมดแล้ว
                                </button>
                            )}
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {items === null ? (
                                <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">กำลังโหลด...</p>
                            ) : items.length === 0 ? (
                                <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">ยังไม่มีการแจ้งเตือน</p>
                            ) : (
                                items.map((n) => (
                                    <button
                                        key={n.id}
                                        onClick={() => openItem(n)}
                                        className={`w-full flex gap-3 px-4 py-3 text-left border-b last:border-b-0 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${n.is_read ? "" : "bg-indigo-50/60 dark:bg-indigo-900/20"}`}
                                    >
                                        <NotificationIcon type={n.type} />
                                        <span className="flex-1 min-w-0">
                                            <span className={`block text-sm break-words ${n.is_read ? "text-gray-600 dark:text-gray-300" : "text-gray-900 dark:text-white font-medium"}`}>{n.message}</span>
                                            <span className="block text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</span>
                                        </span>
                                        {!n.is_read && <span className="w-2 h-2 mt-1.5 rounded-full bg-indigo-600 flex-shrink-0" aria-label="ยังไม่อ่าน" />}
                                    </button>
                                ))
                            )}
                        </div>
                        <Link
                            href="/notifications"
                            onClick={() => setOpen(false)}
                            className="block px-4 py-3 text-center text-sm font-medium text-indigo-600 dark:text-indigo-400 border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                            ดูการแจ้งเตือนทั้งหมด
                        </Link>
                    </div>
                </>
            )}
        </div>
    );
}
