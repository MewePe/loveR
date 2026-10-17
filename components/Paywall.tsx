"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Coins } from "lucide-react";

interface PaywallProps {
    kind: "chapter" | "episode";
    itemId: string;
    price: number;
    loggedIn: boolean;
}

export default function Paywall({ kind, itemId, price, loggedIn }: PaywallProps) {
    const router = useRouter();
    const [buying, setBuying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [needCoins, setNeedCoins] = useState(false);

    async function handleUnlock() {
        if (!loggedIn) {
            router.push("/login");
            return;
        }
        if (!confirm(`ใช้ ${price} เหรียญเพื่อปลดล็อก${kind === "chapter" ? "บท" : "ตอน"}นี้?`)) return;

        setBuying(true);
        setError(null);
        try {
            const res = await fetch("/api/purchases", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ kind, id: itemId }),
            });
            const data = await res.json();
            if (res.ok) {
                router.refresh();
            } else {
                setError(data.error || "เกิดข้อผิดพลาด");
                setNeedCoins(res.status === 402);
            }
        } catch (err) {
            console.error(err);
            setError("เกิดข้อผิดพลาด");
        } finally {
            setBuying(false);
        }
    }

    return (
        <div className="max-w-md mx-auto my-16 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border dark:border-gray-700 p-8 text-center font-sans">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{kind === "chapter" ? "บท" : "ตอน"}นี้ต้องปลดล็อก</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 flex items-center justify-center gap-1">
                ราคา <Coins className="w-4 h-4 text-amber-500" /> <span className="font-bold text-gray-900 dark:text-white">{price}</span> เหรียญ
            </p>
            <button
                onClick={handleUnlock}
                disabled={buying}
                className="w-full bg-amber-500 text-white py-3 rounded-lg font-bold hover:bg-amber-600 transition disabled:opacity-50"
            >
                {buying ? "กำลังปลดล็อก..." : loggedIn ? `ปลดล็อก ${price} เหรียญ` : "เข้าสู่ระบบเพื่อปลดล็อก"}
            </button>
            {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
            {(needCoins || loggedIn) && (
                <Link href="/coins" className="block text-sm text-indigo-600 hover:underline mt-4">
                    เติมเหรียญ
                </Link>
            )}
        </div>
    );
}
