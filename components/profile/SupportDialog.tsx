"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Coins, HeartHandshake, X } from 'lucide-react';
import { useToast } from '@/components/Toast';

// Same limits as SUPPORT_MIN / SUPPORT_MAX / SUPPORT_MESSAGE_MAX in lib/coins.ts (the API enforces them;
// that module uses the database so it can't be imported here)
const MIN = 1;
const MAX = 10000;
const MESSAGE_MAX = 200;
const PRESETS = [10, 30, 50, 100, 500];

// "สนับสนุน" dialog: pick or type an amount of coins and an optional short message
export default function SupportDialog({ authorId, authorName, onClose, onSent }: {
    authorId: string; authorName: string; onClose: () => void; onSent: () => void;
}) {
    const toast = useToast();
    const [amount, setAmount] = useState<number | ''>(PRESETS[1]);
    const [message, setMessage] = useState('');
    const [balance, setBalance] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        fetch('/api/profile', { credentials: 'include' })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => setBalance(data?.user?.coins ?? null))
            .catch(() => setBalance(null));
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, sending]);

    const valid = typeof amount === 'number' && Number.isInteger(amount) && amount >= MIN && amount <= MAX;
    const notEnough = valid && balance !== null && amount > balance;

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!valid) return;
        setSending(true);
        setError(null);
        try {
            const res = await fetch(`/api/authors/${authorId}/support`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, message }),
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error || 'ส่งไม่สำเร็จ');
                return;
            }
            toast.success(`ส่ง ${amount.toLocaleString()} เหรียญให้ ${authorName} แล้ว ขอบคุณที่สนับสนุน!`);
            onSent();
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => !sending && onClose()}>
            <form
                role="dialog"
                aria-modal="true"
                aria-labelledby="support-title"
                onSubmit={submit}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto"
            >
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <h2 id="support-title" className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <HeartHandshake className="w-5 h-5 text-pink-600 dark:text-pink-400" /> สนับสนุน {authorName}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">เหรียญจะเข้าเป็นรายได้ของนักเขียนตามส่วนแบ่งของเว็บ</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={sending} aria-label="ปิด" className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">จำนวนเหรียญ</p>
                <div className="grid grid-cols-5 gap-2 mb-3">
                    {PRESETS.map((p) => (
                        <button
                            key={p}
                            type="button"
                            aria-pressed={amount === p}
                            onClick={() => setAmount(p)}
                            className={`py-2 rounded-lg border text-sm font-semibold transition ${amount === p
                                ? 'bg-amber-400 border-amber-400 text-amber-950'
                                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-4">
                    หรือระบุเอง ({MIN}-{MAX.toLocaleString()})
                    <input
                        type="number"
                        inputMode="numeric"
                        min={MIN}
                        max={MAX}
                        step={1}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="mt-1 w-full px-3 py-2 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                    />
                </label>

                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    ข้อความถึงนักเขียน (ไม่บังคับ)
                    <textarea
                        rows={3}
                        maxLength={MESSAGE_MAX}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="เช่น ชอบเรื่องนี้มาก รอตอนต่อไปนะคะ"
                        className="mt-1 w-full px-3 py-2 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white font-normal"
                    />
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-right mt-1">{message.length}/{MESSAGE_MAX}</p>

                <p className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 mt-3">
                    <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    เหรียญของคุณ: <span className="font-semibold">{balance === null ? '...' : balance.toLocaleString()}</span>
                    {notEnough && <Link href="/coins" className="ml-auto text-indigo-700 dark:text-indigo-400 hover:underline">เติมเหรียญ</Link>}
                </p>
                {!valid && amount !== '' && <p className="text-sm text-red-700 dark:text-red-400 mt-2">จำนวนเหรียญต้องเป็นจำนวนเต็ม {MIN}-{MAX.toLocaleString()}</p>}
                {notEnough && <p className="text-sm text-red-700 dark:text-red-400 mt-2">เหรียญไม่พอ</p>}
                {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400 mt-2">{error}</p>}

                <button
                    type="submit"
                    disabled={!valid || notEnough || sending}
                    className="mt-5 w-full py-3 rounded-lg bg-pink-600 text-white font-bold hover:bg-pink-700 transition disabled:opacity-50"
                >
                    {sending ? 'กำลังส่ง...' : `ส่ง ${valid ? amount.toLocaleString() : ''} เหรียญ`}
                </button>
            </form>
        </div>
    );
}
