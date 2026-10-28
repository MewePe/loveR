"use client";

import { useCallback, useEffect, useState } from "react";
import { DateRange, EmptyRow, PageHeader, Pagination, card, fetchJson, fmtDateTime, input, qs, rowHover, td, th, thead } from "@/components/admin/ui";
import { PanelProps } from "@/components/admin/types";
import { ADMIN_ACTIONS } from "@/lib/adminActions";
import { useToast } from "@/components/Toast";

interface Log { id: string; admin_id: string | null; admin_name: string | null; action: string; target_type: string | null; target_id: string | null; target_label: string | null; detail: string | null; reason: string | null; created_at: string; }
interface LogList { logs: Log[]; total: number; page: number; pageSize: number; admins: { id: string; name: string | null }[]; }

const TARGET_LABEL: Record<string, string> = { USER: "ผู้ใช้", NOVEL: "นิยาย", COMIC: "การ์ตูน", COMMENT: "คอมเมนต์", REPORT: "รายงาน", TOPUP: "เติมเหรียญ", WITHDRAWAL: "ถอนเงิน", CATEGORY: "หมวดหมู่", SETTINGS: "ตั้งค่า" };

// ประวัติการทำงานของแอดมิน (admin_logs). ?target=<id> shows the entries about one user/story.
export default function AuditLogPanel({ params, navigate }: PanelProps) {
    const toast = useToast();
    const target = params.get("target") ?? "";
    const [action, setAction] = useState("");
    const [adminId, setAdminId] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [page, setPage] = useState(1);
    const [data, setData] = useState<LogList | null>(null);

    const load = useCallback(async () => {
        setData(await fetchJson<LogList>(`/api/admin/logs?${qs({ action, adminId, targetId: target, from, to, page })}`, toast.error));
    }, [action, adminId, target, from, to, page, toast.error]);
    useEffect(() => { load(); }, [load]);

    function targetCell(l: Log) {
        const label = l.target_label || (l.target_type === "SETTINGS" ? "ตั้งค่าระบบ" : "-");
        const kind = l.target_type ? TARGET_LABEL[l.target_type] ?? l.target_type : "";
        const inner = <><span className="text-xs text-gray-500 dark:text-gray-400">{kind}</span><span className="block text-gray-900 dark:text-white break-words">{label}</span></>;
        if (l.target_type === "USER" && l.target_id) return <button onClick={() => navigate("users", { user: l.target_id! })} className="text-left hover:underline">{inner}</button>;
        if ((l.target_type === "NOVEL" || l.target_type === "COMIC") && l.target_id) return <a href={`/${l.target_type === "NOVEL" ? "novel" : "comic"}/${l.target_id}`} target="_blank" rel="noreferrer" className="block hover:underline">{inner}</a>;
        return inner;
    }

    return (
        <div className="space-y-6">
            <PageHeader title="ประวัติการทำงานของแอดมิน" subtitle="ทุกการกระทำของแอดมิน: ใครทำ ทำอะไร กับใคร เมื่อไร" />
            <div className={`${card} overflow-hidden`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col xl:flex-row xl:items-center gap-3">
                    <div className="flex flex-wrap gap-3">
                        <select aria-label="กรองตามการกระทำ" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className={input}>
                            <option value="">ทุกการกระทำ</option>
                            {Object.entries(ADMIN_ACTIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                        <select aria-label="กรองตามแอดมิน" value={adminId} onChange={(e) => { setAdminId(e.target.value); setPage(1); }} className={input}>
                            <option value="">แอดมินทุกคน</option>
                            {data?.admins.map((a) => <option key={a.id} value={a.id}>{a.name || "(ไม่มีชื่อ)"}</option>)}
                        </select>
                    </div>
                    <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
                    {target && <button onClick={() => navigate("logs")} className="text-sm text-indigo-700 dark:text-indigo-400 hover:underline whitespace-nowrap">แสดงทุกรายการ (ตอนนี้กรองเฉพาะรายการเดียว)</button>}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className={thead}><tr><th className={th}>เวลา</th><th className={th}>แอดมิน</th><th className={th}>การกระทำ</th><th className={th}>เป้าหมาย</th><th className={th}>รายละเอียด</th></tr></thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {data?.logs.map((l) => (
                                <tr key={l.id} className={`${rowHover} align-top`}>
                                    <td className={`${td} whitespace-nowrap`}>{fmtDateTime(l.created_at)}</td>
                                    <td className={`${td} text-gray-900 dark:text-white whitespace-nowrap`}>{l.admin_name ?? "(ถูกลบ)"}</td>
                                    <td className={`${td} whitespace-nowrap font-medium text-gray-900 dark:text-white`}>{ADMIN_ACTIONS[l.action as keyof typeof ADMIN_ACTIONS] ?? l.action}</td>
                                    <td className={`${td} min-w-40`}>{targetCell(l)}</td>
                                    <td className={`${td} min-w-56`}>{l.detail}{l.reason && <div className="text-xs mt-1 whitespace-pre-line">เหตุผล: {l.reason}</div>}</td>
                                </tr>
                            ))}
                            {data && data.logs.length === 0 && <EmptyRow colSpan={5} text="ยังไม่มีประวัติ" />}
                            {!data && <EmptyRow colSpan={5} text="กำลังโหลด..." />}
                        </tbody>
                    </table>
                </div>
                {data && <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onChange={setPage} />}
            </div>
        </div>
    );
}
