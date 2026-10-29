"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, Plus } from "lucide-react";
import { useToast } from "@/components/Toast";
import CoinHistory, { Purchase, SupportSent, Topup } from "@/components/profile/CoinHistory";

interface CoinsData { coins: number; topups: Topup[]; purchases: Purchase[]; supports: SupportSent[] }

// "กระเป๋าเหรียญ" tab on your own profile: balance and history from /api/coins. Topping up stays on /coins.
export default function WalletTab() {
    const toast = useToast();
    const [data, setData] = useState<CoinsData | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/coins", { credentials: "include" });
                const json = await res.json().catch(() => ({}));
                if (cancelled) return;
                if (res.ok) setData({ coins: json.coins, topups: json.topups, purchases: json.purchases, supports: json.supports ?? [] });
                else {
                    toast.error(json.error || "โหลดข้อมูลเหรียญไม่สำเร็จ");
                    setData({ coins: 0, topups: [], purchases: [], supports: [] });
                }
            } catch {
                if (!cancelled) toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
            }
        })();
        return () => { cancelled = true; };
    }, [toast]);

    if (!data) return <p className="p-10 text-center text-gray-500 dark:text-gray-400">กำลังโหลด...</p>;

    return (
        <div className="p-4 space-y-6">
            <div className="rounded-2xl bg-gradient-to-r from-amber-700 to-orange-700 p-5 sm:p-6 text-white flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-sm opacity-90">เหรียญคงเหลือ</p>
                    <p className="text-3xl sm:text-4xl font-bold mt-1 flex items-center gap-2"><Coins className="w-7 h-7" /> {data.coins.toLocaleString()}</p>
                    <p className="text-xs opacity-90 mt-1">1 เหรียญ = 1 บาท</p>
                </div>
                <Link href="/coins" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-amber-900 font-semibold text-sm hover:bg-amber-50">
                    <Plus className="w-4 h-4" /> เติมเหรียญ
                </Link>
            </div>
            <CoinHistory topups={data.topups} purchases={data.purchases} supports={data.supports} bare />
        </div>
    );
}
