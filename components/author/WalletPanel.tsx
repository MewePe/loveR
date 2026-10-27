"use client";
import { useEffect, useState } from 'react';
import { baht, EarningsData } from './EarningsPanel';
import { useToast } from '@/components/Toast';

interface Withdrawal { id: string; amount: string; bank_name: string; bank_account_number: string; status: string; slip_image: string | null; rejection_reason: string | null; created_at: string; }

const statusText: Record<string, string> = { PENDING: 'รอโอน', APPROVED: 'โอนแล้ว', REJECTED: 'ถูกปฏิเสธ' };
const statusColors: Record<string, string> = {
    PENDING: 'text-yellow-700 dark:text-yellow-400',
    APPROVED: 'text-green-700 dark:text-green-400',
    REJECTED: 'text-red-600 dark:text-red-400',
};

export default function WalletPanel() {
    const toast = useToast();
    const [earnings, setEarnings] = useState<EarningsData | null>(null);
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [amount, setAmount] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        const [eRes, wRes] = await Promise.all([
            fetch('/api/author/earnings', { credentials: 'include' }),
            fetch('/api/author/withdrawals', { credentials: 'include' }),
        ]);
        if (eRes.ok) setEarnings(await eRes.json());
        if (wRes.ok) setWithdrawals(await wRes.json());
    }

    async function handleWithdraw(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/author/withdrawals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: Number(amount) }),
                credentials: 'include',
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('ส่งคำขอถอนเงินแล้ว แอดมินจะโอนเงินและแนบสลิปให้');
                setShowForm(false);
                setAmount('');
                fetchData();
            } else {
                toast.error(data.error || 'เกิดข้อผิดพลาด');
            }
        } finally {
            setSubmitting(false);
        }
    }

    const balance = earnings?.balance ?? 0;
    const minWithdrawal = earnings?.min_withdrawal ?? 100;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">กระเป๋าเงินนักเขียน</h1>

            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
                <p className="text-sm opacity-80">ยอดเงินที่ถอนได้</p>
                <p className="text-4xl font-bold mt-2">{baht(balance)}</p>
                {!showForm ? (
                    <button
                        onClick={() => setShowForm(true)}
                        disabled={balance < minWithdrawal}
                        className="mt-6 bg-white text-indigo-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition disabled:opacity-60"
                    >
                        ถอนเงิน
                    </button>
                ) : (
                    <form onSubmit={handleWithdraw} className="mt-6 flex flex-wrap items-center gap-2">
                        <input
                            type="number"
                            min={minWithdrawal}
                            max={balance}
                            step="0.01"
                            required
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={`ขั้นต่ำ ${minWithdrawal}`}
                            className="w-40 px-3 py-2 rounded-lg text-gray-900"
                        />
                        <button type="button" onClick={() => setAmount(String(balance))} className="px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30">ทั้งหมด</button>
                        <button type="submit" disabled={submitting} className="bg-white text-indigo-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-60">
                            {submitting ? 'กำลังส่ง...' : 'ยืนยัน'}
                        </button>
                        <button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 rounded-lg hover:bg-white/10">ยกเลิก</button>
                    </form>
                )}
                <p className="text-xs opacity-80 mt-3">ถอนขั้นต่ำ {minWithdrawal} บาท โอนเข้าบัญชีธนาคารในแท็บ &quot;ข้อมูลนักเขียน&quot;</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">ประวัติการถอนเงิน</h3>
                {withdrawals.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed dark:border-gray-700">
                        ยังไม่มีประวัติการถอนเงิน
                    </div>
                ) : (
                    <ul className="divide-y dark:divide-gray-700">
                        {withdrawals.map((w) => (
                            <li key={w.id} className="py-3 flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-300">
                                    {new Date(w.created_at).toLocaleString('th-TH')}
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">{w.bank_name} {w.bank_account_number}</span>
                                </span>
                                <span className="text-right">
                                    <span className="font-semibold text-gray-900 dark:text-white">{baht(w.amount)}</span>{' '}
                                    <span className={statusColors[w.status]}>{statusText[w.status]}</span>
                                    {w.slip_image && <a href={w.slip_image} target="_blank" rel="noreferrer" className="block text-xs text-indigo-600 dark:text-indigo-400 hover:underline">ดูสลิป</a>}
                                    {w.rejection_reason && <span className="block text-xs text-gray-500 dark:text-gray-400">{w.rejection_reason}</span>}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
