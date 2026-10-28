"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle, Trash2, XCircle } from "lucide-react";
import { ActionButton, EmptyRow, PageHeader, ReasonDialog, StatusBadge, SubTabs, card, fetchJson, fmtDateTime, rowHover, sendJson, td, th, thead } from "@/components/admin/ui";
import { PanelProps } from "@/components/admin/types";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

interface Report {
    id: string; reporter_name: string | null; target_type: string; target_id: string; target_title: string | null;
    parent_type: string | null; parent_id: string | null; comment_author_name: string | null; reason: string; status: string; created_at: string;
}
type Filter = "PENDING" | "RESOLVED" | "IGNORED" | "";
const TARGET_LABEL: Record<string, string> = { NOVEL: "นิยาย", COMIC: "การ์ตูน", COMMENT: "คอมเมนต์", USER: "ผู้ใช้" };

// รายงาน tab: reports from readers (ReportButton), pending first
export default function ReportsPanel({ counts, refreshCounts }: PanelProps) {
    const toast = useToast();
    const confirm = useConfirm();
    const [filter, setFilter] = useState<Filter>("PENDING");
    const [reports, setReports] = useState<Report[] | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [banning, setBanning] = useState<Report | null>(null);

    const load = useCallback(async () => {
        setReports(await fetchJson<Report[]>(`/api/admin/reports${filter ? `?status=${filter}` : ""}`, toast.error));
    }, [filter, toast.error]);
    useEffect(() => { load(); }, [load]);

    async function setStatus(report: Report, status: "RESOLVED" | "IGNORED", message?: string) {
        setBusyId(report.id);
        const ok = await sendJson(`/api/admin/reports/${report.id}`, "PATCH", { status }, toast.error);
        setBusyId(null);
        if (ok) {
            toast.success(message ?? (status === "RESOLVED" ? "ทำเครื่องหมายว่าจัดการแล้ว" : "ทำเครื่องหมายว่าไม่ดำเนินการ"));
            refreshCounts();
            await load();
        }
        return !!ok;
    }

    async function deleteComment(report: Report) {
        if (!(await confirm("ลบคอมเมนต์นี้และคำตอบทั้งหมด?", { danger: true }))) return;
        setBusyId(report.id);
        const res = await fetch(`/api/comments/${report.target_id}`, { method: "DELETE", credentials: "include" });
        setBusyId(null);
        if (res.ok || res.status === 404) await setStatus(report, "RESOLVED", "ลบคอมเมนต์แล้ว");
        else toast.error("ลบคอมเมนต์ไม่สำเร็จ");
    }

    async function banStory(report: Report, reason: string) {
        const ok = await sendJson(`/api/admin/content/${report.target_id}`, "PATCH", { type: report.target_type === "COMIC" ? "comics" : "novels", status: "BANNED", reason }, toast.error);
        return ok ? setStatus(report, "RESOLVED", "แบนเรื่องแล้ว") : false;
    }

    function target(r: Report) {
        if (r.target_type === "COMMENT") {
            return r.target_title
                ? <a href={`/${r.parent_type === "COMIC" ? "comic" : "novel"}/${r.parent_id}#comments`} target="_blank" rel="noreferrer" className="hover:underline whitespace-pre-line line-clamp-3">{r.comment_author_name}: {r.target_title}</a>
                : <span className="italic">(ถูกลบแล้ว)</span>;
        }
        if (r.target_title) return <a href={`/${r.target_type === "COMIC" ? "comic" : "novel"}/${r.target_id}`} target="_blank" rel="noreferrer" className="hover:underline">{r.target_title}</a>;
        return <span className="italic">(ถูกลบแล้ว)</span>;
    }

    return (
        <div className="space-y-6">
            <PageHeader title="จัดการรายงาน" subtitle="รายงานเนื้อหาและคอมเมนต์จากผู้อ่าน" />
            <SubTabs<Filter>
                tabs={[{ key: "PENDING", label: "รอตรวจสอบ", count: counts?.reports }, { key: "RESOLVED", label: "จัดการแล้ว" }, { key: "IGNORED", label: "ไม่ดำเนินการ" }, { key: "", label: "ทั้งหมด" }]}
                value={filter}
                onChange={(f) => { setFilter(f); setReports(null); }}
            />
            <div className={`${card} overflow-x-auto`}>
                <table className="w-full text-left">
                    <thead className={thead}><tr><th className={th}>สิ่งที่ถูกรายงาน</th><th className={th}>เหตุผล</th><th className={th}>ผู้รายงาน</th><th className={th}>สถานะ</th><th className={th}>วันที่</th><th className={`${th} text-right`}>จัดการ</th></tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {reports?.map((r) => (
                            <tr key={r.id} className={rowHover}>
                                <td className={`${td} min-w-56`}><span className="font-semibold text-indigo-700 dark:text-indigo-400">{TARGET_LABEL[r.target_type] ?? r.target_type}</span>: {target(r)}</td>
                                <td className={`${td} whitespace-pre-line min-w-40`}>{r.reason}</td>
                                <td className={`${td} text-gray-900 dark:text-white`}>{r.reporter_name ?? "-"}</td>
                                <td className={td}><StatusBadge status={r.status} /></td>
                                <td className={`${td} whitespace-nowrap`}>{fmtDateTime(r.created_at)}</td>
                                <td className="px-4 py-3">
                                    {r.status === "PENDING" && (
                                        <div className="flex justify-end gap-2 flex-wrap">
                                            {r.target_type === "COMMENT" && r.target_title && <ActionButton icon={Trash2} label="ลบคอมเมนต์" tone="red" disabled={busyId === r.id} onClick={() => deleteComment(r)} />}
                                            {(r.target_type === "NOVEL" || r.target_type === "COMIC") && r.target_title && <ActionButton icon={Ban} label="แบนเรื่อง" tone="red" disabled={busyId === r.id} onClick={() => setBanning(r)} />}
                                            <ActionButton icon={CheckCircle} label="จัดการแล้ว" disabled={busyId === r.id} onClick={() => setStatus(r, "RESOLVED")} title="ทำเครื่องหมายว่าจัดการแล้ว" />
                                            <ActionButton icon={XCircle} label="ไม่ดำเนินการ" disabled={busyId === r.id} onClick={() => setStatus(r, "IGNORED")} title="รายงานนี้ไม่มีมูล" />
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {reports && reports.length === 0 && <EmptyRow colSpan={6} text="ไม่มีรายงาน" />}
                        {!reports && <EmptyRow colSpan={6} text="กำลังโหลด..." />}
                    </tbody>
                </table>
            </div>
            {banning && (
                <ReasonDialog
                    title={`แบน "${banning.target_title}"`}
                    description="ไม่มีใครอ่านเรื่องนี้ได้ และรายงานนี้จะถูกทำเครื่องหมายว่าจัดการแล้ว นักเขียนจะได้รับแจ้งเตือนพร้อมเหตุผล"
                    confirmText="ยืนยันแบน"
                    onClose={() => setBanning(null)}
                    onSubmit={(reason) => banStory(banning, reason)}
                />
            )}
        </div>
    );
}
