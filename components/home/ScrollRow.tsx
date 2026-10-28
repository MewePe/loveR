"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// A horizontally scrolling row of cards (swipe on phones, arrow buttons on wider screens). Each child should
// be a fixed-width item; the row snaps to them. `label` names the list for screen readers.
export default function ScrollRow({ children, label }: { children: React.ReactNode; label: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [edges, setEdges] = useState({ start: true, end: true });

    const update = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    }, []);

    useEffect(() => {
        update();
        const el = ref.current;
        if (!el) return;
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, [update]);

    const scroll = (dir: 1 | -1) => {
        const el = ref.current;
        if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
    };

    const arrow = "hidden md:flex absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-white/95 dark:bg-gray-800/95 text-gray-800 dark:text-gray-100 shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700 transition";

    return (
        <div className="relative">
            {!edges.start && <button type="button" onClick={() => scroll(-1)} className={`${arrow} left-1`} aria-label={`เลื่อน${label}ไปทางซ้าย`}><ChevronLeft className="w-5 h-5" /></button>}
            <div
                ref={ref}
                onScroll={update}
                role="list"
                aria-label={label}
                className="relative flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 pt-1 pb-3 scroll-px-4"
            >
                {children}
            </div>
            {!edges.end && <button type="button" onClick={() => scroll(1)} className={`${arrow} right-1`} aria-label={`เลื่อน${label}ไปทางขวา`}><ChevronRight className="w-5 h-5" /></button>}
        </div>
    );
}

// Fixed-width slot for a card inside ScrollRow
export function RowItem({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
    return <div role="listitem" className={`snap-start flex-shrink-0 ${wide ? "w-72 sm:w-80" : "w-36 sm:w-40 lg:w-44"}`}>{children}</div>;
}
