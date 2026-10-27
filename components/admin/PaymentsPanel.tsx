"use client";
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, XCircle, Upload } from 'lucide-react';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';

interface Topup { id: string; user_name: string; email: string; amount: number; slip_image: string; status: string; rejection_reason: string | null; created_at: string; }
interface Withdrawal { id: string; user_name: string; email: string; amount: string; bank_name: string; bank_account_number: string; bank_account_name: string; status: string; slip_image: string | null; rejection_reason: string | null; created_at: string; }

const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};
const statusText: Record<string, string> = { PENDING: 'รอตรวจสอบ', APPROVED: 'อนุมัติแล้ว', REJECTED: 'ปฏิเสธ' };

function StatusBadge({ status }: { status: string }) {
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status]}`}>{statusText[status]}</span>;
}

export default function PaymentsPanel() {
    const toast = useToast();
    const confirm = useConfirm();
    const [tab, setTab] = useState<'topups' | 'withdrawals'>('topups');
    const [topups, setTopups] = useState<Topup[]>([]);
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [busyId, setBusyId] = useState<string | null>(null);
    // Top-up or withdrawal being rejected: the reason form is open while this is set
    const [rejecting, setRejecting] = useState<{ kind: 'topup' | 'withdrawal'; id: string; reason: string; submitting: boolean } | null>(null);

    const fetchData = useCallback(async () => {
        const res = await fetch(tab === 'topups' ? '/api/admin/topups' : '/api/admin/withdrawals', { credentials: 'include' });
        if (!res.ok) return;
        if (tab === 'topups') setTopups(await res.json());
        else setWithdrawals(await res.json());
    }, [tab]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    async function patch(url: string, body: object) {
        const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || 'เกิดข้อผิดพลาด');
        }
        fetchData();
    }

    async function handleTopup(t: Topup, status: 'APPROVED' | 'REJECTED') {
        if (status === 'REJECTED') {
            setRejecting({ kind: 'topup', id: t.id, reason: '', submitting: false });
            return;
        }
        if (!(await confirm(`ยืนยันว่าได้รับเงิน ${t.amount} บาท จาก ${t.user_name} แล้ว?`))) return;
        setBusyId(t.id);
        await patch(`/api/admin/topups/${t.id}`, { status, reason: null });
        setBusyId(null);
    }

    async function approveWithdrawal(w: Withdrawal, file: File) {
        if (!(await confirm(`ยืนยันว่าโอนเงิน ${Number(w.amount).toFixed(2)} บาท ให้ ${w.bank_account_name} แล้ว?`))) return;
        setBusyId(w.id);
        try {
            const fd = new FormData();
            fd.append('status', 'APPROVED');
            fd.append('slip', file);
            const res = await fetch(`/api/admin/withdrawals/${w.id}`, { method: 'PATCH', body: fd, credentials: 'include' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || 'เกิดข้อผิดพลาด');
            }
            fetchData();
        } finally {
            setBusyId(null);
        }
    }

    async function submitRejection(r: NonNullable<typeof rejecting>) {
        setRejecting({ ...r, submitting: true });
        setBusyId(r.id);
        const url = r.kind === 'topup' ? `/api/admin/topups/${r.id}` : `/api/admin/withdrawals/${r.id}`;
        await patch(url, { status: 'REJECTED', reason: r.reason.trim() });
        setBusyId(null);
        setRejecting(null);
    }

    const th = 'px-6 py-3';
    const td = 'px-6 py-4 text-sm text-gray-500 dark:text-gray-400';

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">การเงิน</h1>
            <div className="flex gap-2">
                {(['topups', 'withdrawals'] as const).map((key) => (
                    <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 rounded-lg font-medium ${tab === key ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border dark:border-gray-700'}`}>
                        {key === 'topups' ? 'คำขอเติมเหรียญ' : 'คำขอถอนเงินนักเขียน'}
                    </button>
                ))}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-x-auto">
                {tab === 'topups' ? (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr><th className={th}>ผู้ใช้</th><th className={th}>จำนวน</th><th className={th}>สลิป</th><th className={th}>สถานะ</th><th className={th}>วันที่</th><th className={`${th} text-right`}>จัดการ</th></tr></thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {topups.map((t) => (
                                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4"><div className="font-medium text-gray-900 dark:text-white">{t.user_name}</div><div className="text-xs text-gray-500 dark:text-gray-400">{t.email}</div></td>
                                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{t.amount} บาท</td>
                                    <td className={td}><a href={t.slip_image} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">ดูสลิป</a></td>
                                    <td className={td}><StatusBadge status={t.status} />{t.rejection_reason && <div className="text-xs mt-1">{t.rejection_reason}</div>}</td>
                                    <td className={td}>{new Date(t.created_at).toLocaleString('th-TH')}</td>
                                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                                        {t.status === 'PENDING' && (<>
                                            <button disabled={busyId === t.id} onClick={() => handleTopup(t, 'APPROVED')} className="text-gray-500 dark:text-gray-400 hover:text-green-600 disabled:opacity-50" title="อนุมัติ"><CheckCircle className="w-5 h-5" /></button>
                                            <button disabled={busyId === t.id} onClick={() => handleTopup(t, 'REJECTED')} className="text-gray-500 dark:text-gray-400 hover:text-red-600 disabled:opacity-50" title="ปฏิเสธ"><XCircle className="w-5 h-5" /></button>
                                        </>)}
                                    </td>
                                </tr>
                            ))}
                            {topups.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">ยังไม่มีคำขอ</td></tr>}
                        </tbody>
                    </table>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr><th className={th}>นักเขียน</th><th className={th}>จำนวน</th><th className={th}>บัญชีปลายทาง</th><th className={th}>สถานะ</th><th className={th}>วันที่</th><th className={`${th} text-right`}>จัดการ</th></tr></thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {withdrawals.map((w) => (
                                <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4"><div className="font-medium text-gray-900 dark:text-white">{w.user_name}</div><div className="text-xs text-gray-500 dark:text-gray-400">{w.email}</div></td>
                                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{Number(w.amount).toFixed(2)} บาท</td>
                                    <td className={td}>{w.bank_name} {w.bank_account_number}<div className="text-xs">{w.bank_account_name}</div></td>
                                    <td className={td}>
                                        <StatusBadge status={w.status} />
                                        {w.slip_image && <div className="text-xs mt-1"><a href={w.slip_image} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">สลิปโอน</a></div>}
                                        {w.rejection_reason && <div className="text-xs mt-1">{w.rejection_reason}</div>}
                                    </td>
                                    <td className={td}>{new Date(w.created_at).toLocaleString('th-TH')}</td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                        {w.status === 'PENDING' && (
                                            <div className="flex items-center justify-end gap-2">
                                                <label className={`flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-700 text-white cursor-pointer hover:bg-green-800 ${busyId === w.id ? 'opacity-50 pointer-events-none' : ''}`} title="แนบสลิปโอนเงินเพื่ออนุมัติ">
                                                    <Upload className="w-4 h-4" /> โอนแล้ว (แนบสลิป)
                                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) approveWithdrawal(w, f); }} />
                                                </label>
                                                <button disabled={busyId === w.id} onClick={() => setRejecting({ kind: 'withdrawal', id: w.id, reason: '', submitting: false })} className="text-gray-500 dark:text-gray-400 hover:text-red-600 disabled:opacity-50" title="ปฏิเสธ"><XCircle className="w-5 h-5" /></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {withdrawals.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">ยังไม่มีคำขอ</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>

            {rejecting && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => !rejecting.submitting && setRejecting(null)}>
                    <form
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="payment-reject-title"
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={(e) => { e.preventDefault(); submitRejection(rejecting); }}
                    >
                        <h2 id="payment-reject-title" className="text-lg font-bold mb-1 text-gray-900 dark:text-white">
                            {rejecting.kind === 'topup' ? 'ปฏิเสธคำขอเติมเหรียญ' : 'ปฏิเสธคำขอถอนเงิน'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            {rejecting.kind === 'topup' ? 'เหตุผลจะแสดงให้ผู้เติมเหรียญเห็น' : 'ยอดเงินจะคืนเข้ายอดคงเหลือของนักเขียน และนักเขียนจะเห็นเหตุผลนี้'}
                        </p>
                        <textarea
                            autoFocus
                            rows={4}
                            maxLength={500}
                            value={rejecting.reason}
                            onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Escape' && !rejecting.submitting) setRejecting(null); }}
                            placeholder={rejecting.kind === 'topup' ? 'เช่น ยอดในสลิปไม่ตรงกับที่แจ้ง (ไม่บังคับ)' : 'เช่น ชื่อบัญชีไม่ตรงกับชื่อนักเขียน (ไม่บังคับ)'}
                            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button type="button" disabled={rejecting.submitting} onClick={() => setRejecting(null)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50">ยกเลิก</button>
                            <button type="submit" disabled={rejecting.submitting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">{rejecting.submitting ? 'กำลังบันทึก...' : 'ปฏิเสธ'}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
