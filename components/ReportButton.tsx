"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";

interface ReportButtonProps {
    targetType: "NOVEL" | "COMIC" | "COMMENT";
    targetId: string;
    compact?: boolean; // small icon-only button, e.g. next to a comment
}

const PRESET_REASONS = [
    "เนื้อหาไม่เหมาะสม / ลามกอนาจาร",
    "ละเมิดลิขสิทธิ์ / คัดลอกผลงาน",
    "ความรุนแรง / ยุยงให้เกิดความเกลียดชัง",
    "สแปม / โฆษณา",
];

export default function ReportButton({ targetType, targetId, compact = false }: ReportButtonProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(PRESET_REASONS[0]);
    const [details, setDetails] = useState("");
    const [submitting, setSubmitting] = useState(false);

    function handleOpen() {
        if (!session?.user) {
            router.push("/login");
            return;
        }
        setOpen(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        try {
            const reason = details.trim() ? `${selected}: ${details.trim()}` : selected;
            const res = await fetch("/api/reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ target_type: targetType, target_id: targetId, reason }),
            });
            const data = await res.json();
            if (res.ok) {
                alert("ส่งรายงานเรียบร้อย ขอบคุณที่ช่วยแจ้งให้เราทราบ");
                setOpen(false);
                setDetails("");
            } else {
                alert(data.error || "เกิดข้อผิดพลาด");
            }
        } catch (error) {
            console.error(error);
            alert("เกิดข้อผิดพลาด");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <>
            {compact ? (
                <button onClick={handleOpen} title="รายงานความคิดเห็น" className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                    <Flag className="w-4 h-4" />
                </button>
            ) : (
                <button
                    onClick={handleOpen}
                    title="รายงานเนื้อหา"
                    className="px-4 py-3 rounded-lg font-medium transition flex items-center gap-2 border-2 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-red-500 hover:text-red-600 dark:hover:border-red-400 dark:hover:text-red-400"
                >
                    <Flag className="w-5 h-5" />
                    <span className="hidden sm:inline">รายงาน</span>
                </button>
            )}

            {open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{targetType === "COMMENT" ? "รายงานความคิดเห็น" : "รายงานเนื้อหา"}</h2>
                        <div className="space-y-2 mb-4">
                            {PRESET_REASONS.map((r) => (
                                <label key={r} className="flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer">
                                    <input type="radio" name="reason" checked={selected === r} onChange={() => setSelected(r)} />
                                    {r}
                                </label>
                            ))}
                        </div>
                        <textarea
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            maxLength={500}
                            rows={3}
                            placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
                            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-red-500 outline-none resize-none mb-4"
                        />
                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                                ยกเลิก
                            </button>
                            <button type="submit" disabled={submitting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                                {submitting ? "กำลังส่ง..." : "ส่งรายงาน"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
}
