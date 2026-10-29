"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, ExternalLink, ShieldCheck, ShieldPlus, XCircle } from "lucide-react";
import {
    ActionButton, Badge, ImageLightbox, PageHeader, Pagination, ReasonDialog, SubTabs, Tone, card, fetchJson, fmtDateTime, qs, sendJson,
} from "@/components/admin/ui";
import { PanelProps } from "@/components/admin/types";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import {
    CHECK_STATUS_LABEL, CheckStatus, ISSUE_CATEGORY_LABEL, ITEM_STATUS_LABEL, ItemModerationStatus, IssueCategory, ModerationAnalysis,
    SEVERE_VERDICTS, SOURCE_LABEL, CheckSource, VERDICT_LABEL, Verdict,
} from "@/lib/moderationLabels";

interface QueueItem {
    id: string; item_type: "chapter" | "episode"; chapter_id: string | null; episode_id: string | null; story_id: string;
    source: CheckSource; declared_mature: boolean; verdict: Verdict | null; analysis: ModerationAnalysis; model: string | null;
    status: CheckStatus; review_note: string | null; reviewed_at: string | null; created_at: string;
    item_title: string | null; item_number: number | null; item_status: ItemModerationStatus | null;
    story_title: string | null; story_mature: boolean | null; excerpt: string | null;
    author_name: string | null; reporter_name: string | null; reviewer_name: string | null;
    pages: { url: string; number: number }[];
}
interface QueueResponse { items: QueueItem[]; total: number; page: number; pageSize: number }
type Filter = "PENDING" | "CLEARED" | "APPROVED" | "REJECTED" | "all";
type Dialog = { item: QueueItem; action: "approve" | "reject" } | null;

const VERDICT_TONE: Record<Verdict, Tone> = { SAFE: "green", MATURE: "yellow", EXPLICIT: "red", ILLEGAL: "red", MINOR: "red", REFUSED: "gray", ERROR: "gray" };
const ITEM_STATUS_TONE: Record<ItemModerationStatus, Tone> = { APPROVED: "green", PENDING: "yellow", BLOCKED: "red", REJECTED: "red" };
const CHECK_STATUS_TONE: Record<CheckStatus, Tone> = { CHECKING: "gray", CLEARED: "green", PENDING: "yellow", APPROVED: "green", REJECTED: "red", SUPERSEDED: "gray" };

const readerHref = (i: QueueItem) => i.item_type === "chapter" ? `/read/${i.chapter_id}` : `/comic/${i.story_id}/read/${i.episode_id}`;

// คิวตรวจเนื้อหา: chapters/episodes the Gemini check flagged, couldn't check, or readers reported as mislabelled
// (lib/moderation.ts). The admin sees the API's Thai analysis (with page numbers for comics) and approves, approves
// after relabelling the story 18+, or rejects with a reason; the author is notified either way.
export default function ModerationPanel({ counts, refreshCounts }: PanelProps) {
    const toast = useToast();
    const confirm = useConfirm();
    const [filter, setFilter] = useState<Filter>("PENDING");
    const [page, setPage] = useState(1);
    const [data, setData] = useState<QueueResponse | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [dialog, setDialog] = useState<Dialog>(null);
    const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

    const load = useCallback(async () => {
        setData(await fetchJson<QueueResponse>(`/api/admin/moderation?${qs({ status: filter, page })}`, toast.error));
    }, [filter, page, toast.error]);
    useEffect(() => { load(); }, [load]);

    async function decide(item: QueueItem, action: "approve" | "mark_mature" | "reject", reason = "") {
        setBusyId(item.id);
        const ok = await sendJson(`/api/admin/moderation/${item.id}`, "PATCH", { action, reason }, toast.error);
        setBusyId(null);
        if (ok) {
            toast.success(action === "reject" ? "ปฏิเสธแล้ว แจ้งนักเขียนแล้ว" : action === "mark_mature" ? "ปรับเรื่องเป็น 18+ และเผยแพร่แล้ว" : "อนุมัติและเผยแพร่แล้ว");
            refreshCounts();
            await load();
        }
        return !!ok;
    }

    async function approve(item: QueueItem) {
        // Overriding a severe result needs a written reason (in the dialog); otherwise a plain confirmation
        if (item.verdict && SEVERE_VERDICTS.includes(item.verdict)) return setDialog({ item, action: "approve" });
        if (await confirm(`อนุมัติและเผยแพร่${item.item_type === "chapter" ? "บท" : "ตอน"} "${item.item_title}"?`, { confirmText: "อนุมัติ" })) {
            await decide(item, "approve");
        }
    }

    async function markMature(item: QueueItem) {
        const ok = await confirm(
            `ปรับเรื่อง "${item.story_title}" เป็น 18+ แล้วเผยแพร่${item.item_type === "chapter" ? "บท" : "ตอน"}นี้? ผู้อ่านจะต้องยืนยันอายุก่อนเข้าเรื่องนี้ และนักเขียนจะเปลี่ยนกลับเป็นทั่วไปเองไม่ได้`,
            { confirmText: "ปรับเป็น 18+ และอนุมัติ" }
        );
        if (ok) await decide(item, "mark_mature");
    }

    const tabs = [
        { key: "PENDING" as const, label: "รอตรวจ", count: counts?.moderation },
        { key: "CLEARED" as const, label: "ผ่านอัตโนมัติ" },
        { key: "APPROVED" as const, label: "อนุมัติแล้ว" },
        { key: "REJECTED" as const, label: "ปฏิเสธแล้ว" },
        { key: "all" as const, label: "ทั้งหมด" },
    ];

    return (
        <div className="space-y-6">
            <PageHeader title="คิวตรวจเนื้อหา" subtitle="ตอนที่ระบบตรวจ (Gemini) พบว่าอาจไม่ตรงกับป้าย/ผิดกฎ ตรวจไม่ได้ หรือผู้อ่านรายงานว่าติดป้ายผิด" />
            <SubTabs<Filter> tabs={tabs} value={filter} onChange={(f) => { setFilter(f); setPage(1); setData(null); }} />

            {!data && <div className={`${card} p-8 text-center text-gray-500 dark:text-gray-400`}>กำลังโหลด...</div>}
            {data && data.items.length === 0 && (
                <div className={`${card} p-8 sm:p-10 text-center`}>
                    <ShieldCheck className="w-10 h-10 mx-auto text-green-700 dark:text-green-400 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">{filter === "PENDING" ? "ไม่มีตอนที่รอตรวจ" : "ไม่มีรายการ"}</p>
                </div>
            )}

            {data?.items.map((item) => {
                const flagged = new Set(item.analysis.issues.map((i) => i.page).filter((p): p is number => p !== null));
                const deleted = !item.item_title;
                return (
                    <article key={item.id} className={`${card} p-4 sm:p-5 space-y-4`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <Badge tone={item.item_type === "chapter" ? "indigo" : "pink"}>{item.item_type === "chapter" ? "นิยาย" : "การ์ตูน"}</Badge>
                                    <Badge tone={CHECK_STATUS_TONE[item.status]}>{CHECK_STATUS_LABEL[item.status]}</Badge>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{SOURCE_LABEL[item.source]}{item.reporter_name ? ` โดย ${item.reporter_name}` : ""}</span>
                                </div>
                                <h2 className="font-bold text-gray-900 dark:text-white break-words">
                                    {deleted ? <span className="italic text-gray-500 dark:text-gray-400">(ตอนนี้ถูกลบแล้ว)</span> : (
                                        <a href={readerHref(item)} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">
                                            {item.story_title} — {item.item_number !== null ? `#${item.item_number} ` : ""}{item.item_title}
                                            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                                        </a>
                                    )}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">โดย {item.author_name ?? "-"} · {fmtDateTime(item.created_at)}</p>
                            </div>
                            {item.status === "PENDING" && !deleted && (
                                <div className="flex flex-wrap gap-2">
                                    <ActionButton icon={CheckCircle} label="อนุมัติ" tone="green" disabled={busyId === item.id} onClick={() => approve(item)} title="เผยแพร่ตอนนี้ตามป้ายเดิม" />
                                    {item.story_mature === false && (
                                        <ActionButton icon={ShieldPlus} label="ปรับเป็น 18+ และอนุมัติ" tone="amber" disabled={busyId === item.id} onClick={() => markMature(item)} title="แก้ป้ายเรื่องเป็น 18+ แล้วเผยแพร่" />
                                    )}
                                    <ActionButton icon={XCircle} label="ปฏิเสธ" tone="red" disabled={busyId === item.id} onClick={() => setDialog({ item, action: "reject" })} />
                                </div>
                            )}
                        </div>

                        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                            <div>
                                <dt className="text-gray-500 dark:text-gray-400">ป้ายที่นักเขียนเลือก</dt>
                                <dd className="mt-1"><Badge tone={item.declared_mature ? "red" : "green"}>{item.declared_mature ? "18+" : "ทั่วไป"}</Badge>
                                    {item.story_mature !== null && item.story_mature !== item.declared_mature && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(ตอนนี้เป็น {item.story_mature ? "18+" : "ทั่วไป"})</span>}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-gray-500 dark:text-gray-400">ผลจาก API</dt>
                                <dd className="mt-1">{item.verdict ? <Badge tone={VERDICT_TONE[item.verdict]}>{VERDICT_LABEL[item.verdict]}</Badge> : <Badge>ยังไม่มีผล</Badge>}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500 dark:text-gray-400">สถานะตอนตอนนี้</dt>
                                <dd className="mt-1">{item.item_status ? <Badge tone={ITEM_STATUS_TONE[item.item_status]}>{ITEM_STATUS_LABEL[item.item_status]}</Badge> : "-"}</dd>
                            </div>
                        </dl>

                        <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 p-3 text-sm">
                            <p className="font-medium text-gray-900 dark:text-white mb-1">ผลวิเคราะห์</p>
                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">{item.analysis.summary || (item.verdict ? "-" : "ยังตรวจไม่เสร็จ (ระบบอาจหยุดทำงานระหว่างตรวจ) กรุณาตรวจด้วยตัวเอง")}</p>
                            {item.analysis.issues.length > 0 && (
                                <ul className="mt-2 space-y-1">
                                    {item.analysis.issues.map((issue, i) => (
                                        <li key={i} className="text-gray-700 dark:text-gray-300">
                                            {issue.page !== null && <span className="font-semibold text-red-700 dark:text-red-400">หน้า {issue.page} · </span>}
                                            <span className="font-medium">{ISSUE_CATEGORY_LABEL[issue.category as IssueCategory] ?? issue.category}:</span> {issue.reason}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {item.model && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">โมเดล: {item.model}</p>}
                        </div>

                        {item.item_type === "episode" && item.pages.length > 0 && (
                            <PageThumbs pages={item.pages} flagged={flagged} onOpen={(p) => setLightbox({ src: p.url, alt: `หน้า ${p.number}` })} />
                        )}
                        {item.item_type === "chapter" && item.excerpt && (
                            <details className="text-sm">
                                <summary className="cursor-pointer text-indigo-700 dark:text-indigo-400">ดูตัวอย่างเนื้อหา</summary>
                                {/* Plain text, never HTML (author input) */}
                                <p className="mt-2 whitespace-pre-line text-gray-700 dark:text-gray-300 max-h-60 overflow-y-auto">{item.excerpt}{item.excerpt.length >= 600 ? "…" : ""}</p>
                            </details>
                        )}

                        {item.reviewed_at && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {item.status === "REJECTED" ? "ปฏิเสธ" : "อนุมัติ"}โดย {item.reviewer_name ?? "-"} เมื่อ {fmtDateTime(item.reviewed_at)}
                                {item.review_note && <span className="block whitespace-pre-line text-gray-700 dark:text-gray-300">เหตุผล: {item.review_note}</span>}
                            </p>
                        )}
                    </article>
                );
            })}

            {data && data.total > 0 && (
                <div className={card}><Pagination page={data.page} total={data.total} pageSize={data.pageSize} onChange={setPage} /></div>
            )}

            {dialog && (
                <ReasonDialog
                    title={dialog.action === "reject" ? `ปฏิเสธ "${dialog.item.item_title}"` : `อนุมัติ "${dialog.item.item_title}"`}
                    description={dialog.action === "reject"
                        ? "ตอนนี้จะไม่ถูกเผยแพร่ นักเขียนจะได้รับแจ้งเตือนพร้อมเหตุผล และแก้ไขแล้วส่งตรวจใหม่ได้"
                        : `ระบบพบ${dialog.item.verdict ? VERDICT_LABEL[dialog.item.verdict] : ""} กรุณาระบุเหตุผลที่ตัดสินว่าเผยแพร่ได้ (บันทึกในประวัติแอดมินและแจ้งนักเขียน)`}
                    confirmText={dialog.action === "reject" ? "ยืนยันปฏิเสธ" : "ยืนยันอนุมัติ"}
                    danger={dialog.action === "reject"}
                    onClose={() => setDialog(null)}
                    onSubmit={(reason) => decide(dialog.item, dialog.action, reason)}
                />
            )}
            {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
        </div>
    );
}

// Flagged comic pages first; the rest behind "ดูทุกหน้า". Private /api/media images, so plain <img>.
function PageThumbs({ pages, flagged, onOpen }: { pages: { url: string; number: number }[]; flagged: Set<number>; onOpen: (p: { url: string; number: number }) => void }) {
    const [all, setAll] = useState(false);
    const shown = all ? pages : pages.filter((p) => flagged.has(p.number));
    return (
        <div>
            <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{flagged.size > 0 ? `หน้าที่มีปัญหา: ${[...flagged].sort((a, b) => a - b).join(", ")}` : "ไม่ได้ระบุหน้าที่มีปัญหา"}</p>
                <button type="button" onClick={() => setAll(!all)} className="text-sm text-indigo-700 dark:text-indigo-400 hover:underline whitespace-nowrap">
                    {all ? "แสดงเฉพาะหน้าที่มีปัญหา" : `ดูทุกหน้า (${pages.length})`}
                </button>
            </div>
            {shown.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {shown.map((p) => (
                        <button key={p.number} type="button" onClick={() => onOpen(p)} className={`relative flex-shrink-0 w-24 rounded-lg overflow-hidden border-2 ${flagged.has(p.number) ? "border-red-600" : "border-gray-200 dark:border-gray-700"}`} title={`เปิดหน้า ${p.number}`}>
                            <img src={p.url} alt={`หน้า ${p.number}`} loading="lazy" className="w-full h-32 object-cover" />
                            <span className={`absolute bottom-0 inset-x-0 text-xs text-center text-white py-0.5 ${flagged.has(p.number) ? "bg-red-700" : "bg-black/60"}`}>หน้า {p.number}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
