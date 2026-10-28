"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, Ban, CheckCircle, Coins, ExternalLink, Save, ShieldCheck } from "lucide-react";
import { ActionButton, Badge, EmptyRow, ImageLightbox, Modal, ReasonDialog, StatusBadge, SubTabs, baht, card, fetchJson, fmtDate, fmtDateTime, input, rowHover, sendJson, td, th, thead } from "@/components/admin/ui";
import { ROLE_TONE } from "@/components/admin/UsersPanel";
import { Navigate } from "@/components/admin/types";
import { ADMIN_ACTIONS, ROLE_LABEL } from "@/lib/adminActions";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { profileHref } from "@/lib/username";

interface Detail {
    user: { id: string; name: string | null; email: string; username: string | null; image: string | null; role: string; base_role: string; ban_reason: string | null; banned_at: string | null; coins: number; created_at: string };
    writer_profile: { status: string; first_name: string; last_name: string; rejection_reason: string | null; created_at: string } | null;
    author_balance: { earned: number; withdrawn: number; balance: number } | null;
    topups: { id: string; amount: number; slip_image: string; status: string; rejection_reason: string | null; created_at: string }[];
    purchases: { id: string; item_title: string | null; price: number; created_at: string; story_title: string | null; story_id: string | null; story_type: "novel" | "comic" | null }[];
    supports: { id: string; amount: number; message: string | null; created_at: string; author_name: string | null }[];
    adjustments: { id: string; amount: number; balance_after: number; reason: string; created_at: string; admin_name: string | null }[];
    works: { type: "novel" | "comic"; id: string; title: string; status: string; views: number; item_count: number; created_at: string }[];
    reports: { id: string; target_type: string; target_id: string; reason: string; status: string; created_at: string; reporter_name: string | null; target_title: string | null; parent_type: string | null; parent_id: string | null }[];
    logs: { id: string; admin_name: string | null; action: string; detail: string | null; reason: string | null; created_at: string }[];
}

type Section = "topups" | "purchases" | "supports" | "adjustments" | "works" | "reports" | "logs";
const REPORT_TARGET: Record<string, string> = { NOVEL: "นิยาย", COMIC: "การ์ตูน", COMMENT: "คอมเมนต์", USER: "บัญชีผู้ใช้" };
const WRITER_STATUS: Record<string, string> = { PENDING: "รออนุมัติ", APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="font-medium text-gray-900 dark:text-white break-words">{children}</dd>
        </div>
    );
}

// Admin view of one user (/admin?tab=users&user=<id>): account info, actions and history
export default function UserDetail({ id, onBack, navigate }: { id: string; onBack: () => void; navigate: Navigate }) {
    const toast = useToast();
    const toastError = toast.error;
    const confirm = useConfirm();
    const { data: session } = useSession();
    const [data, setData] = useState<Detail | null>(null);
    const [missing, setMissing] = useState(false);
    const [section, setSection] = useState<Section>("topups");
    const [role, setRole] = useState("");
    const [busy, setBusy] = useState(false);
    const [dialog, setDialog] = useState<"ban" | "coins" | null>(null);
    const [slip, setSlip] = useState<string | null>(null);

    const load = useCallback(async () => {
        const res = await fetchJson<Detail>(`/api/admin/users/${id}`, (msg) => { setMissing(true); toastError(msg); });
        if (res) {
            setData(res);
            setRole(res.user.base_role);
        }
    }, [id, toastError]);
    useEffect(() => { load(); }, [load]);

    if (missing && !data) {
        return (
            <div className="space-y-4">
                <ActionButton icon={ArrowLeft} label="กลับไปหน้ารายชื่อ" onClick={onBack} small={false} />
                <p className="text-gray-500 dark:text-gray-400">ไม่พบผู้ใช้นี้</p>
            </div>
        );
    }
    if (!data) return <div className="h-40 flex items-center justify-center text-gray-500 dark:text-gray-400">กำลังโหลด...</div>;

    const { user } = data;
    const banned = user.role === "BANNED";
    const isSelf = session?.user?.id === user.id;
    const name = user.name || user.email;

    async function run(action: () => Promise<unknown>, success: string) {
        setBusy(true);
        const ok = await action();
        setBusy(false);
        if (ok) {
            toast.success(success);
            await load();
        }
        return !!ok;
    }

    async function saveRole() {
        if (!(await confirm(`เปลี่ยนสิทธิ์ของ ${name}\nจาก "${ROLE_LABEL[user.base_role]}" เป็น "${ROLE_LABEL[role]}"?`))) return;
        await run(() => sendJson(`/api/admin/users/${id}`, "PATCH", { role }, toast.error), "เปลี่ยนสิทธิ์แล้ว");
    }

    async function unban() {
        if (!(await confirm(`ปลดแบน ${name}?\nผู้ใช้จะกลับมาเป็น "${ROLE_LABEL[user.base_role]}" และเข้าสู่ระบบได้อีกครั้ง`))) return;
        await run(() => sendJson(`/api/admin/users/${id}`, "PATCH", { action: "unban" }, toast.error), "ปลดแบนแล้ว");
    }

    const sections: { key: Section; label: string; count: number }[] = [
        { key: "topups", label: "เติมเหรียญ", count: data.topups.length },
        { key: "purchases", label: "ซื้อตอน", count: data.purchases.length },
        { key: "supports", label: "สนับสนุนนักเขียน", count: data.supports.length },
        { key: "adjustments", label: "ปรับเหรียญโดยแอดมิน", count: data.adjustments.length },
        ...(data.works.length || user.base_role === "AUTHOR" ? [{ key: "works" as Section, label: "ผลงาน", count: data.works.length }] : []),
        { key: "reports", label: "รายงานที่เคยโดน", count: data.reports.length },
        { key: "logs", label: "ประวัติการจัดการ", count: data.logs.length },
    ];

    return (
        <div className="space-y-6">
            <ActionButton icon={ArrowLeft} label="กลับไปหน้ารายชื่อ" onClick={onBack} small={false} />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <section className={`${card} p-5 xl:col-span-2`} aria-labelledby="user-name">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                        <h1 id="user-name" className="text-2xl font-bold text-gray-900 dark:text-white break-all">{name}</h1>
                        <Badge tone={ROLE_TONE[user.base_role] ?? "gray"}>{ROLE_LABEL[user.base_role] ?? user.base_role}</Badge>
                        {banned ? <Badge tone="red">ถูกแบน</Badge> : <Badge tone="green">ปกติ</Badge>}
                    </div>
                    {banned && (
                        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/60 text-sm text-red-800 dark:text-red-300">
                            <div className="font-medium">ถูกแบน{user.banned_at ? `เมื่อ ${fmtDateTime(user.banned_at)}` : ""}</div>
                            <div className="whitespace-pre-line">เหตุผล: {user.ban_reason || "-"}</div>
                        </div>
                    )}
                    <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Field label="อีเมล"><span className="break-all">{user.email}</span></Field>
                        <Field label="ชื่อผู้ใช้">
                            {user.username ? (user.base_role === "AUTHOR" || user.base_role === "ADMIN" || data.works.length
                                ? <Link href={profileHref({ id: user.id, username: user.username })} target="_blank" className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-400 hover:underline">@{user.username}<ExternalLink className="w-3.5 h-3.5" /></Link>
                                : `@${user.username}`) : "-"}
                        </Field>
                        <Field label="ยอดเหรียญ">{user.coins.toLocaleString("th-TH")} เหรียญ</Field>
                        <Field label="สมัครเมื่อ">{fmtDateTime(user.created_at)}</Field>
                        <Field label="คำขอเป็นนักเขียน">{data.writer_profile ? `${WRITER_STATUS[data.writer_profile.status] ?? data.writer_profile.status} (${data.writer_profile.first_name} ${data.writer_profile.last_name})` : "ไม่เคยส่ง"}</Field>
                        {data.author_balance && <Field label="รายได้นักเขียน (คงเหลือ / รวม)">฿{baht(data.author_balance.balance)} / ฿{baht(data.author_balance.earned)}</Field>}
                        <Field label="รหัสผู้ใช้"><span className="text-xs font-mono">{user.id}</span></Field>
                    </dl>
                </section>

                <section className={`${card} p-5 space-y-5`} aria-labelledby="user-actions">
                    <h2 id="user-actions" className="text-lg font-bold text-gray-900 dark:text-white">จัดการบัญชี</h2>
                    {isSelf ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">นี่คือบัญชีของคุณ เปลี่ยนสิทธิ์หรือแบนตัวเองไม่ได้ (ปรับยอดเหรียญได้)</p>
                    ) : (<>
                        <div>
                            <label htmlFor="role-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">สิทธิ์</label>
                            <div className="flex gap-2">
                                <select id="role-select" value={role} disabled={banned || busy} onChange={(e) => setRole(e.target.value)} className={`flex-1 min-w-0 ${input}`}>
                                    <option value="READER">ผู้อ่าน</option>
                                    <option value="AUTHOR">นักเขียน</option>
                                    <option value="ADMIN">แอดมิน</option>
                                </select>
                                <ActionButton icon={Save} label="บันทึก" tone="indigo" small={false} disabled={busy || banned || role === user.base_role} onClick={saveRole} title="บันทึกสิทธิ์ใหม่" />
                            </div>
                            {banned && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ปลดแบนก่อนจึงจะเปลี่ยนสิทธิ์ได้</p>}
                        </div>
                        <div>
                            {banned
                                ? <ActionButton icon={CheckCircle} label="ปลดแบน" tone="green" small={false} disabled={busy} onClick={unban} title="ปลดแบนและคืนสิทธิ์เดิม" />
                                : <ActionButton icon={Ban} label="แบนผู้ใช้" tone="red" small={false} disabled={busy} onClick={() => setDialog("ban")} title="แบนพร้อมระบุเหตุผล" />}
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ผู้ใช้ที่ถูกแบนจะถูกออกจากระบบทันทีและเข้าสู่ระบบไม่ได้</p>
                        </div>
                    </>)}
                    <div>
                        <ActionButton icon={Coins} label="ปรับยอดเหรียญ" tone="amber" small={false} disabled={busy} onClick={() => setDialog("coins")} title="เพิ่มหรือหักเหรียญพร้อมระบุเหตุผล" />
                    </div>
                </section>
            </div>

            <section className={`${card} overflow-hidden`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <SubTabs tabs={sections.map((s) => ({ ...s, label: `${s.label} (${s.count})`, count: undefined }))} value={section} onChange={setSection} />
                </div>
                <div className="overflow-x-auto">{renderSection()}</div>
            </section>

            {dialog === "ban" && (
                <ReasonDialog
                    title={`แบน ${name}`}
                    description="ผู้ใช้จะถูกออกจากระบบทันทีและเข้าสู่ระบบไม่ได้จนกว่าจะปลดแบน เหตุผลจะถูกบันทึกในประวัติการทำงานของแอดมิน"
                    placeholder="เช่น โพสต์สแปมลิงก์พนันซ้ำหลายครั้ง"
                    confirmText="ยืนยันแบน"
                    onClose={() => setDialog(null)}
                    onSubmit={(reason) => run(() => sendJson(`/api/admin/users/${id}`, "PATCH", { action: "ban", reason }, toast.error), "แบนผู้ใช้แล้ว")}
                />
            )}
            {dialog === "coins" && (
                <CoinsDialog
                    name={name}
                    coins={user.coins}
                    onClose={() => setDialog(null)}
                    onSubmit={async (amount, reason) => {
                        const after = user.coins + amount;
                        if (!(await confirm(`${amount > 0 ? "เพิ่ม" : "หัก"} ${Math.abs(amount).toLocaleString("th-TH")} เหรียญ ${amount > 0 ? "ให้" : "จาก"} ${name}?\nยอดใหม่: ${after.toLocaleString("th-TH")} เหรียญ\nเหตุผล: ${reason}`, { danger: amount < 0, confirmText: "ยืนยัน" }))) return false;
                        return run(() => sendJson(`/api/admin/users/${id}/coins`, "POST", { amount, reason }, toast.error), "ปรับยอดเหรียญแล้ว");
                    }}
                />
            )}
            {slip && <ImageLightbox src={slip} alt="สลิปเติมเหรียญ" onClose={() => setSlip(null)} />}
        </div>
    );

    function renderSection() {
        const d = data!;
        switch (section) {
            case "topups": return (
                <table className="w-full text-left">
                    <thead className={thead}><tr><th className={th}>วันที่</th><th className={`${th} text-right`}>จำนวน</th><th className={th}>สถานะ</th><th className={th}>สลิป</th></tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {d.topups.map((t) => (
                            <tr key={t.id} className={rowHover}>
                                <td className={`${td} whitespace-nowrap`}>{fmtDateTime(t.created_at)}</td>
                                <td className={`${td} text-right font-medium text-gray-900 dark:text-white`}>{baht(t.amount)} บาท</td>
                                <td className={td}><StatusBadge status={t.status} />{t.rejection_reason && <div className="text-xs mt-1">{t.rejection_reason}</div>}</td>
                                <td className={td}><button onClick={() => setSlip(t.slip_image)} className="text-indigo-700 dark:text-indigo-400 hover:underline">ดูสลิป</button></td>
                            </tr>
                        ))}
                        {d.topups.length === 0 && <EmptyRow colSpan={4} text="ยังไม่เคยเติมเหรียญ" />}
                    </tbody>
                </table>
            );
            case "purchases": return (
                <table className="w-full text-left">
                    <thead className={thead}><tr><th className={th}>วันที่</th><th className={th}>ตอน</th><th className={th}>เรื่อง</th><th className={`${th} text-right`}>ราคา</th></tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {d.purchases.map((p) => (
                            <tr key={p.id} className={rowHover}>
                                <td className={`${td} whitespace-nowrap`}>{fmtDateTime(p.created_at)}</td>
                                <td className={`${td} text-gray-900 dark:text-white`}>{p.item_title || "(ตอนถูกลบ)"}</td>
                                <td className={td}>{p.story_id ? <Link href={`/${p.story_type}/${p.story_id}`} target="_blank" className="hover:underline">{p.story_title}</Link> : "-"}</td>
                                <td className={`${td} text-right font-medium text-gray-900 dark:text-white`}>{p.price} เหรียญ</td>
                            </tr>
                        ))}
                        {d.purchases.length === 0 && <EmptyRow colSpan={4} text="ยังไม่เคยซื้อตอน" />}
                    </tbody>
                </table>
            );
            case "supports": return (
                <table className="w-full text-left">
                    <thead className={thead}><tr><th className={th}>วันที่</th><th className={th}>นักเขียน</th><th className={th}>ข้อความ</th><th className={`${th} text-right`}>จำนวน</th></tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {d.supports.map((s) => (
                            <tr key={s.id} className={rowHover}>
                                <td className={`${td} whitespace-nowrap`}>{fmtDateTime(s.created_at)}</td>
                                <td className={`${td} text-gray-900 dark:text-white`}>{s.author_name ?? "-"}</td>
                                <td className={`${td} whitespace-pre-line`}>{s.message || "-"}</td>
                                <td className={`${td} text-right font-medium text-gray-900 dark:text-white`}>{s.amount} เหรียญ</td>
                            </tr>
                        ))}
                        {d.supports.length === 0 && <EmptyRow colSpan={4} text="ยังไม่เคยสนับสนุนนักเขียน" />}
                    </tbody>
                </table>
            );
            case "adjustments": return (
                <table className="w-full text-left">
                    <thead className={thead}><tr><th className={th}>วันที่</th><th className={`${th} text-right`}>จำนวน</th><th className={`${th} text-right`}>คงเหลือ</th><th className={th}>เหตุผล</th><th className={th}>โดย</th></tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {d.adjustments.map((a) => (
                            <tr key={a.id} className={rowHover}>
                                <td className={`${td} whitespace-nowrap`}>{fmtDateTime(a.created_at)}</td>
                                <td className={`${td} text-right font-medium ${a.amount > 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>{a.amount > 0 ? "+" : ""}{a.amount}</td>
                                <td className={`${td} text-right`}>{a.balance_after}</td>
                                <td className={`${td} whitespace-pre-line`}>{a.reason}</td>
                                <td className={td}>{a.admin_name ?? "-"}</td>
                            </tr>
                        ))}
                        {d.adjustments.length === 0 && <EmptyRow colSpan={5} text="ยังไม่เคยถูกปรับยอดเหรียญ" />}
                    </tbody>
                </table>
            );
            case "works": return (
                <table className="w-full text-left">
                    <thead className={thead}><tr><th className={th}>เรื่อง</th><th className={th}>ประเภท</th><th className={th}>สถานะ</th><th className={`${th} text-right`}>ตอน</th><th className={`${th} text-right`}>วิว</th><th className={th}>สร้างเมื่อ</th></tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {d.works.map((w) => (
                            <tr key={`${w.type}-${w.id}`} className={rowHover}>
                                <td className={`${td} text-gray-900 dark:text-white font-medium`}><Link href={`/${w.type}/${w.id}`} target="_blank" className="hover:underline">{w.title}</Link></td>
                                <td className={td}>{w.type === "novel" ? "นิยาย" : "การ์ตูน"}</td>
                                <td className={td}><StatusBadge status={w.status} /></td>
                                <td className={`${td} text-right`}>{w.item_count}</td>
                                <td className={`${td} text-right`}>{w.views.toLocaleString("th-TH")}</td>
                                <td className={`${td} whitespace-nowrap`}>{fmtDate(w.created_at)}</td>
                            </tr>
                        ))}
                        {d.works.length === 0 && <EmptyRow colSpan={6} text="ยังไม่มีผลงาน" />}
                    </tbody>
                </table>
            );
            case "reports": return (
                <table className="w-full text-left">
                    <thead className={thead}><tr><th className={th}>วันที่</th><th className={th}>สิ่งที่ถูกรายงาน</th><th className={th}>เหตุผล</th><th className={th}>ผู้รายงาน</th><th className={th}>สถานะ</th></tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {d.reports.map((r) => (
                            <tr key={r.id} className={rowHover}>
                                <td className={`${td} whitespace-nowrap`}>{fmtDateTime(r.created_at)}</td>
                                <td className={td}><span className="font-semibold text-indigo-700 dark:text-indigo-400">{REPORT_TARGET[r.target_type] ?? r.target_type}</span>{r.target_title && <span className="block line-clamp-2 whitespace-pre-line">{r.target_title}</span>}</td>
                                <td className={`${td} whitespace-pre-line`}>{r.reason}</td>
                                <td className={td}>{r.reporter_name ?? "-"}</td>
                                <td className={td}><StatusBadge status={r.status} /></td>
                            </tr>
                        ))}
                        {d.reports.length === 0 && <EmptyRow colSpan={5} text="ไม่เคยถูกรายงาน" />}
                    </tbody>
                </table>
            );
            case "logs": return (
                <div>
                    <table className="w-full text-left">
                        <thead className={thead}><tr><th className={th}>วันที่</th><th className={th}>แอดมิน</th><th className={th}>การกระทำ</th><th className={th}>รายละเอียด</th></tr></thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {d.logs.map((l) => (
                                <tr key={l.id} className={rowHover}>
                                    <td className={`${td} whitespace-nowrap`}>{fmtDateTime(l.created_at)}</td>
                                    <td className={`${td} text-gray-900 dark:text-white`}>{l.admin_name ?? "-"}</td>
                                    <td className={td}>{ADMIN_ACTIONS[l.action as keyof typeof ADMIN_ACTIONS] ?? l.action}</td>
                                    <td className={td}>{l.detail}{l.reason && <div className="text-xs whitespace-pre-line">เหตุผล: {l.reason}</div>}</td>
                                </tr>
                            ))}
                            {d.logs.length === 0 && <EmptyRow colSpan={4} text="ยังไม่มีการจัดการโดยแอดมิน" />}
                        </tbody>
                    </table>
                    {d.logs.length > 0 && (
                        <div className="p-3 text-right border-t border-gray-200 dark:border-gray-700">
                            <button onClick={() => navigate("logs", { target: id })} className="text-sm text-indigo-700 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"><ShieldCheck className="w-4 h-4" />ดูทั้งหมดในประวัติการทำงานของแอดมิน</button>
                        </div>
                    )}
                </div>
            );
        }
    }
}

// Amount (add or remove) and a required reason; the caller asks for a final confirmation
function CoinsDialog({ name, coins, onSubmit, onClose }: { name: string; coins: number; onSubmit: (amount: number, reason: string) => Promise<boolean>; onClose: () => void }) {
    const [mode, setMode] = useState<"add" | "remove">("add");
    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const n = Number(amount);
    const valid = Number.isInteger(n) && n > 0 && n <= 1_000_000 && (mode === "add" || n <= coins) && reason.trim().length > 0;
    return (
        <Modal title={`ปรับยอดเหรียญของ ${name}`} onClose={onClose} busy={busy} labelId="coins-dialog-title">
            <form onSubmit={async (e) => {
                e.preventDefault();
                if (!valid) return;
                setBusy(true);
                const ok = await onSubmit(mode === "add" ? n : -n, reason.trim());
                setBusy(false);
                if (ok) onClose();
            }} className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">ยอดปัจจุบัน {coins.toLocaleString("th-TH")} เหรียญ ผู้ใช้จะได้รับแจ้งเตือนพร้อมเหตุผล</p>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="ประเภทการปรับ">
                    {(["add", "remove"] as const).map((m) => (
                        <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                            className={`py-2 rounded-lg border font-medium ${mode === m ? (m === "add" ? "bg-green-700 text-white border-green-700" : "bg-red-600 text-white border-red-600") : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"}`}>
                            {m === "add" ? "เพิ่มเหรียญ" : "หักเหรียญ"}
                        </button>
                    ))}
                </div>
                <div>
                    <label htmlFor="coins-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">จำนวนเหรียญ</label>
                    <input id="coins-amount" type="number" inputMode="numeric" min={1} max={mode === "remove" ? coins : 1_000_000} step={1} required autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} className={`w-full ${input}`} />
                    {mode === "remove" && n > coins && <p className="text-xs text-red-700 dark:text-red-400 mt-1">หักได้ไม่เกิน {coins} เหรียญ</p>}
                    {amount && Number.isInteger(n) && n > 0 && (mode === "add" || n <= coins) && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ยอดใหม่: {(coins + (mode === "add" ? n : -n)).toLocaleString("th-TH")} เหรียญ</p>}
                </div>
                <div>
                    <label htmlFor="coins-reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">เหตุผล</label>
                    <textarea id="coins-reason" rows={3} maxLength={500} required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ชดเชยตอนที่ซื้อแล้วเปิดไม่ได้" className={`w-full ${input}`} />
                </div>
                <div className="flex justify-end gap-3">
                    <button type="button" disabled={busy} onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50">ยกเลิก</button>
                    <button type="submit" disabled={busy || !valid} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">{busy ? "กำลังบันทึก..." : "ถัดไป"}</button>
                </div>
            </form>
        </Modal>
    );
}
