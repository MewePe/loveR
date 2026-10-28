"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, Eye, XCircle } from "lucide-react";
import { ActionButton, EmptyRow, ImageLightbox, Modal, PageHeader, ReasonDialog, StatusBadge, SubTabs, card, fetchJson, fmtDate, rowHover, sendJson, td, th, thead } from "@/components/admin/ui";
import { PanelProps } from "@/components/admin/types";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

interface WriterRequest {
    user_id: string; user_name: string; email: string; title: string; first_name: string; last_name: string; id_card_number: string;
    phone_number: string; province: string; bank_name: string; bank_account_name: string; bank_account_number: string;
    id_card_image: string; bank_book_image: string; status: string; rejection_reason: string; created_at: string;
}
type Filter = "PENDING" | "APPROVED" | "REJECTED" | "";

// คำขอเป็นนักเขียน tab (writer_profiles)
export default function WritersPanel({ counts, refreshCounts, navigate }: PanelProps) {
    const toast = useToast();
    const confirm = useConfirm();
    const [filter, setFilter] = useState<Filter>("PENDING");
    const [requests, setRequests] = useState<WriterRequest[] | null>(null);
    const [selected, setSelected] = useState<WriterRequest | null>(null);
    const [rejecting, setRejecting] = useState<WriterRequest | null>(null);
    const [doc, setDoc] = useState<{ src: string; alt: string } | null>(null);

    const load = useCallback(async () => {
        setRequests(await fetchJson<WriterRequest[]>(`/api/admin/writers${filter ? `?status=${filter}` : ""}`, toast.error));
    }, [filter, toast.error]);
    useEffect(() => { load(); }, [load]);

    const fullName = (r: WriterRequest) => `${r.title ?? ""}${r.first_name} ${r.last_name}`;

    async function decide(r: WriterRequest, status: "APPROVED" | "REJECTED", reason: string | null = null) {
        if (status === "APPROVED" && !(await confirm(`อนุมัติ ${fullName(r)} เป็นนักเขียน?`))) return false;
        const ok = await sendJson(`/api/admin/writers/${r.user_id}`, "PATCH", { status, reason }, toast.error);
        if (!ok) return false;
        toast.success(status === "APPROVED" ? "อนุมัติเรียบร้อย" : "ปฏิเสธเรียบร้อย");
        setSelected(null);
        refreshCounts();
        await load();
        return true;
    }

    const docLink = (src: string, alt: string) => src
        ? <button onClick={() => setDoc({ src, alt })} className="text-indigo-700 dark:text-indigo-400 hover:underline">ดูไฟล์</button>
        : <span className="text-gray-900 dark:text-white">-</span>;

    return (
        <div className="space-y-6">
            <PageHeader title="คำขอเป็นนักเขียน" subtitle="ตรวจข้อมูลและเอกสาร แล้วอนุมัติหรือปฏิเสธ" />
            <SubTabs<Filter>
                tabs={[{ key: "PENDING", label: "รออนุมัติ", count: counts?.writers }, { key: "APPROVED", label: "อนุมัติแล้ว" }, { key: "REJECTED", label: "ไม่อนุมัติ" }, { key: "", label: "ทั้งหมด" }]}
                value={filter}
                onChange={(f) => { setFilter(f); setRequests(null); }}
            />
            <div className={`${card} overflow-x-auto`}>
                <table className="w-full text-left">
                    <thead className={thead}><tr><th className={th}>ชื่อ</th><th className={th}>อีเมล</th><th className={th}>เบอร์โทร</th><th className={th}>จังหวัด</th><th className={th}>สถานะ</th><th className={th}>วันที่</th><th className={`${th} text-right`}>จัดการ</th></tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {requests?.map((r) => (
                            <tr key={r.user_id} className={rowHover}>
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{fullName(r)}</td>
                                <td className={`${td} break-all`}>{r.email}</td>
                                <td className={td}>{r.phone_number}</td>
                                <td className={td}>{r.province}</td>
                                <td className={td}><StatusBadge status={r.status} /></td>
                                <td className={`${td} whitespace-nowrap`}>{fmtDate(r.created_at)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-2 flex-wrap">
                                        <ActionButton icon={Eye} label="ดูรายละเอียด" onClick={() => setSelected(r)} />
                                        {r.status === "PENDING" && (<>
                                            <ActionButton icon={CheckCircle} label="อนุมัติ" tone="green" onClick={() => decide(r, "APPROVED")} />
                                            <ActionButton icon={XCircle} label="ปฏิเสธ" tone="red" onClick={() => setRejecting(r)} />
                                        </>)}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {requests && requests.length === 0 && <EmptyRow colSpan={7} text="ไม่มีคำขอ" />}
                        {!requests && <EmptyRow colSpan={7} text="กำลังโหลด..." />}
                    </tbody>
                </table>
            </div>

            {selected && (
                <Modal title="รายละเอียดคำขอ" onClose={() => setSelected(null)} wide labelId="writer-detail-title">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                        {([
                            ["ชื่อ-นามสกุล", fullName(selected)],
                            ["อีเมล", selected.email],
                            ["เลขบัตรประชาชน", selected.id_card_number],
                            ["เบอร์โทร", selected.phone_number],
                            ["จังหวัด", selected.province],
                            ["สถานะ", <StatusBadge key="s" status={selected.status} />],
                            ["ธนาคาร", selected.bank_name || "-"],
                            ["เลขที่บัญชี / ชื่อบัญชี", `${selected.bank_account_number || "-"} ${selected.bank_account_name ?? ""}`],
                            ["สำเนาบัตรประชาชน", docLink(selected.id_card_image, "สำเนาบัตรประชาชน")],
                            ["สำเนาบัญชีธนาคาร", docLink(selected.bank_book_image, "สำเนาบัญชีธนาคาร")],
                        ] as [string, React.ReactNode][]).map(([label, value]) => (
                            <div key={label}><dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt><dd className="font-medium text-gray-900 dark:text-white break-words">{value}</dd></div>
                        ))}
                        {selected.rejection_reason && <div className="sm:col-span-2"><dt className="text-sm text-gray-500 dark:text-gray-400">หมายเหตุ</dt><dd className="font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1 whitespace-pre-line">{selected.rejection_reason}</dd></div>}
                    </dl>
                    <div className="flex flex-wrap justify-end gap-3">
                        <ActionButton label="ดูบัญชีผู้ใช้" small={false} onClick={() => navigate("users", { user: selected.user_id })} />
                        {selected.status === "PENDING" && (<>
                            <ActionButton icon={XCircle} label="ปฏิเสธ" tone="red" small={false} onClick={() => setRejecting(selected)} />
                            <ActionButton icon={CheckCircle} label="อนุมัติ" tone="green" small={false} onClick={() => decide(selected, "APPROVED")} />
                        </>)}
                    </div>
                </Modal>
            )}
            {rejecting && (
                <ReasonDialog
                    title="ปฏิเสธคำขอเป็นนักเขียน"
                    description="เหตุผลจะแสดงให้ผู้สมัครเห็น เพื่อแก้ไขแล้วส่งใหม่ได้"
                    placeholder="เช่น สำเนาบัตรประชาชนไม่ชัด"
                    required={false}
                    confirmText="ปฏิเสธคำขอ"
                    onClose={() => setRejecting(null)}
                    onSubmit={(reason) => decide(rejecting, "REJECTED", reason || null)}
                />
            )}
            {doc && <ImageLightbox src={doc.src} alt={doc.alt} onClose={() => setDoc(null)} />}
        </div>
    );
}
