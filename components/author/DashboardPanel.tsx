"use client";
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import TimeSeriesChart, { ChartRange, RangeToggle, SERIES_COLORS } from '@/components/TimeSeriesChart';
import { STATUS_LABEL, WORK_KINDS, WorkKind } from './types';

export interface AuthorStats { novels: number; comics: number; views: number; }

interface WorkStats {
    type: WorkKind; id: string; title: string; status: string; views: number; items: number; sales: number;
    earning: number; rating_avg: number | null; rating_count: number; comments: number; bookmarks: number;
}

interface AnalyticsData {
    series: { bucket: string; earning: number; sales: number }[];
    works: WorkStats[];
}

interface DashboardPanelProps {
    stats: AuthorStats;
    onCreateNovel: () => void;
}

const baht = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 2 });

// "ภาพรวมนักเขียน" tab: totals from /api/author/stats, plus the earnings chart and per-work stats
// from /api/author/analytics (loaded here)
export default function DashboardPanel({ stats, onCreateNovel }: DashboardPanelProps) {
    const [range, setRange] = useState<ChartRange>('30d');
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/author/analytics?range=${range}`, { credentials: 'include' });
            if (res.ok) setAnalytics(await res.json());
        } catch (e) {
            console.error(e);
        }
    }, [range]);

    useEffect(() => { load(); }, [load]);

    const rangeEarning = analytics?.series.reduce((sum, p) => sum + p.earning, 0) ?? 0;
    const card = 'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700';

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ภาพรวมนักเขียน</h1>
                    <p className="text-gray-500 dark:text-gray-400">ยินดีต้อนรับกลับมา!</p>
                </div>
                <button
                    onClick={onCreateNovel}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition shadow-sm flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    สร้างนิยายใหม่
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={card}>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">📚</div>
                        <div>
                            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">นิยายทั้งหมด</h3>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.novels}</p>
                        </div>
                    </div>
                </div>
                <div className={card}>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-lg">🎨</div>
                        <div>
                            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">การ์ตูนทั้งหมด</h3>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.comics}</p>
                        </div>
                    </div>
                </div>
                <div className={card}>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">👁️</div>
                        <div>
                            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">ยอดวิวทั้งหมด</h3>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.views?.toLocaleString() || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Earnings over time */}
            <div className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">รายได้ ({range === '30d' ? 'รายวัน' : 'รายเดือน'})</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            รวม {range === '30d' ? '30 วัน' : '12 เดือน'}: <span className="font-semibold text-gray-900 dark:text-white">{baht(rangeEarning)} บาท</span>
                        </p>
                    </div>
                    <RangeToggle value={range} onChange={setRange} />
                </div>
                {analytics ? (
                    <TimeSeriesChart data={analytics.series} unit="บาท" series={[{ key: 'earning', label: 'รายได้', color: SERIES_COLORS.indigo }]} />
                ) : (
                    <div className="h-64 flex items-center justify-center text-gray-400">กำลังโหลด...</div>
                )}
            </div>

            {/* Per-work stats */}
            <div className={card}>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">สถิติรายเรื่อง</h3>
                {!analytics ? (
                    <div className="py-8 text-center text-gray-400">กำลังโหลด...</div>
                ) : analytics.works.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed dark:border-gray-700">
                        ยังไม่มีผลงาน เริ่มเขียนกันเลย!
                    </div>
                ) : (
                    <div className="overflow-x-auto -mx-6 px-6">
                        <table className="w-full text-left text-sm min-w-[720px]">
                            <thead className="text-gray-500 dark:text-gray-400 text-xs border-b dark:border-gray-700">
                                <tr>
                                    <th className="py-2 pr-3">เรื่อง</th>
                                    <th className="py-2 px-3 text-right">ตอน</th>
                                    <th className="py-2 px-3 text-right">วิว</th>
                                    <th className="py-2 px-3 text-right">ขายได้</th>
                                    <th className="py-2 px-3 text-right">รายได้ (บาท)</th>
                                    <th className="py-2 px-3 text-right">คะแนน</th>
                                    <th className="py-2 px-3 text-right">คอมเมนต์</th>
                                    <th className="py-2 pl-3 text-right">บุ๊กมาร์ก</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700 text-gray-700 dark:text-gray-300">
                                {analytics.works.map((w) => (
                                    <tr key={`${w.type}-${w.id}`}>
                                        <td className="py-3 pr-3">
                                            <Link href={`/${w.type}/${w.id}`} className="font-medium text-gray-900 dark:text-white hover:underline">{w.title}</Link>
                                            <div className="text-xs text-gray-400 mt-0.5">{WORK_KINDS[w.type].label} · {STATUS_LABEL[w.status] ?? w.status}</div>
                                        </td>
                                        <td className="py-3 px-3 text-right tabular-nums">{w.items}</td>
                                        <td className="py-3 px-3 text-right tabular-nums">{w.views.toLocaleString()}</td>
                                        <td className="py-3 px-3 text-right tabular-nums">{w.sales.toLocaleString()}</td>
                                        <td className="py-3 px-3 text-right tabular-nums">{baht(w.earning)}</td>
                                        <td className="py-3 px-3 text-right tabular-nums">{w.rating_avg != null ? `⭐ ${w.rating_avg.toFixed(1)} (${w.rating_count})` : '-'}</td>
                                        <td className="py-3 px-3 text-right tabular-nums">{w.comments.toLocaleString()}</td>
                                        <td className="py-3 pl-3 text-right tabular-nums">{w.bookmarks.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
