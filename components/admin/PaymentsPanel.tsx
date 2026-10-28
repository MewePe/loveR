"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, Search, Upload, XCircle } from "lucide-react";
import { ActionButton, DateRange, EmptyRow, ImageLightbox, PageHeader, Pagination, ReasonDialog, StatusBadge, SubTabs, baht, card, fetchJson, fmtDateTime, input, qs, rowHover, sendJson, td, th, thead } from "@/components/admin/ui";
import { PanelProps } from "@/components/admin/types";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

interface Topup { id: string; user_id: string; user_name: string; email: string; amount: number; slip_image: string; status: string; rejection_reason: string | null; created_at: string; }
interface Withdrawal { id: string; user_id: string; user_name: string; email: string; amount: string; bank_name: string; bank_account_number: string; bank_account_name: string; status: string; slip_image: string | null; rejection_reason: string | null; created_at: string; }
interface Transaction { kind: string; id: string; user_id: string | null; user_name: string | null; amount: number; status: string; detail: string | null; counterparty: string | null; slip_image: string | null; created_at: string; }
interface TransactionList { items: Transaction[]; total: number; page: number; pageSize: number; sums: Record<string, number>; }

type View = "topups" | "withdrawals" | "history";
const KIND_LABEL: Record<string, string> = { TOPUP: "เติมเหรียญ", PURCHASE: "ซื้อตอน", SUPPORT: "สนับสนุนนักเขียน", WITHDRAWAL: "ถอนเงินนักเขียน", ADJUSTMENT: "แอดมินปรับเหรียญ" };
const KIND_UNIT: Record<string, string> = { TOPUP: "บาท", PURCHASE: "เหรียญ", SUPPORT: "เหรียญ", WITHDRAWAL: "บาท", ADJUSTMENT: "เหรียญ" };

function StatusSelect({ value, onChange, withCompleted }: { value: string; onChange: (v: string) => void; withCompleted?: boolean }) {
    return (
        <select aria-label="กรองตามสถานะ" value={value} onChange={(e) => onChange(e.target.value)} className={input}>
            <option value="">ทุกสถานะ</option>
            <option value="PENDING">รอตรวจสอบ</option>
            <option value="APPROVED">อนุมัติแล้ว</option>
            <option value="REJECTED">ปฏิเสธ</option>
            {withCompleted && <option value="COMPLETED">สำเร็จ</option>}
        </select>
    );
}

// การเงิน tab: top-up slips, author withdrawals and every money movement. ?view= picks the sub-tab.
export default function PaymentsPanel({ params, navigate, counts, refreshCounts }: PanelProps) {
    const toast = useToast();
    const confirm = useConfirm();
    const view: View = params.get("view") === "withdrawals" ? "withdrawals" : params.get("view") === "history" ? "history" : "topups";
    const [status, setStatus] = useState(view === "history" ? "" : "PENDING");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [kind, setKind] = useState("");
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [topups, setTopups] = useState<Topup[] | null>(null);
    const [withdrawals, setWithdrawals] = useState<Withdrawal[] | null>(null);
    const [history, setHistory] = useState<TransactionList | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [rejecting, setRejecting] = useState<{ kind: "topup" | "withdrawal"; id: string } | null>(null);
    const [slip, setSlip] = useState<{ src: string; alt: string } | null>(null);

    // Each sub-tab starts with its own default filters: app/admin/page.tsx remounts this panel per ?view=
    useEffect(() => {
        const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const load = useCallback(async () => {
        if (view === "topups") setTopups(await fetchJson<Topup[]>(`/api/admin/topups?${qs({ status, from, to })}`, toast.error));
        else if (view === "withdrawals") setWithdrawals(await fetchJson<Withdrawal[]>(`/api/admin/withdrawals?${qs({ status, from, to })}`, toast.error));
        else setHistory(await fetchJson<TransactionList>(`/api/admin/transactions?${qs({ type: kind, status, from, to, search: query, page })}`, toast.error));
    }, [view, status, from, to, kind, query, page, toast.error]);
    useEffect(() => { load(); }, [load]);

    async function after(ok: unknown, message: string) {
        if (ok) {
            toast.success(message);
            refreshCounts();
        }
        await load();
        return !!ok;
    }

    async function approveTopup(t: Topup) {
        if (!(await confirm(`ยืนยันว่าได้รับเงิน ${baht(t.amount)} บาท จาก ${t.user_name} แล้ว?\nผู้ใช้จะได้รับ ${baht(t.amount)} เหรียญทันที`))) return;
        setBusyId(t.id);
        await after(await sendJson(`/api/admin/topups/${t.id}`, "PATCH", { status: "APPROVED" }, toast.error), "อนุมัติการเติมเหรียญแล้ว");
        setBusyId(null);
    }

    async function approveWithdrawal(w: Withdrawal, file: File) {
        if (!(await confirm(`ยืนยันว่าโอนเงิน ${baht(w.amount)} บาท ให้ ${w.bank_account_name} แล้ว?\nสลิปที่แนบจะแสดงให้นักเขียนเห็น`))) return;
        setBusyId(w.id);
        const fd = new FormData();
        fd.append("status", "APPROVED");
        fd.append("slip", file);
        await after(await fetchJson(`/api/admin/withdrawals/${w.id}`, toast.error, { method: "PATCH", body: fd }), "บันทึกการโอนเงินแล้ว");
        setBusyId(null);
    }

    async function reject(r: NonNullable<typeof rejecting>, reason: string) {
        const url = r.kind === "topup" ? `/api/admin/topups/${r.id}` : `/api/admin/withdrawals/${r.id}`;
        return after(await sendJson(url, "PATCH", { status: "REJECTED", reason }, toast.error), "ปฏิเสธแล้ว");
    }

    const userCell = (name: string | null, email: string | null, userId: string | null) => (
        <td className="px-4 py-3 min-w-40">
            {userId ? <button onClick={() => navigate("users", { user: userId })} className="font-medium text-gray-900 dark:text-white hover:underline text-left">{name || "-"}</button> : <span className="font-medium text-gray-900 dark:text-white">{name || "-"}</span>}
            {email && <div className="text-xs text-gray-500 dark:text-gray-400 break-all">{email}</div>}
        </td>
    );
    const slipButton = (src: string | null, alt: string) => src
        ? <button onClick={() => setSlip({ src, alt })} className="text-indigo-700 dark:text-indigo-400 hover:underline whitespace-nowrap">ดูสลิป</button>
        : <span>-</span>;

    return (
        <div className="space-y-6">
            <PageHeader title="การเงิน" subtitle="ตรวจสลิปเติมเหรียญ โอนเงินให้นักเขียน และดูธุรกรรมทั้งหมด" />
            <SubTabs<View>
                tabs={[
                    { key: "topups", label: "สลิปรอตรวจ", count: counts?.topups },
                    { key: "withdrawals", label: "คำขอถอนเงิน", count: counts?.withdrawals },
                    { key: "history", label: "ประวัติธุรกรรมทั้งหมด" },
                ]}
                value={view}
                onChange={(v) => navigate("payments", { view: v })}
            />

            <div className={`${card} overflow-hidden`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col xl:flex-row xl:items-center gap-3">
                    {view === "history" && (
                        <div className="relative flex-1 min-w-48">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 w-5 h-5" />
                            <input type="search" aria-label="ค้นหาชื่อผู้ใช้" placeholder="ค้นหาชื่อผู้ใช้หรือนักเขียน..." className={`w-full pl-10 ${input}`} value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                    )}
                    <div className="flex flex-wrap gap-3">
                        {view === "history" && (
                            <select aria-label="กรองตามประเภท" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} className={input}>
                                <option value="">ทุกประเภท</option>
                                {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                            </select>
                        )}
                        <StatusSelect value={status} onChange={(v) => { setStatus(v); setPage(1); }} withCompleted={view === "history"} />
                    </div>
                    <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
                </div>

                <div className="overflow-x-auto">
                    {view === "topups" && (
                        <table className="w-full text-left">
                            <thead className={thead}><tr><th className={th}>ผู้ใช้</th><th className={`${th} text-right`}>จำนวน</th><th className={th}>สลิป</th><th className={th}>สถานะ</th><th className={th}>วันที่แจ้ง</th><th className={`${th} text-right`}>จัดการ</th></tr></thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {topups?.map((t) => (
                                    <tr key={t.id} className={rowHover}>
                                        {userCell(t.user_name, t.email, t.user_id)}
                                        <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">{baht(t.amount)} บาท</td>
                                        <td className={td}>
                                            <button onClick={() => setSlip({ src: t.slip_image, alt: `สลิปเติมเหรียญของ ${t.user_name}` })} className="block w-14 h-20 rounded border border-gray-200 dark:border-gray-700 overflow-hidden hover:ring-2 hover:ring-indigo-500" title="กดเพื่อขยายสลิป" aria-label={`ขยายสลิปของ ${t.user_name}`}>
                                                <img src={t.slip_image} alt="" className="w-full h-full object-cover" loading="lazy" />
                                            </button>
                                        </td>
                                        <td className={td}><StatusBadge status={t.status} />{t.rejection_reason && <div className="text-xs mt-1 whitespace-pre-line">{t.rejection_reason}</div>}</td>
                                        <td className={`${td} whitespace-nowrap`}>{fmtDateTime(t.created_at)}</td>
                                        <td className="px-4 py-3">
                                            {t.status === "PENDING" && (
                                                <div className="flex justify-end gap-2 flex-wrap">
                                                    <ActionButton icon={CheckCircle} label="อนุมัติ" tone="green" disabled={busyId === t.id} onClick={() => approveTopup(t)} title="ได้รับเงินแล้ว เพิ่มเหรียญให้ผู้ใช้" />
                                                    <ActionButton icon={XCircle} label="ปฏิเสธ" tone="red" disabled={busyId === t.id} onClick={() => setRejecting({ kind: "topup", id: t.id })} />
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {topups && topups.length === 0 && <EmptyRow colSpan={6} text={status === "PENDING" ? "ไม่มีสลิปรอตรวจ" : "ไม่พบรายการ"} />}
                                {!topups && <EmptyRow colSpan={6} text="กำลังโหลด..." />}
                            </tbody>
                        </table>
                    )}

                    {view === "withdrawals" && (
                        <table className="w-full text-left">
                            <thead className={thead}><tr><th className={th}>นักเขียน</th><th className={`${th} text-right`}>จำนวน</th><th className={th}>บัญชีปลายทาง</th><th className={th}>สถานะ</th><th className={th}>วันที่ขอ</th><th className={`${th} text-right`}>จัดการ</th></tr></thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {withdrawals?.map((w) => (
                                    <tr key={w.id} className={rowHover}>
                                        {userCell(w.user_name, w.email, w.user_id)}
                                        <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">{baht(w.amount)} บาท</td>
                                        <td className={`${td} min-w-40`}>{w.bank_name} {w.bank_account_number}<div className="text-xs">{w.bank_account_name}</div></td>
                                        <td className={td}>
                                            <StatusBadge status={w.status} />
                                            {w.slip_image && <div className="text-xs mt-1">{slipButton(w.slip_image, "สลิปโอนเงินถอน")}</div>}
                                            {w.rejection_reason && <div className="text-xs mt-1 whitespace-pre-line">{w.rejection_reason}</div>}
                                        </td>
                                        <td className={`${td} whitespace-nowrap`}>{fmtDateTime(w.created_at)}</td>
                                        <td className="px-4 py-3">
                                            {w.status === "PENDING" && (
                                                <div className="flex justify-end gap-2 flex-wrap">
                                                    <label className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-green-700 text-white cursor-pointer hover:bg-green-800 whitespace-nowrap focus-within:ring-2 focus-within:ring-green-500 ${busyId === w.id ? "opacity-50 pointer-events-none" : ""}`} title="แนบสลิปโอนเงินเพื่ออนุมัติ">
                                                        <Upload className="w-3.5 h-3.5" /> โอนแล้ว (แนบสลิป)
                                                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) approveWithdrawal(w, f); }} />
                                                    </label>
                                                    <ActionButton icon={XCircle} label="ปฏิเสธ" tone="red" disabled={busyId === w.id} onClick={() => setRejecting({ kind: "withdrawal", id: w.id })} />
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {withdrawals && withdrawals.length === 0 && <EmptyRow colSpan={6} text={status === "PENDING" ? "ไม่มีคำขอถอนเงินรอดำเนินการ" : "ไม่พบรายการ"} />}
                                {!withdrawals && <EmptyRow colSpan={6} text="กำลังโหลด..." />}
                            </tbody>
                        </table>
                    )}

                    {view === "history" && (<>
                        {history && Object.keys(history.sums).length > 0 && (
                            <div className="flex flex-wrap gap-2 p-4 border-b border-gray-200 dark:border-gray-700 text-sm">
                                {Object.entries(history.sums).map(([k, sum]) => (
                                    <span key={k} className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{KIND_LABEL[k] ?? k}: <b>{baht(sum)}</b> {KIND_UNIT[k]}</span>
                                ))}
                            </div>
                        )}
                        <table className="w-full text-left">
                            <thead className={thead}><tr><th className={th}>วันที่</th><th className={th}>ประเภท</th><th className={th}>ผู้ใช้</th><th className={`${th} text-right`}>จำนวน</th><th className={th}>สถานะ</th><th className={th}>รายละเอียด</th></tr></thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {history?.items.map((t) => (
                                    <tr key={`${t.kind}-${t.id}`} className={rowHover}>
                                        <td className={`${td} whitespace-nowrap`}>{fmtDateTime(t.created_at)}</td>
                                        <td className={`${td} whitespace-nowrap text-gray-900 dark:text-white`}>{KIND_LABEL[t.kind] ?? t.kind}</td>
                                        {userCell(t.user_name, null, t.user_id)}
                                        <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${t.amount < 0 ? "text-red-700 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>{t.amount > 0 && t.kind === "ADJUSTMENT" ? "+" : ""}{baht(t.amount)} {KIND_UNIT[t.kind]}</td>
                                        <td className={td}><StatusBadge status={t.status} /></td>
                                        <td className={`${td} min-w-48`}>
                                            {t.kind === "PURCHASE" && <>{t.detail ?? "(ตอนถูกลบ)"}{t.counterparty && <div className="text-xs">นักเขียน: {t.counterparty}</div>}</>}
                                            {t.kind === "SUPPORT" && <>ให้ {t.counterparty ?? "-"}{t.detail && <div className="text-xs whitespace-pre-line">&ldquo;{t.detail}&rdquo;</div>}</>}
                                            {t.kind === "ADJUSTMENT" && <><span className="whitespace-pre-line">{t.detail}</span>{t.counterparty && <div className="text-xs">โดย {t.counterparty}</div>}</>}
                                            {(t.kind === "TOPUP" || t.kind === "WITHDRAWAL") && <>{t.detail && <div className="whitespace-pre-line">{t.detail}</div>}{slipButton(t.slip_image, t.kind === "TOPUP" ? "สลิปเติมเหรียญ" : "สลิปโอนเงินถอน")}</>}
                                        </td>
                                    </tr>
                                ))}
                                {history && history.items.length === 0 && <EmptyRow colSpan={6} text="ไม่พบธุรกรรม" />}
                                {!history && <EmptyRow colSpan={6} text="กำลังโหลด..." />}
                            </tbody>
                        </table>
                    </>)}
                </div>
                {view === "history" && history && <Pagination page={history.page} total={history.total} pageSize={history.pageSize} onChange={setPage} />}
                {view !== "history" && <p className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">แสดงล่าสุดไม่เกิน 200 รายการ ใช้ตัวกรองวันที่เพื่อดูรายการเก่ากว่านั้น</p>}
            </div>

            {rejecting && (
                <ReasonDialog
                    title={rejecting.kind === "topup" ? "ปฏิเสธคำขอเติมเหรียญ" : "ปฏิเสธคำขอถอนเงิน"}
                    description={rejecting.kind === "topup" ? "เหตุผลจะแสดงให้ผู้เติมเหรียญเห็น" : "ยอดเงินจะคืนเข้ายอดคงเหลือของนักเขียน และนักเขียนจะเห็นเหตุผลนี้"}
                    placeholder={rejecting.kind === "topup" ? "เช่น ยอดในสลิปไม่ตรงกับที่แจ้ง" : "เช่น ชื่อบัญชีไม่ตรงกับชื่อนักเขียน"}
                    required={false}
                    confirmText="ปฏิเสธ"
                    onClose={() => setRejecting(null)}
                    onSubmit={(reason) => reject(rejecting, reason)}
                />
            )}
            {slip && <ImageLightbox src={slip.src} alt={slip.alt} onClose={() => setSlip(null)} />}
        </div>
    );
}
