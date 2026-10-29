"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Coins, Upload, Send } from 'lucide-react';
import { useToast } from '@/components/Toast';
import CoinHistory, { Purchase, SupportSent, Topup } from '@/components/profile/CoinHistory';

const PRESET_AMOUNTS = [50, 100, 300, 500, 1000];

export default function CoinsPage() {
    const toast = useToast();
    const { status } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [coins, setCoins] = useState(0);
    const [paymentInfo, setPaymentInfo] = useState('');
    const [topups, setTopups] = useState<Topup[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [supports, setSupports] = useState<SupportSent[]>([]);
    const [amount, setAmount] = useState(100);
    const [slip, setSlip] = useState<File | null>(null);
    const [slipPreview, setSlipPreview] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
        else if (status === 'authenticated') fetchData();
    }, [status, router]);

    async function fetchData() {
        try {
            const res = await fetch('/api/coins', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setCoins(data.coins);
                setPaymentInfo(data.payment_info);
                setTopups(data.topups);
                setPurchases(data.purchases);
                setSupports(data.supports ?? []);
            }
        } finally {
            setLoading(false);
        }
    }

    function handleSlipChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            setSlip(file);
            setSlipPreview(URL.createObjectURL(file));
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!slip) {
            toast.error('กรุณาแนบสลิปการโอนเงิน');
            return;
        }
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('amount', String(amount));
            fd.append('slip', slip);
            const res = await fetch('/api/coins/topup', { method: 'POST', body: fd, credentials: 'include' });
            const data = await res.json();
            if (res.ok) {
                toast.success('ส่งคำขอเติมเหรียญแล้ว เหรียญจะเข้าบัญชีเมื่อแอดมินตรวจสอบสลิปเรียบร้อย');
                setSlip(null);
                setSlipPreview(null);
                fetchData();
            } else {
                toast.error(data.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error(error);
            toast.error('เกิดข้อผิดพลาด');
        } finally {
            setSubmitting(false);
        }
    }

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10">
            <div className="container mx-auto px-4 max-w-3xl space-y-6">
                <div className="bg-gradient-to-r from-amber-700 to-orange-700 rounded-2xl p-8 text-white">
                    <p className="text-sm opacity-90">เหรียญคงเหลือ</p>
                    <p className="text-4xl font-bold mt-2 flex items-center gap-2"><Coins className="w-8 h-8" /> {coins.toLocaleString()}</p>
                    <p className="text-xs opacity-80 mt-2">1 เหรียญ = 1 บาท ใช้ปลดล็อกตอนพิเศษของนิยายและการ์ตูน</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 space-y-5">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">เติมเหรียญ</h2>

                    <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">1. เลือกจำนวน</p>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {PRESET_AMOUNTS.map((a) => (
                                <button type="button" key={a} onClick={() => setAmount(a)} className={`px-4 py-2 rounded-lg border font-medium ${amount === a ? 'bg-amber-400 border-amber-400 text-amber-950' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
                                    {a} บาท
                                </button>
                            ))}
                        </div>
                        <input type="number" min={20} max={50000} step={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-40 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" /> <span className="text-sm text-gray-500 dark:text-gray-400">บาท = {amount || 0} เหรียญ</span>
                    </div>

                    <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">2. โอนเงินมาที่</p>
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 text-gray-800 dark:text-gray-200 whitespace-pre-line">
                            {paymentInfo || 'แอดมินยังไม่ได้ตั้งค่าข้อมูลการชำระเงิน'}
                        </div>
                    </div>

                    <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">3. แนบสลิป</p>
                        <label className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 flex flex-col items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            {slipPreview ? (
                                <img src={slipPreview} alt="สลิป" className="max-h-60 rounded-lg" />
                            ) : (
                                <><Upload className="w-10 h-10 text-gray-500 dark:text-gray-400 mb-2" /><span className="text-gray-600 dark:text-gray-300">คลิกเพื่อเลือกรูปสลิป</span></>
                            )}
                            <input type="file" accept="image/*" onChange={handleSlipChange} className="hidden" />
                        </label>
                    </div>

                    <button type="submit" disabled={submitting || !paymentInfo} className="w-full bg-amber-400 text-amber-950 py-3 rounded-lg font-medium hover:bg-amber-500 transition flex items-center justify-center gap-2 disabled:opacity-50">
                        <Send className="w-5 h-5" />
                        {submitting ? 'กำลังส่ง...' : 'ส่งคำขอเติมเหรียญ'}
                    </button>
                </form>

                <CoinHistory topups={topups} purchases={purchases} supports={supports} />
            </div>
        </div>
    );
}
