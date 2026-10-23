"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, List, Search, X } from "lucide-react";
import PriceBadge from "@/components/PriceBadge";
import type { EpisodeListItem } from "@/lib/episodeList";

// Lists with more items than this get a search box for the chapter/episode number
const SEARCH_THRESHOLD = 20;

const colors = {
    // bar buttons copy the prev/next buttons of each reader page (novel: white cards, comic: gray pills)
    indigo: {
        bar: "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 sm:px-5 py-4 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm",
        button: "hover:text-indigo-600 dark:hover:text-indigo-400",
        current: "bg-indigo-50 dark:bg-indigo-900/30 border-l-indigo-600 dark:border-l-indigo-400",
        currentText: "text-indigo-700 dark:text-indigo-300",
        ring: "focus:ring-indigo-500",
    },
    pink: {
        bar: "bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-white px-4 sm:px-6 py-3 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600",
        button: "hover:text-pink-600 dark:hover:text-pink-400",
        current: "bg-pink-50 dark:bg-pink-900/30 border-l-pink-600 dark:border-l-pink-400",
        currentText: "text-pink-700 dark:text-pink-300",
        ring: "focus:ring-pink-500",
    },
};

interface EpisodePickerProps {
    items: EpisodeListItem[];
    currentId: string;
    hrefPrefix: string; // item id is appended, e.g. "/read/" or "/comic/<id>/read/"
    accentColor?: keyof typeof colors;
    variant?: "bar" | "compact"; // bar: between the prev/next buttons, compact: in the top bar
    className?: string;
}

// "เลือกตอน" button on the reader pages: opens the full chapter/episode list with the current one
// highlighted and scrolled into view. Locked items link to the reader page too, which shows the paywall.
// Render it with key={currentId} so moving to another chapter starts with the list closed and the search cleared.
export default function EpisodePicker({ items, currentId, hrefPrefix, accentColor = "indigo", variant = "bar", className = "" }: EpisodePickerProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const currentRow = useRef<HTMLAnchorElement>(null);
    const router = useRouter();
    const colorSet = colors[accentColor];

    const visible = useMemo(() => {
        const q = query.trim();
        return q ? items.filter((item) => String(item.number).includes(q)) : items;
    }, [items, query]);

    useEffect(() => {
        if (!open) return;
        currentRow.current?.scrollIntoView({ block: "center" });
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = overflow;
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key !== "Enter") return;
        const exact = items.find((item) => String(item.number) === query.trim());
        if (exact) router.push(hrefPrefix + exact.id);
    }

    const buttonClass = variant === "bar"
        ? `shrink-0 flex items-center justify-center gap-2 transition ${colorSet.bar}`
        : `flex items-center gap-1 p-1 text-sm text-gray-500 dark:text-gray-400 transition-colors ${colorSet.button}`;

    return (
        <>
            <button type="button" onClick={() => setOpen(true)} className={`${buttonClass} ${className}`} aria-haspopup="dialog" title="เลือกตอน">
                <List className="w-5 h-5" />
                <span className={variant === "compact" ? "hidden sm:inline" : ""}>เลือกตอน</span>
            </button>

            {open && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 sm:p-4 font-sans" onClick={() => setOpen(false)}>
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="เลือกตอน"
                        className="w-full sm:max-w-lg max-h-[85vh] sm:max-h-[75vh] flex flex-col bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl border dark:border-gray-700"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                เลือกตอน <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({items.length} ตอน)</span>
                            </h2>
                            <button type="button" onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="ปิด">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {items.length > SEARCH_THRESHOLD && (
                            <div className="px-5 py-3 border-b dark:border-gray-700">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value.replace(/\D/g, ""))}
                                        onKeyDown={onSearchKey}
                                        placeholder="ค้นหาเลขตอน"
                                        className={`w-full pl-9 pr-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 ${colorSet.ring}`}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="overflow-y-auto overscroll-contain divide-y divide-gray-100 dark:divide-gray-700">
                            {visible.map((item) => {
                                const isCurrent = item.id === currentId;
                                const dimmed = item.read && !isCurrent;
                                return (
                                    <Link
                                        key={item.id}
                                        ref={isCurrent ? currentRow : undefined}
                                        href={hrefPrefix + item.id}
                                        onClick={() => setOpen(false)}
                                        aria-current={isCurrent ? "page" : undefined}
                                        className={`flex items-center gap-3 px-5 py-3 border-l-4 transition ${isCurrent ? colorSet.current : "border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}
                                    >
                                        <span className={`font-mono text-sm w-10 shrink-0 ${isCurrent ? colorSet.currentText : dimmed ? "text-gray-300 dark:text-gray-600" : "text-gray-400"}`}>#{item.number}</span>
                                        <span className={`flex-1 min-w-0 truncate ${isCurrent ? `font-bold ${colorSet.currentText}` : dimmed ? "text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-100"}`}>
                                            {item.title}
                                        </span>
                                        <span className="shrink-0 flex items-center gap-2 text-xs">
                                            {isCurrent ? (
                                                <span className={`font-medium ${colorSet.currentText}`}>กำลังอ่าน</span>
                                            ) : dimmed && (
                                                <span className="flex items-center gap-0.5 text-gray-400 dark:text-gray-500"><Check className="w-3.5 h-3.5" /> อ่านแล้ว</span>
                                            )}
                                            {item.locked && <PriceBadge price={item.price} unlocked={false} />}
                                        </span>
                                    </Link>
                                );
                            })}
                            {visible.length === 0 && (
                                <p className="px-5 py-10 text-center text-gray-500 dark:text-gray-400">ไม่พบตอนที่ {query}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
