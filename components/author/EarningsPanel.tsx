"use client";
import { useEffect, useState } from 'react';

interface Sale { id: string; item_title: string; price: number; author_earning: string; created_at: string; kind: 'chapter' | 'episode'; }
export interface EarningsData { share_percent: number; min_withdrawal: number; earned: number; withdrawn: number; balance: number; this_month: number; sales: Sale[]; }

export const baht = (n: number | string) => `฿${Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EarningsPanel() {
    const [data, setData] = useState<EarningsData | null>(null);

    useEffect(() => {
        fetch('/api/author/earnings', { credentials: 'include' })
            .then(res => res.ok ? res.json() : null)
            .then(setData)
            .catch(console.error);
    }, []);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">รายได้ของฉัน</h1>
            {data && <p className="text-sm text-gray-500 dark:text-gray-400">คุณได้รับ {data.share_percent}% ของราคาตอนที่ขายได้ (1 เหรียญ = 1 บาท)</p>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                    <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">รายได้เดือนนี้</h3>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{baht(data?.this_month ?? 0)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                    <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">รายได้ทั้งหมด</h3>
                    <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">{baht(data?.earned ?? 0)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                    <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">ถอนได้</h3>
                    <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-2">{baht(data?.balance ?? 0)}</p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">ประวัติรายได้</h3>
                {!data || data.sales.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed dark:border-gray-700">
                        ยังไม่มีข้อมูลรายได้
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="text-gray-500 dark:text-gray-400 text-xs uppercase"><tr><th className="py-2">ตอน</th><th className="py-2">ราคา</th><th className="py-2">รายได้</th><th className="py-2">วันที่</th></tr></thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {data.sales.map((s) => (
                                <tr key={s.id}>
                                    <td className="py-2 text-gray-900 dark:text-white">{s.item_title} <span className="text-xs text-gray-500 dark:text-gray-400">({s.kind === 'chapter' ? 'นิยาย' : 'การ์ตูน'})</span></td>
                                    <td className="py-2 text-gray-500 dark:text-gray-400">{s.price} เหรียญ</td>
                                    <td className="py-2 text-green-700 dark:text-green-400 font-medium">+{baht(s.author_earning)}</td>
                                    <td className="py-2 text-gray-500 dark:text-gray-400">{new Date(s.created_at).toLocaleString('th-TH')}</td>
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
