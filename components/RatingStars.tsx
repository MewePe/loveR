"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { useToast } from "@/components/Toast";

interface RatingStarsProps {
    contentType: "novel" | "comic";
    contentId: string;
}

interface RatingSummary {
    average: number | null;
    count: number;
    mine: number | null;
    can_rate: boolean;
}

// Average rating plus the viewer's own 1-5 star rating (click the same star again to remove it)
export default function RatingStars({ contentType, contentId }: RatingStarsProps) {
    const toast = useToast();
    const { data: session, status } = useSession();
    const router = useRouter();
    const [summary, setSummary] = useState<RatingSummary | null>(null);
    const [hover, setHover] = useState(0);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (status === "loading") return;
        fetch(`/api/ratings?content_type=${contentType}&content_id=${contentId}`)
            .then((res) => (res.ok ? res.json() : null))
            .then(setSummary)
            .catch(console.error);
    }, [status, contentType, contentId]);

    async function rate(score: number) {
        if (!session?.user) {
            router.push("/login");
            return;
        }
        if (!summary?.can_rate || saving) return;

        setSaving(true);
        try {
            const remove = summary.mine === score;
            const res = await fetch("/api/ratings", {
                method: remove ? "DELETE" : "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content_type: contentType, content_id: contentId, score }),
            });
            const data = await res.json();
            if (res.ok) setSummary(data);
            else toast.error(data.error || "เกิดข้อผิดพลาด");
        } catch (error) {
            console.error(error);
        } finally {
            setSaving(false);
        }
    }

    if (!summary) return <div className="h-14 mb-6" />;

    // Logged-out visitors may click (and get sent to /login); authors viewing their own work only see the average
    const interactive = summary.can_rate || !session?.user;
    const shown = hover || summary.mine || 0;

    return (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-6">
            <div className="flex items-center gap-2">
                <Star className="w-6 h-6 text-yellow-400" fill="currentColor" />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{summary.average?.toFixed(1) ?? "-"}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">({summary.count.toLocaleString()} คะแนน)</span>
            </div>
            {interactive && (
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{summary.mine ? "คะแนนของคุณ" : "ให้คะแนน"}</span>
                    <div className="flex" onMouseLeave={() => setHover(0)}>
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button
                                key={n}
                                type="button"
                                disabled={saving}
                                onClick={() => rate(n)}
                                onMouseEnter={() => setHover(n)}
                                title={summary.mine === n ? "ยกเลิกคะแนน" : `${n} ดาว`}
                                className="p-0.5 disabled:opacity-50"
                            >
                                <Star
                                    className={`w-6 h-6 transition-colors ${n <= shown ? "text-yellow-400" : "text-gray-300 dark:text-gray-600"}`}
                                    fill={n <= shown ? "currentColor" : "none"}
                                />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
