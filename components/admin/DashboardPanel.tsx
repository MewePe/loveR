"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BookOpen, ChevronRight, Coins, Eye, FileText, Flag, Landmark, PenTool, ShieldCheck, ShoppingCart, UserPlus, Users, Wallet } from "lucide-react";
import AnalyticsPanel from "@/components/admin/AnalyticsPanel";
import { Badge, CountBadge, PageHeader, StatusBadge, baht, card, fetchJson, fmtDateTime } from "@/components/admin/ui";
import { PanelProps, TabType } from "@/components/admin/types";

interface Overview {
    users: number; new_users_today: number; authors: number; stories: number; novels: number; comics: number;
    topup_month: number; platform_revenue: number; platform_revenue_month: number;
    top_stories: { type: "novel" | "comic"; id: string; title: string; views: number; author_name: string | null; rating_avg: number | null; sales: number }[];
    activity: { kind: string; user_id: string | null; user_name: string | null; label: string | null; amount: number | null; status: string | null; created_at: string }[];
}

const REPORT_TARGET: Record<string, string> = { NOVEL: "นิยาย", COMIC: "การ์ตูน", COMMENT: "คอมเมนต์", USER: "ผู้ใช้" };

// One line of text, an icon and the tab to open for each recent activity kind
function describe(a: Overview["activity"][number]): { icon: typeof Users; color: string; text: string; tab: TabType; params?: Record<string, string> } {
    const who = a.user_name || "ผู้ใช้";
    switch (a.kind) {
        case "USER_REGISTER": return { icon: UserPlus, color: "text-blue-600 dark:text-blue-400", text: `${who} สมัครสมาชิก`, tab: "users", params: a.user_id ? { user: a.user_id } : undefined };
        case "NOVEL_CREATE": return { icon: BookOpen, color: "text-indigo-600 dark:text-indigo-400", text: `${who} สร้างนิยาย "${a.label}"`, tab: "content", params: { type: "novels" } };
        case "COMIC_CREATE": return { icon: FileText, color: "text-pink-600 dark:text-pink-400", text: `${who} สร้างการ์ตูน "${a.label}"`, tab: "content", params: { type: "comics" } };
        case "TOPUP": return { icon: Coins, color: "text-amber-600 dark:text-amber-400", text: `${who} แจ้งเติมเหรียญ ${baht(a.amount ?? 0)} บาท`, tab: "payments", params: { view: "topups" } };
        case "PURCHASE": return { icon: ShoppingCart, color: "text-green-700 dark:text-green-400", text: `${who} ซื้อ "${a.label}" ${a.amount} เหรียญ`, tab: "payments", params: { view: "history" } };
        case "WITHDRAWAL": return { icon: Wallet, color: "text-amber-600 dark:text-amber-400", text: `${who} ขอถอนเงิน ฿${baht(a.amount ?? 0)}`, tab: "payments", params: { view: "withdrawals" } };
        case "REPORT": return { icon: Flag, color: "text-red-600 dark:text-red-400", text: `${who} รายงาน${REPORT_TARGET[a.label ?? ""] ?? ""}`, tab: "reports" };
        default: return { icon: Users, color: "text-gray-500 dark:text-gray-400", text: who, tab: "dashboard" };
    }
}

export default function DashboardPanel({ navigate, counts }: PanelProps) {
    const [data, setData] = useState<Overview | null>(null);
    const [failed, setFailed] = useState(false);

    const load = useCallback(async () => {
        const res = await fetchJson<Overview>("/api/admin");
        setData(res);
        setFailed(!res);
    }, []);
    useEffect(() => { load(); }, [load]);

    const stats = data && [
        { label: "ผู้ใช้ทั้งหมด", value: data.users.toLocaleString("th-TH"), icon: Users, color: "text-blue-600 dark:text-blue-400" },
        { label: "ผู้ใช้ใหม่วันนี้", value: data.new_users_today.toLocaleString("th-TH"), icon: UserPlus, color: "text-indigo-600 dark:text-indigo-400" },
        { label: "นักเขียน", value: data.authors.toLocaleString("th-TH"), icon: PenTool, color: "text-purple-600 dark:text-purple-400" },
        { label: "เรื่องทั้งหมด", value: data.stories.toLocaleString("th-TH"), sub: `นิยาย ${data.novels} · การ์ตูน ${data.comics}`, icon: BookOpen, color: "text-pink-600 dark:text-pink-400" },
        { label: "ยอดเติมเหรียญเดือนนี้", value: `${baht(data.topup_month)} บาท`, sub: "เฉพาะที่อนุมัติแล้ว", icon: Coins, color: "text-amber-600 dark:text-amber-400" },
        { label: "รายได้แพลตฟอร์ม", value: `${baht(data.platform_revenue)} บาท`, sub: `เดือนนี้ ${baht(data.platform_revenue_month)} บาท`, icon: Landmark, color: "text-green-700 dark:text-green-400" },
    ];

    const pending: { label: string; count: number | undefined; tab: TabType; params?: Record<string, string>; icon: typeof Users }[] = [
        { label: "คำขอเป็นนักเขียน", count: counts?.writers, tab: "writers", icon: PenTool },
        { label: "สลิปรอตรวจ", count: counts?.topups, tab: "payments", params: { view: "topups" }, icon: Coins },
        { label: "คำขอถอนเงิน", count: counts?.withdrawals, tab: "payments", params: { view: "withdrawals" }, icon: Wallet },
        { label: "รายงาน", count: counts?.reports, tab: "reports", icon: AlertTriangle },
        { label: "คิวตรวจเนื้อหา", count: counts?.moderation, tab: "moderation", icon: ShieldCheck },
    ];
    const totalPending = pending.reduce((n, p) => n + (p.count ?? 0), 0);

    return (
        <div className="space-y-6">
            <PageHeader title="ภาพรวมระบบ" subtitle="สรุปตัวเลขสำคัญและงานที่ต้องทำ" />

            {failed && <p className="text-red-600 dark:text-red-400">โหลดข้อมูลภาพรวมไม่สำเร็จ</p>}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                {(stats ?? Array.from({ length: 6 }, () => null)).map((s, i) => (
                    <div key={s?.label ?? i} className={`${card} p-4`}>
                        {s ? (<>
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="text-sm text-gray-500 dark:text-gray-400 font-medium">{s.label}</h3>
                                <s.icon className={`w-5 h-5 flex-shrink-0 ${s.color}`} />
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white break-words">{s.value}</p>
                            {s.sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.sub}</p>}
                        </>) : <div className="h-16 animate-pulse bg-gray-100 dark:bg-gray-700 rounded" />}
                    </div>
                ))}
            </div>

            <section className={`${card} p-4 sm:p-5`} aria-labelledby="pending-title">
                <div className="flex items-center justify-between mb-3">
                    <h2 id="pending-title" className="text-lg font-bold text-gray-900 dark:text-white">งานที่รอดำเนินการ</h2>
                    {counts && totalPending === 0 && <Badge tone="green">ไม่มีงานค้าง</Badge>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {pending.map((p) => (
                        <button
                            key={p.label}
                            onClick={() => navigate(p.tab, p.params)}
                            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${p.count ? "border-red-200 bg-red-50 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-900/20 dark:hover:bg-red-900/30" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}
                        >
                            <p.icon className={`w-5 h-5 flex-shrink-0 ${p.count ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`} />
                            <span className="flex-1 min-w-0">
                                <span className="block text-sm font-medium text-gray-900 dark:text-white">{p.label}</span>
                                <span className="block text-xs text-gray-500 dark:text-gray-400">{counts ? (p.count ? `${p.count} รายการ` : "ไม่มี") : "..."}</span>
                            </span>
                            <CountBadge count={p.count} />
                            <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        </button>
                    ))}
                </div>
            </section>

            <AnalyticsPanel />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <section className={`${card} p-4 sm:p-5`} aria-labelledby="top-title">
                    <div className="flex items-center justify-between mb-3">
                        <h2 id="top-title" className="text-lg font-bold text-gray-900 dark:text-white">เรื่องยอดนิยม 5 อันดับ</h2>
                        <Link href="/ranking" className="text-sm text-indigo-700 dark:text-indigo-400 hover:underline">ดูอันดับทั้งหมด</Link>
                    </div>
                    <ol className="divide-y divide-gray-200 dark:divide-gray-700">
                        {data?.top_stories.map((s, i) => (
                            <li key={`${s.type}-${s.id}`} className="flex items-center gap-3 py-2.5">
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${i === 0 ? "bg-yellow-400 text-yellow-950" : i === 1 ? "bg-gray-300 text-gray-900" : i === 2 ? "bg-orange-300 text-orange-950" : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"}`}>{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <Link href={`/${s.type}/${s.id}`} className="block font-medium text-gray-900 dark:text-white hover:underline truncate">{s.title}</Link>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{s.type === "novel" ? "นิยาย" : "การ์ตูน"} · {s.author_name ?? "ไม่ทราบชื่อ"}</span>
                                </div>
                                <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap"><Eye className="w-4 h-4" />{s.views.toLocaleString("th-TH")}</span>
                            </li>
                        ))}
                        {data && data.top_stories.length === 0 && <li className="py-6 text-center text-gray-500 dark:text-gray-400">ยังไม่มีเรื่องที่เผยแพร่</li>}
                    </ol>
                </section>

                <section className={`${card} p-4 sm:p-5`} aria-labelledby="activity-title">
                    <h2 id="activity-title" className="text-lg font-bold text-gray-900 dark:text-white mb-3">กิจกรรมล่าสุด</h2>
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {data?.activity.map((a, i) => {
                            const d = describe(a);
                            return (
                                <li key={i}>
                                    <button onClick={() => navigate(d.tab, d.params)} className="w-full flex items-start gap-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg px-1">
                                        <d.icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${d.color}`} />
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-sm text-gray-900 dark:text-white break-words">{d.text}</span>
                                            <span className="block text-xs text-gray-500 dark:text-gray-400">{fmtDateTime(a.created_at)}</span>
                                        </span>
                                        {a.status && a.kind !== "NOVEL_CREATE" && a.kind !== "COMIC_CREATE" && <StatusBadge status={a.status} />}
                                    </button>
                                </li>
                            );
                        })}
                        {data && data.activity.length === 0 && <li className="py-6 text-center text-gray-500 dark:text-gray-400">ยังไม่มีกิจกรรม</li>}
                    </ul>
                </section>
            </div>
        </div>
    );
}
