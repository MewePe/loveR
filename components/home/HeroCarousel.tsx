"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronLeft, ChevronRight, Eye, Pause, Play, Star } from "lucide-react";
import StoryCover from "@/components/StoryCover";
import { compactNumber } from "@/components/StoryCard";

export interface HeroSlide {
    type: "novel" | "comic"; id: string; title: string; description: string; cover_image: string | null;
    author_name: string | null; views: number; rating_avg: number | null; item_count: number; is_completed: boolean;
    first_item_id: string | null; categories: { id: string; name: string }[];
}

const INTERVAL_MS = 6000;

// Featured stories banner on the home page. Advances by itself every 6 seconds; pauses while hovered or
// focused, when the browser tab is hidden, when the visitor presses pause, and never auto-plays for people
// who prefer reduced motion.
export default function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
    const [index, setIndex] = useState(0);
    const [hovered, setHovered] = useState(false);
    const [paused, setPaused] = useState(false);
    const [reduced, setReduced] = useState(false);
    const count = slides.length;

    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReduced(mq.matches);
        const onChange = () => setReduced(mq.matches);
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, []);

    const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

    useEffect(() => {
        if (count < 2 || hovered || paused || reduced) return;
        const timer = setInterval(() => { if (document.visibilityState === "visible") setIndex((i) => (i + 1) % count); }, INTERVAL_MS);
        return () => clearInterval(timer);
    }, [count, hovered, paused, reduced]);

    if (count === 0) return null;

    return (
        <section
            aria-roledescription="carousel"
            aria-label="เรื่องแนะนำ"
            className="relative overflow-hidden bg-gray-900 text-white"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={() => setHovered(false)}
        >
            <div className="relative h-[26rem] sm:h-[24rem] lg:h-[28rem]">
                {slides.map((s, i) => {
                    const active = i === index;
                    const storyHref = `/${s.type}/${s.id}`;
                    const readHref = s.first_item_id ? (s.type === "novel" ? `/read/${s.first_item_id}` : `/comic/${s.id}/read/${s.first_item_id}`) : storyHref;
                    return (
                        <div
                            key={`${s.type}-${s.id}`}
                            role="group"
                            aria-roledescription="slide"
                            aria-label={`${i + 1} จาก ${count}: ${s.title}`}
                            aria-hidden={!active}
                            inert={!active}
                            className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${active ? "opacity-100 z-10" : "opacity-0 z-0"}`}
                        >
                            {/* Blurred cover as the backdrop, darkened so the text always reads */}
                            <div className="absolute inset-0 scale-110 blur-2xl opacity-60" aria-hidden="true">
                                <StoryCover id={s.id} title="" src={s.cover_image} type={s.type} eager={i === 0} />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-r from-gray-950/95 via-gray-950/80 to-indigo-950/60" aria-hidden="true" />
                            <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-transparent to-transparent" aria-hidden="true" />

                            <div className="relative container mx-auto px-4 h-full flex items-center gap-8 lg:gap-12">
                                <div className="flex-1 min-w-0 pb-10 sm:pb-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.type === "novel" ? "bg-indigo-600" : "bg-pink-700"}`}>{s.type === "novel" ? "นิยาย" : "การ์ตูน"}</span>
                                        {s.is_completed && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-700">จบแล้ว</span>}
                                        {s.categories.slice(0, 3).map((c) => <span key={c.id} className="text-xs px-2.5 py-1 rounded-full bg-white/15">{c.name}</span>)}
                                    </div>
                                    <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-3 line-clamp-2">{s.title}</h2>
                                    {s.author_name && <p className="text-sm text-gray-300 mb-3">โดย {s.author_name}</p>}
                                    {s.description && <p className="text-gray-200 text-sm sm:text-base max-w-2xl line-clamp-3 mb-4 whitespace-pre-line">{s.description}</p>}
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300 mb-6">
                                        <span className="inline-flex items-center gap-1.5"><Eye className="w-4 h-4" aria-hidden="true" />{compactNumber(s.views)} วิว</span>
                                        {s.rating_avg != null && <span className="inline-flex items-center gap-1.5"><Star className="w-4 h-4 fill-amber-400 text-amber-400" aria-hidden="true" />{s.rating_avg.toFixed(1)}</span>}
                                        <span className="inline-flex items-center gap-1.5"><BookOpen className="w-4 h-4" aria-hidden="true" />{s.item_count} {s.type === "novel" ? "บท" : "ตอน"}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <Link href={readHref} className="inline-flex items-center gap-2 bg-white text-indigo-700 px-6 py-2.5 rounded-full font-bold hover:bg-indigo-50 transition shadow-lg">
                                            <BookOpen className="w-4 h-4" aria-hidden="true" />อ่านเลย
                                        </Link>
                                        <Link href={storyHref} className="inline-flex items-center px-6 py-2.5 rounded-full font-bold border-2 border-white/70 hover:bg-white/10 transition">
                                            รายละเอียด
                                        </Link>
                                    </div>
                                </div>
                                <Link href={storyHref} tabIndex={-1} aria-hidden="true" className="hidden sm:block relative flex-shrink-0 w-40 lg:w-52 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/20 rotate-2 hover:rotate-0 transition-transform duration-300 motion-reduce:transition-none">
                                    <StoryCover id={s.id} title={s.title} src={s.cover_image} type={s.type} eager={i === 0} />
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>

            {count > 1 && (
                <div className="absolute bottom-4 inset-x-0 z-20">
                    <div className="container mx-auto px-4 flex items-center gap-3">
                        <button type="button" onClick={() => go(index - 1)} className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center" aria-label="เรื่องก่อนหน้า"><ChevronLeft className="w-5 h-5" /></button>
                        <div className="flex items-center gap-2">
                            {slides.map((s, i) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => go(i)}
                                    aria-label={`ไปเรื่องที่ ${i + 1}: ${s.title}`}
                                    aria-current={i === index}
                                    className={`h-2 rounded-full transition-all ${i === index ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/80"}`}
                                />
                            ))}
                        </div>
                        <button type="button" onClick={() => go(index + 1)} className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center" aria-label="เรื่องถัดไป"><ChevronRight className="w-5 h-5" /></button>
                        {!reduced && (
                            <button type="button" onClick={() => setPaused(!paused)} className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center" aria-label={paused ? "เล่นสไลด์อัตโนมัติ" : "หยุดสไลด์อัตโนมัติ"}>
                                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
