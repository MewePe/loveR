"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";

// Shared building blocks for the admin panels (components/admin/*)

export const card = "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700";
export const input = "px-3 py-2 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white";
export const th = "px-4 py-3 whitespace-nowrap";
export const td = "px-4 py-3 text-sm text-gray-500 dark:text-gray-400";
export const thead = "bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs";
export const rowHover = "hover:bg-gray-50 dark:hover:bg-gray-700/50";

export const baht = (n: number | string) => Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH");
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

const TONES = {
    green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    gray: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    pink: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "gray", children }: { tone?: Tone; children: React.ReactNode }) {
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${TONES[tone]}`}>{children}</span>;
}

// Status badges used by several panels
const STATUS: Record<string, [string, Tone]> = {
    PENDING: ["รอตรวจสอบ", "yellow"],
    APPROVED: ["อนุมัติแล้ว", "green"],
    REJECTED: ["ปฏิเสธ", "red"],
    COMPLETED: ["สำเร็จ", "green"],
    RESOLVED: ["จัดการแล้ว", "green"],
    IGNORED: ["ไม่ดำเนินการ", "gray"],
    PUBLISHED: ["เผยแพร่", "green"],
    DRAFT: ["ฉบับร่าง", "gray"],
    ARCHIVED: ["ซ่อน", "yellow"],
    BANNED: ["ถูกแบน", "red"],
};
export function StatusBadge({ status }: { status: string }) {
    const [label, tone] = STATUS[status] ?? [status, "gray" as Tone];
    return <Badge tone={tone}>{label}</Badge>;
}

// Small red count for menus and sub-tabs; nothing when 0
export function CountBadge({ count, className = "" }: { count?: number; className?: string }) {
    if (!count) return null;
    return (
        <span className={`min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold inline-flex items-center justify-center ${className}`} aria-label={`${count} รายการรอดำเนินการ`}>
            {count > 99 ? "99+" : count}
        </span>
    );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
                {subtitle && <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{subtitle}</p>}
            </div>
            {children}
        </div>
    );
}

// Button with an icon and a visible text label (the label is also the tooltip)
const BUTTON_TONES = {
    neutral: "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700",
    green: "bg-green-700 text-white hover:bg-green-800",
    red: "bg-red-600 text-white hover:bg-red-700",
    indigo: "bg-indigo-600 text-white hover:bg-indigo-700",
    amber: "bg-amber-400 text-amber-950 hover:bg-amber-500",
} as const;
export function ActionButton({ icon: Icon, label, onClick, tone = "neutral", disabled, title, small = true }: {
    icon?: React.ComponentType<{ className?: string }>; label: string; onClick?: () => void; tone?: keyof typeof BUTTON_TONES;
    disabled?: boolean; title?: string; small?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title ?? label}
            className={`inline-flex items-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${small ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm"} ${BUTTON_TONES[tone]}`}
        >
            {Icon && <Icon className={small ? "w-3.5 h-3.5" : "w-4 h-4"} />}
            {label}
        </button>
    );
}

export function SubTabs<K extends string>({ tabs, value, onChange }: {
    tabs: { key: K; label: string; count?: number }[]; value: K; onChange: (key: K) => void;
}) {
    return (
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] -mx-1 px-1 pb-1" role="tablist">
            {tabs.map((t) => (
                <button
                    key={t.key}
                    role="tab"
                    aria-selected={value === t.key}
                    onClick={() => onChange(t.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap flex-shrink-0 ${value === t.key ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700"}`}
                >
                    {t.label}
                    <CountBadge count={t.count} />
                </button>
            ))}
        </div>
    );
}

export function Pagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (page: number) => void }) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
            <span>ทั้งหมด {total.toLocaleString("th-TH")} รายการ</span>
            {pages > 1 && (
                <div className="flex items-center gap-2">
                    <button onClick={() => onChange(page - 1)} disabled={page <= 1} className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700" title="หน้าก่อนหน้า" aria-label="หน้าก่อนหน้า"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="whitespace-nowrap">หน้า {page} / {pages}</span>
                    <button onClick={() => onChange(page + 1)} disabled={page >= pages} className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700" title="หน้าถัดไป" aria-label="หน้าถัดไป"><ChevronRight className="w-4 h-4" /></button>
                </div>
            )}
        </div>
    );
}

export function EmptyRow({ colSpan, text = "ไม่พบข้อมูล" }: { colSpan: number; text?: string }) {
    return <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">{text}</td></tr>;
}

// Dialog shell: closes on the backdrop or Escape unless `busy`
export function Modal({ title, onClose, busy, children, wide, labelId = "admin-modal-title" }: {
    title: string; onClose: () => void; busy?: boolean; children: React.ReactNode; wide?: boolean; labelId?: string;
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [busy, onClose]);
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => !busy && onClose()}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelId}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 ${wide ? "max-w-3xl" : "max-w-md"}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 mb-4">
                    <h2 id={labelId} className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
                    <button onClick={onClose} disabled={busy} className="p-1 -m-1 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="ปิด" title="ปิด"><X className="w-5 h-5" /></button>
                </div>
                {children}
            </div>
        </div>
    );
}

// Ask for a reason, then run onSubmit. The dialog's own button is the confirmation step.
export function ReasonDialog({ title, description, placeholder, confirmText, required = true, danger = true, onSubmit, onClose }: {
    title: string; description?: string; placeholder?: string; confirmText: string; required?: boolean; danger?: boolean;
    onSubmit: (reason: string) => Promise<boolean>; onClose: () => void;
}) {
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    return (
        <Modal title={title} onClose={onClose} busy={busy} labelId="reason-dialog-title">
            <form
                onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    const ok = await onSubmit(reason.trim());
                    setBusy(false);
                    if (ok) onClose();
                }}
            >
                {description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 whitespace-pre-line">{description}</p>}
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="reason-dialog-input">
                    เหตุผล{required ? "" : " (ไม่บังคับ)"}
                </label>
                <textarea
                    id="reason-dialog-input"
                    autoFocus
                    rows={4}
                    maxLength={500}
                    required={required}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={placeholder}
                    className={`w-full ${input}`}
                />
                <div className="flex justify-end gap-3 mt-4">
                    <button type="button" disabled={busy} onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50">ยกเลิก</button>
                    <button type="submit" disabled={busy || (required && !reason.trim())} className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                        {busy ? "กำลังบันทึก..." : confirmText}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// Full-screen slip/document viewer. Private /api/media images, so a plain <img> (no next/image optimizer).
export function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
    const [zoom, setZoom] = useState(false);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    return (
        <div className="fixed inset-0 z-[70] bg-black/85 flex flex-col" onClick={onClose} role="dialog" aria-modal="true" aria-label={alt}>
            <div className="flex items-center justify-end gap-2 p-3" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setZoom(!zoom)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 text-sm">
                    {zoom ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}{zoom ? "พอดีจอ" : "ขยาย"}
                </button>
                <a href={src} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 text-sm">เปิดในแท็บใหม่</a>
                <button onClick={onClose} className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20" aria-label="ปิด" title="ปิด"><X className="w-5 h-5" /></button>
            </div>
            <div className={`flex-1 overflow-auto flex ${zoom ? "items-start justify-start" : "items-center justify-center"} p-3`}>
                <img
                    src={src}
                    alt={alt}
                    onClick={(e) => { e.stopPropagation(); setZoom(!zoom); }}
                    className={zoom ? "max-w-none cursor-zoom-out" : "max-w-full max-h-full object-contain cursor-zoom-in"}
                />
            </div>
        </div>
    );
}

// Date range inputs used by the payment and log filters
export function DateRange({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
    return (
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <label className="flex items-center gap-2">ตั้งแต่<input type="date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} className={`${input} py-1.5`} /></label>
            <label className="flex items-center gap-2">ถึง<input type="date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} className={`${input} py-1.5`} /></label>
            {(from || to) && <button onClick={() => onChange("", "")} className="text-indigo-700 dark:text-indigo-400 hover:underline">ล้างวันที่</button>}
        </div>
    );
}

// Build a query string from the non-empty values
export function qs(params: Record<string, string | number | undefined | null>) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    return sp.toString();
}

// fetch JSON or show the API's Thai error message via the given callback; returns null on failure
export async function fetchJson<T>(url: string, onError?: (message: string) => void, init?: RequestInit): Promise<T | null> {
    try {
        const res = await fetch(url, { credentials: "include", ...init });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            onError?.(data.error || "เกิดข้อผิดพลาด กรุณาลองใหม่");
            return null;
        }
        return data as T;
    } catch {
        onError?.("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
        return null;
    }
}

export function sendJson<T = { success?: boolean }>(url: string, method: string, body: unknown, onError?: (message: string) => void) {
    return fetchJson<T>(url, onError, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
