"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldQuestion } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

// "รายงานว่าติดป้ายผิด" on the reader pages: sends this chapter/episode back to the admin content check queue
// (POST /api/moderation/report). The item stays readable unless the re-check finds a problem.
export default function MislabelReportButton({ itemType, itemId, loggedIn }: { itemType: "chapter" | "episode"; itemId: string; loggedIn: boolean }) {
    const toast = useToast();
    const confirm = useConfirm();
    const [done, setDone] = useState(false);
    const [busy, setBusy] = useState(false);
    const what = itemType === "chapter" ? "บท" : "ตอน";
    const className = "inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-red-700 dark:hover:text-red-400 hover:underline disabled:opacity-60 disabled:no-underline";

    if (!loggedIn) {
        return (
            <Link href="/login" className={className}>
                <ShieldQuestion className="w-4 h-4" />เข้าสู่ระบบเพื่อรายงานว่าติดป้ายผิด
            </Link>
        );
    }

    async function report() {
        const ok = await confirm(
            `รายงานว่า${what}นี้ติดป้ายระดับเนื้อหาผิด? เช่น มีเนื้อหา 18+ แต่ติดป้ายทั่วไป ระบบจะตรวจ${what}นี้ใหม่และส่งให้แอดมินพิจารณา`,
            { confirmText: "รายงาน" }
        );
        if (!ok) return;
        setBusy(true);
        try {
            const res = await fetch("/api/moderation/report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ item_type: itemType, item_id: itemId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.error || "รายงานไม่สำเร็จ กรุณาลองใหม่");
                return;
            }
            setDone(true);
            toast.success(data.queued ? "ส่งรายงานแล้ว แอดมินจะตรวจสอบ" : `${what}นี้อยู่ในคิวตรวจของแอดมินแล้ว`);
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
        } finally {
            setBusy(false);
        }
    }

    return (
        <button type="button" onClick={report} disabled={busy || done} className={className}>
            <ShieldQuestion className="w-4 h-4" />
            {done ? "รายงานแล้ว" : "รายงานว่าติดป้ายผิด"}
        </button>
    );
}
