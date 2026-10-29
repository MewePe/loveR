"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import StoryCover from "@/components/StoryCover";
import { BE_OFFSET, OLDEST_AGE, THAI_MONTHS } from "@/lib/age";

// 18+ age check shown instead of an 18+ story/chapter (the server decides when, lib/ageGate.ts). The birth date is
// sent to POST /api/age-verification, which works out the age and remembers a pass (account and/or cookie);
// on success the page re-renders with the content.
export default function AgeGate({ storyId, title, coverImage, kind }: { storyId: string; title: string; coverImage: string | null; kind: "novel" | "comic" }) {
    const router = useRouter();
    const thisYearBE = new Date().getFullYear() + BE_OFFSET;
    const years = useMemo(() => Array.from({ length: OLDEST_AGE + 1 }, (_, i) => thisYearBE - i), [thisYearBE]);
    const [day, setDay] = useState("");
    const [month, setMonth] = useState("");
    const [year, setYear] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [denied, setDenied] = useState(false);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const res = await fetch("/api/age-verification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ day: Number(day), month: Number(month), year: Number(year) }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) setError(data.error || "เกิดข้อผิดพลาด กรุณาลองใหม่");
            else if (data.allowed) router.refresh();
            else setDenied(true);
        } catch {
            setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
        } finally {
            setBusy(false);
        }
    }

    function goBack() {
        if (window.history.length > 1) router.back();
        else router.push("/");
    }

    const select = "w-full px-3 py-2.5 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-600";

    return (
        <div data-testid="age-gate" className="min-h-[calc(100vh-4rem)] bg-gray-100 dark:bg-gray-950 flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col sm:flex-row">
                <div className="sm:w-56 flex-shrink-0 bg-gray-200 dark:bg-gray-800">
                    <div className="relative aspect-[2/3] max-h-72 sm:max-h-none mx-auto">
                        {/* Blurred with the 18+ badge, the same as on the story cards */}
                        <StoryCover id={storyId} title={title} src={coverImage} type={kind} mature />
                    </div>
                </div>
                <div className="flex-1 p-6 sm:p-8">
                    {denied ? (
                        <div role="alert">
                            <ShieldAlert className="w-10 h-10 text-red-600 dark:text-red-400 mb-3" />
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">ขออภัย คุณไม่สามารถเข้าถึงเนื้อหานี้ได้</h1>
                            <p className="text-gray-600 dark:text-gray-300 mb-6">
                                {kind === "novel" ? "นิยาย" : "การ์ตูน"}เรื่อง &quot;{title}&quot; สำหรับผู้มีอายุ 18 ปีขึ้นไปเท่านั้น
                            </p>
                            <button type="button" onClick={goBack} className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">
                                กลับ
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={submit}>
                            <span className="inline-block px-2.5 py-0.5 mb-3 rounded-full bg-red-700 text-white text-xs font-bold">18+</span>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">เนื้อหานี้อาจไม่เหมาะสำหรับผู้มีอายุต่ำกว่า 18 ปี</h1>
                            <p className="text-gray-600 dark:text-gray-300 mb-6">
                                &quot;{title}&quot; มีเนื้อหาสำหรับผู้ใหญ่ เช่น ฉากทางเพศ ภาษาหยาบคาย หรือความรุนแรง กรุณาระบุวันเกิดของคุณเพื่อยืนยันอายุ
                            </p>
                            <fieldset>
                                <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">วันเกิด</legend>
                                <div className="grid grid-cols-[1fr_1.6fr_1.3fr] gap-2">
                                    <label>
                                        <span className="sr-only">วัน</span>
                                        <select required value={day} onChange={(e) => setDay(e.target.value)} className={select}>
                                            <option value="">วัน</option>
                                            {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                                        </select>
                                    </label>
                                    <label>
                                        <span className="sr-only">เดือน</span>
                                        <select required value={month} onChange={(e) => setMonth(e.target.value)} className={select}>
                                            <option value="">เดือน</option>
                                            {THAI_MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
                                        </select>
                                    </label>
                                    <label>
                                        <span className="sr-only">ปี พ.ศ.</span>
                                        <select required value={year} onChange={(e) => setYear(e.target.value)} className={select}>
                                            <option value="">ปี พ.ศ.</option>
                                            {years.map((y) => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </label>
                                </div>
                            </fieldset>
                            {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
                            <div className="flex flex-wrap gap-3 mt-6">
                                <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50">
                                    {busy ? "กำลังตรวจสอบ..." : "ยืนยันและดูเนื้อหา"}
                                </button>
                                <Link href="/" className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
                                    ยกเลิก
                                </Link>
                            </div>
                            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                                ข้อมูลนี้ใช้ยืนยันอายุเท่านั้น และจะไม่แสดงต่อผู้อื่น
                            </p>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
