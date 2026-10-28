"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Ban, BookOpen, CheckCircle, EyeOff, FileText, Search } from "lucide-react";
import AuthorLink from "@/components/AuthorLink";
import { ActionButton, Badge, EmptyRow, Modal, PageHeader, Pagination, ReasonDialog, StatusBadge, SubTabs, card, fetchJson, fmtDate, fmtDateTime, input, qs, rowHover, sendJson, td, th, thead } from "@/components/admin/ui";
import { PanelProps } from "@/components/admin/types";
import { CONTENT_STATUS_LABEL } from "@/lib/adminActions";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

type ContentType = "novels" | "comics";
interface Story {
    id: string; title: string; status: string; is_completed: boolean; views: number; created_at: string; updated_at: string;
    author_id: string | null; author_name: string | null; author_username: string | null;
    item_count: number; sales: number; revenue: number; rating_avg: number | null; rating_count: number;
    comments: number; bookmarks: number; pending_reports: number; categories: { id: string; name: string; slug: string }[];
}
interface StoryList { items: Story[]; total: number; page: number; pageSize: number; }
interface Category { id: string; name: string; }

// เนื้อหา tab: every novel/comic in any status, with search, filters, per-story stats and hide/ban/publish
export default function ContentPanel({ params, navigate }: PanelProps) {
    const toast = useToast();
    const confirm = useConfirm();
    const [type, setType] = useState<ContentType>(params.get("type") === "comics" ? "comics" : "novels");
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const [data, setData] = useState<StoryList | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [stats, setStats] = useState<Story | null>(null);
    const [moderating, setModerating] = useState<{ story: Story; status: "ARCHIVED" | "BANNED" } | null>(null);

    useEffect(() => {
        fetchJson<Category[]>("/api/categories").then((c) => c && setCategories(c));
    }, []);
    useEffect(() => {
        const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const load = useCallback(async () => {
        setData(await fetchJson<StoryList>(`/api/admin/content?${qs({ type, search: query, categoryId, status, page })}`, toast.error));
    }, [type, query, categoryId, status, page, toast.error]);
    useEffect(() => { load(); }, [load]);

    async function setStoryStatus(story: Story, next: string, reason?: string) {
        const res = await sendJson(`/api/admin/content/${story.id}`, "PATCH", { type, status: next, reason }, toast.error);
        if (!res) return false;
        toast.success(`เปลี่ยนสถานะเป็น "${CONTENT_STATUS_LABEL[next]}" แล้ว`);
        setStats(null);
        await load();
        return true;
    }

    async function publish(story: Story) {
        if (!(await confirm(`เผยแพร่ "${story.title}" ให้ทุกคนเห็น?`))) return;
        await setStoryStatus(story, "PUBLISHED");
    }

    const kindLabel = type === "novels" ? "นิยาย" : "การ์ตูน";

    function actions(s: Story) {
        return (
            <div className="flex justify-end gap-2 flex-wrap">
                <ActionButton icon={BarChart3} label="สถิติ" title="ดูสถิติของเรื่องนี้" onClick={() => setStats(s)} />
                {s.status !== "PUBLISHED" && <ActionButton icon={CheckCircle} label={s.status === "BANNED" ? "ปลดแบนและเผยแพร่" : "เผยแพร่"} tone="green" onClick={() => publish(s)} />}
                {s.status !== "ARCHIVED" && s.status !== "BANNED" && <ActionButton icon={EyeOff} label="ซ่อน" title="ซ่อนจากหน้ารายการ (คนที่ซื้อแล้วยังอ่านได้)" onClick={() => setModerating({ story: s, status: "ARCHIVED" })} />}
                {s.status !== "BANNED" && <ActionButton icon={Ban} label="แบน" tone="red" title="ระงับเรื่องนี้ ไม่มีใครอ่านได้ และนักเขียนแก้สถานะเองไม่ได้" onClick={() => setModerating({ story: s, status: "BANNED" })} />}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader title="จัดการเนื้อหา" subtitle="ค้นหา ดูสถิติ ซ่อน หรือแบนนิยายและการ์ตูนทุกสถานะ" />
            <SubTabs<ContentType>
                tabs={[{ key: "novels", label: "นิยาย" }, { key: "comics", label: "การ์ตูน" }]}
                value={type}
                onChange={(t) => { setType(t); setPage(1); setData(null); }}
            />
            <div className={`${card} overflow-hidden`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col lg:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 w-5 h-5" />
                        <input type="search" aria-label={`ค้นหา${kindLabel}`} placeholder="ค้นหาชื่อเรื่องหรือชื่อผู้เขียน..." className={`w-full pl-10 ${input}`} value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <div className="flex gap-3">
                        <select aria-label="กรองตามหมวดหมู่" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className={`flex-1 min-w-0 ${input}`}>
                            <option value="">ทุกหมวดหมู่</option>
                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select aria-label="กรองตามสถานะ" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={`flex-1 min-w-0 ${input}`}>
                            <option value="">ทุกสถานะ</option>
                            <option value="published">เผยแพร่</option>
                            <option value="hidden">ซ่อน / ฉบับร่าง</option>
                            <option value="banned">ถูกแบน</option>
                        </select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className={thead}><tr><th className={th}>ชื่อเรื่อง</th><th className={th}>ผู้เขียน</th><th className={th}>สถานะ</th><th className={`${th} text-right`}>{type === "novels" ? "บท" : "ตอน"}</th><th className={`${th} text-right`}>วิว</th><th className={th}>สร้างเมื่อ</th><th className={`${th} text-right`}>จัดการ</th></tr></thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {data?.items.map((s) => (
                                <tr key={s.id} className={rowHover}>
                                    <td className="px-4 py-3 min-w-48">
                                        <Link href={`/${type === "novels" ? "novel" : "comic"}/${s.id}`} target="_blank" className="font-medium text-gray-900 dark:text-white hover:underline">{s.title}</Link>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {s.categories.slice(0, 3).map((c) => <Badge key={c.id} tone="indigo">{c.name}</Badge>)}
                                            {s.pending_reports > 0 && <Badge tone="red">ถูกรายงาน {s.pending_reports}</Badge>}
                                        </div>
                                    </td>
                                    <td className={td}>
                                        <AuthorLink id={s.author_id} username={s.author_username} name={s.author_name} fallback="ไม่ทราบชื่อ" />
                                        {s.author_id && <button onClick={() => navigate("users", { user: s.author_id! })} className="block text-xs text-indigo-700 dark:text-indigo-400 hover:underline">ดูบัญชี</button>}
                                    </td>
                                    <td className={td}><StatusBadge status={s.status} /></td>
                                    <td className={`${td} text-right`}>{s.item_count}</td>
                                    <td className={`${td} text-right tabular-nums`}>{s.views.toLocaleString("th-TH")}</td>
                                    <td className={`${td} whitespace-nowrap`}>{fmtDate(s.created_at)}</td>
                                    <td className="px-4 py-3">{actions(s)}</td>
                                </tr>
                            ))}
                            {data && data.items.length === 0 && <EmptyRow colSpan={7} text={`ไม่พบ${kindLabel}`} />}
                            {!data && <EmptyRow colSpan={7} text="กำลังโหลด..." />}
                        </tbody>
                    </table>
                </div>
                {data && <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onChange={setPage} />}
            </div>

            {stats && (
                <Modal title={stats.title} onClose={() => setStats(null)} wide labelId="story-stats-title">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <StatusBadge status={stats.status} />
                        {stats.is_completed && <Badge tone="blue">จบแล้ว</Badge>}
                        {type === "novels" ? <BookOpen className="w-4 h-4 text-gray-500 dark:text-gray-400" /> : <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
                        <span className="text-sm text-gray-500 dark:text-gray-400">{kindLabel} · โดย {stats.author_name ?? "ไม่ทราบชื่อ"} · แก้ไขล่าสุด {fmtDateTime(stats.updated_at)}</span>
                    </div>
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                        {[
                            [type === "novels" ? "จำนวนบท" : "จำนวนตอน", stats.item_count.toLocaleString("th-TH")],
                            ["ยอดวิว", stats.views.toLocaleString("th-TH")],
                            ["ขายได้", `${stats.sales.toLocaleString("th-TH")} ครั้ง`],
                            ["ยอดขาย", `${stats.revenue.toLocaleString("th-TH")} เหรียญ`],
                            ["คะแนน", stats.rating_avg === null ? "-" : `${stats.rating_avg} (${stats.rating_count} คน)`],
                            ["คอมเมนต์", stats.comments.toLocaleString("th-TH")],
                            ["บุ๊กมาร์ก", stats.bookmarks.toLocaleString("th-TH")],
                            ["รายงานรอตรวจ", stats.pending_reports.toLocaleString("th-TH")],
                        ].map(([label, value]) => (
                            <div key={label} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                                <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
                                <dd className="text-lg font-bold text-gray-900 dark:text-white">{value}</dd>
                            </div>
                        ))}
                    </dl>
                    {stats.categories.length > 0 && <div className="flex flex-wrap gap-1 mb-5">{stats.categories.map((c) => <Badge key={c.id} tone="indigo">{c.name}</Badge>)}</div>}
                    {actions(stats)}
                </Modal>
            )}

            {moderating && (
                <ReasonDialog
                    title={moderating.status === "BANNED" ? `แบน "${moderating.story.title}"` : `ซ่อน "${moderating.story.title}"`}
                    description={moderating.status === "BANNED"
                        ? "ไม่มีใครอ่านเรื่องนี้ได้ (รวมคนที่ซื้อแล้ว) และนักเขียนเปลี่ยนสถานะเองไม่ได้ นักเขียนจะได้รับแจ้งเตือนพร้อมเหตุผล"
                        : "เรื่องจะหายจากหน้ารายการและการค้นหา คนที่ซื้อตอนไปแล้วยังอ่านตอนนั้นได้ นักเขียนจะได้รับแจ้งเตือนพร้อมเหตุผล"}
                    placeholder={moderating.status === "BANNED" ? "เช่น มีเนื้อหาละเมิดลิขสิทธิ์" : "เช่น ปกไม่เหมาะสม กรุณาแก้ไขก่อนเผยแพร่อีกครั้ง"}
                    confirmText={moderating.status === "BANNED" ? "ยืนยันแบน" : "ยืนยันซ่อน"}
                    onClose={() => setModerating(null)}
                    onSubmit={(reason) => setStoryStatus(moderating.story, moderating.status, reason)}
                />
            )}
        </div>
    );
}
