"use client";

import { useCallback, useEffect, useState } from "react";
import TimeSeriesChart, { ChartRange, RangeToggle, SERIES_COLORS } from "@/components/TimeSeriesChart";

interface AnalyticsData {
    totals: { topup_amount: number; sales_amount: number; platform_amount: number; pending_topups: number };
    series: { bucket: string; topup_amount: number; sales_amount: number; platform_amount: number; new_users: number }[];
}

// Time-series charts on the admin "ภาพรวม" tab (data from /api/admin/analytics; the stat cards are in DashboardPanel)
export default function AnalyticsPanel() {
    const [range, setRange] = useState<ChartRange>("30d");
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [failed, setFailed] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/analytics?range=${range}`, { credentials: "include" });
            if (!res.ok) throw new Error(String(res.status));
            setData(await res.json());
            setFailed(false);
        } catch (e) {
            console.error(e);
            setFailed(true);
        }
    }, [range]);

    useEffect(() => { load(); }, [load]);

    if (failed) return <p className="text-red-500 dark:text-red-400">โหลดข้อมูลกราฟไม่สำเร็จ</p>;
    if (!data) return <div className="h-40 flex items-center justify-center text-gray-500 dark:text-gray-400">กำลังโหลด...</div>;

    const card = "bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700";

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">แนวโน้ม</h2>
                <RangeToggle value={range} onChange={setRange} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className={card}>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-4">เติมเหรียญและยอดขาย ({range === "30d" ? "รายวัน" : "รายเดือน"})</h3>
                    <TimeSeriesChart
                        data={data.series}
                        kind="line"
                        unit="บาท"
                        series={[
                            { key: "topup_amount", label: "เติมเหรียญ", color: SERIES_COLORS.indigo },
                            { key: "sales_amount", label: "ยอดใช้เหรียญ", color: SERIES_COLORS.pink },
                        ]}
                    />
                </div>
                <div className={card}>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-4">ผู้ใช้ใหม่ ({range === "30d" ? "รายวัน" : "รายเดือน"})</h3>
                    <TimeSeriesChart
                        data={data.series}
                        unit="คน"
                        series={[{ key: "new_users", label: "ผู้ใช้ใหม่", color: SERIES_COLORS.indigo }]}
                    />
                </div>
            </div>
        </div>
    );
}
