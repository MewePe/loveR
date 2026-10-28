"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, List, Search, X } from "lucide-react";
import PriceBadge from "@/components/PriceBadge";
import type { EpisodeListItem } from "@/lib/episodeList";

const ANIMATION_MS = 200;

const colors = {
    // bar buttons copy the prev/next buttons of each reader page (novel: white cards, comic: gray pills)
    indigo: {
        bar: "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 sm:px-5 py-4 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm",
        button: "hover:text-indigo-600 dark:hover:text-indigo-400",
        current: "bg-indigo-50 dark:bg-indigo-900/40 border-l-indigo-600 dark:border-l-indigo-400",
        currentText: "text-indigo-700 dark:text-indigo-300",
        ring: "focus:ring-indigo-500",
    },
    pink: {
        bar: "bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-white px-4 sm:px-6 py-3 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600",
        button: "hover:text-pink-600 dark:hover:text-pink-400",
        current: "bg-pink-50 dark:bg-pink-900/40 border-l-pink-600 dark:border-l-pink-400",
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

// "เลือกตอน" button on the reader pages. Opens the table of contents ("สารบัญ") as a panel that slides in from the
// right on md+ screens (full height below the site navbar) and up from the bottom on phones. The panel is rendered
// into document.body with a portal: the reader top bars use backdrop-blur, which would otherwise become the
// containing block of a `position: fixed` panel and pin it inside the bar.
// The current item is highlighted and scrolled into view; the backdrop, the X button and Esc close it.
// Locked items link to the reader page too, which shows the paywall.
// Render it with key={currentId} so moving to another chapter starts with the panel closed and the search cleared.
export default function EpisodePicker({ items, currentId, hrefPrefix, accentColor = "indigo", variant = "bar", className = "" }: EpisodePickerProps) {
    const [mounted, setMounted] = useState(false); // panel in the DOM
    const [shown, setShown] = useState(false); // slid in (drives the transition)
    const [query, setQuery] = useState("");
    const trigger = useRef<HTMLButtonElement>(null);
    const panel = useRef<HTMLDivElement>(null);
    const list = useRef<HTMLDivElement>(null);
    const currentRow = useRef<HTMLAnchorElement>(null);
    const searchBox = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const colorSet = colors[accentColor];
    const unit = hrefPrefix.startsWith("/read/") ? "บท" : "ตอน";

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter((item) => String(item.number).includes(q) || item.title.toLowerCase().includes(q));
    }, [items, query]);

    const open = () => {
        setMounted(true);
        // Next frame, so the panel is painted off-screen first and the slide-in transition runs
        requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    };
    const close = useCallback(() => {
        setShown(false);
        setTimeout(() => {
            setMounted(false);
            setQuery("");
            trigger.current?.focus();
        }, ANIMATION_MS);
    }, []);

    // Scroll the list (not the page) so the current item sits in the middle, before the panel is painted
    useLayoutEffect(() => {
        if (!mounted) return;
        const box = list.current, row = currentRow.current;
        if (box && row) box.scrollTop = row.offsetTop - box.clientHeight / 2 + row.offsetHeight / 2;
    }, [mounted]);

    useEffect(() => {
        if (!mounted) return;
        // Focus the search box on desktop; on phones that would pop the keyboard over the list
        (window.matchMedia("(min-width: 768px)").matches ? searchBox.current : panel.current)?.focus({ preventScroll: true });
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close();
            // Keep Tab inside the panel
            if (e.key === "Tab" && panel.current) {
                const focusable = panel.current.querySelectorAll<HTMLElement>("a[href], button, input");
                const first = focusable[0], last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = overflow;
            window.removeEventListener("keydown", onKey);
        };
    }, [mounted, close]);

    function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key !== "Enter") return;
        const exact = items.find((item) => String(item.number) === query.trim()) ?? (visible.length === 1 ? visible[0] : null);
        if (exact) router.push(hrefPrefix + exact.id);
    }

    const buttonClass = variant === "bar"
        ? `shrink-0 flex items-center justify-center gap-2 transition ${colorSet.bar}`
        : `flex items-center gap-1 p-1 text-sm text-gray-500 dark:text-gray-400 transition-colors ${colorSet.button}`;

    const current = items.find((item) => item.id === currentId);

    return (
        <>
            <button ref={trigger} type="button" onClick={open} className={`${buttonClass} ${className}`} aria-haspopup="dialog" aria-expanded={mounted} title="สารบัญ">
                <List className="w-5 h-5" />
                <span className={variant === "compact" ? "hidden sm:inline" : ""}>เลือกตอน</span>
            </button>

            {mounted && createPortal(
                <div className="fixed inset-0 z-[100] font-sans">
                    {/* Backdrop: click to close */}
                    <div
                        aria-hidden="true"
                        onClick={close}
                        className={`absolute inset-0 bg-black/50 transition-opacity motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
                        style={{ transitionDuration: `${ANIMATION_MS}ms` }}
                    />
                    <div
                        ref={panel}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="episode-picker-title"
                        tabIndex={-1}
                        style={{ transitionDuration: `${ANIMATION_MS}ms` }}
                        className={`absolute flex flex-col bg-white dark:bg-gray-800 shadow-2xl outline-none transition-transform ease-out motion-reduce:transition-none
                            inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t border-gray-200 dark:border-gray-700
                            md:inset-x-auto md:right-0 md:top-16 md:bottom-0 md:max-h-none md:w-[26rem] md:rounded-none md:rounded-tl-2xl md:border-t-0 md:border-l
                            ${shown ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full"}`}
                    >
                        {/* Grab handle on phones */}
                        <div className="md:hidden flex justify-center pt-2" aria-hidden="true"><span className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" /></div>
                        <div className="flex items-start justify-between gap-3 px-5 pt-3 md:pt-5 pb-3">
                            <div className="min-w-0">
                                <h2 id="episode-picker-title" className="text-lg font-bold text-gray-900 dark:text-white">สารบัญ</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    ทั้งหมด {items.length} {unit}{current ? ` · กำลังอ่าน${unit}ที่ ${current.number}` : ""}
                                </p>
                            </div>
                            <button type="button" onClick={close} className="p-2 -m-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200" aria-label="ปิดสารบัญ" title="ปิด">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-5 pb-3 border-b border-gray-200 dark:border-gray-700">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                                <input
                                    ref={searchBox}
                                    type="search"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={onSearchKey}
                                    placeholder={`ค้นหาเลข${unit}หรือชื่อ${unit}`}
                                    aria-label={`ค้นหา${unit}`}
                                    className={`w-full pl-9 pr-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 ${colorSet.ring}`}
                                />
                            </div>
                        </div>

                        <div ref={list} className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-gray-100 dark:divide-gray-700 pb-[env(safe-area-inset-bottom)]">
                            {visible.map((item) => {
                                const isCurrent = item.id === currentId;
                                const dimmed = item.read && !isCurrent;
                                return (
                                    <Link
                                        key={item.id}
                                        ref={isCurrent ? currentRow : undefined}
                                        href={hrefPrefix + item.id}
                                        onClick={close}
                                        aria-current={isCurrent ? "page" : undefined}
                                        className={`flex items-center gap-3 px-5 py-3 border-l-4 transition-colors ${isCurrent ? colorSet.current : "border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}
                                    >
                                        <span className={`font-mono text-sm w-10 shrink-0 ${isCurrent ? colorSet.currentText : dimmed ? "text-gray-500 dark:text-gray-400" : "text-gray-600 dark:text-gray-300"}`}>#{item.number}</span>
                                        <span className={`flex-1 min-w-0 truncate ${isCurrent ? `font-bold ${colorSet.currentText}` : dimmed ? "text-gray-500 dark:text-gray-400" : "text-gray-800 dark:text-gray-100"}`}>
                                            {item.title}
                                        </span>
                                        <span className="shrink-0 flex items-center gap-2 text-xs">
                                            {isCurrent ? (
                                                <span className={`font-medium ${colorSet.currentText}`}>กำลังอ่าน</span>
                                            ) : dimmed && (
                                                <span className="flex items-center gap-0.5 text-gray-500 dark:text-gray-400"><Check className="w-3.5 h-3.5" /> อ่านแล้ว</span>
                                            )}
                                            {item.locked && <PriceBadge price={item.price} unlocked={false} />}
                                        </span>
                                    </Link>
                                );
                            })}
                            {visible.length === 0 && (
                                <p className="px-5 py-10 text-center text-gray-500 dark:text-gray-400">ไม่พบ{unit} &ldquo;{query}&rdquo;</p>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
