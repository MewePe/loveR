"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Trash2, User } from "lucide-react";
import ReportButton from "@/components/ReportButton";
import { useConfirm } from "@/components/ConfirmDialog";

interface CommentSectionProps {
    contentType: "novel" | "comic";
    contentId: string;
    accentColor?: "indigo" | "pink";
}

interface Comment {
    id: string;
    body: string;
    created_at: string;
    user_name: string | null;
    user_image: string | null;
    is_author: boolean;
    is_mine: boolean;
    can_delete: boolean;
}

const MAX_LENGTH = 1000;

const ACCENTS = {
    indigo: { button: "bg-indigo-600 hover:bg-indigo-700", ring: "focus:ring-indigo-500", badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
    pink: { button: "bg-pink-600 hover:bg-pink-700", ring: "focus:ring-pink-500", badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" },
};

export default function CommentSection({ contentType, contentId, accentColor = "indigo" }: CommentSectionProps) {
    const { data: session, status } = useSession();
    const confirm = useConfirm();
    const accent = ACCENTS[accentColor];
    const [comments, setComments] = useState<Comment[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState("");
    const [posting, setPosting] = useState(false);

    const load = useCallback(async (pageToLoad: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/comments?content_type=${contentType}&content_id=${contentId}&page=${pageToLoad}`);
            if (!res.ok) return;
            const data = await res.json();
            // Skip ones already shown: new comments shift the pages while reading
            setComments((prev) => (pageToLoad === 1 ? data.comments : [...prev, ...data.comments.filter((n: Comment) => !prev.some((c) => c.id === n.id))]));
            setTotal(data.total);
            setPage(pageToLoad);
            setHasMore(pageToLoad * data.pageSize < data.total);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [contentType, contentId]);

    useEffect(() => {
        if (status !== "loading") load(1);
    }, [status, load]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!text.trim()) return;
        setPosting(true);
        try {
            const res = await fetch("/api/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content_type: contentType, content_id: contentId, body: text }),
            });
            const data = await res.json();
            if (res.ok) {
                setText("");
                await load(1);
            } else {
                alert(data.error || "เกิดข้อผิดพลาด");
            }
        } catch (error) {
            console.error(error);
            alert("เกิดข้อผิดพลาด");
        } finally {
            setPosting(false);
        }
    }

    async function handleDelete(id: string) {
        if (!(await confirm("ลบความคิดเห็นนี้?", { danger: true, confirmText: "ลบ" }))) return;
        const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
        if (res.ok) {
            setComments((prev) => prev.filter((c) => c.id !== id));
            setTotal((t) => t - 1);
        } else {
            alert("ลบไม่สำเร็จ");
        }
    }

    return (
        <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <MessageCircle className="w-6 h-6" /> ความคิดเห็น ({total})
            </h2>

            {session?.user ? (
                <form onSubmit={handleSubmit} className="mb-8">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        maxLength={MAX_LENGTH}
                        rows={3}
                        placeholder="แสดงความคิดเห็น..."
                        className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 ${accent.ring} outline-none resize-none`}
                    />
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">{text.length}/{MAX_LENGTH}</span>
                        <button type="submit" disabled={posting || !text.trim()} className={`px-5 py-2 text-white rounded-lg font-medium disabled:opacity-50 ${accent.button}`}>
                            {posting ? "กำลังส่ง..." : "ส่งความคิดเห็น"}
                        </button>
                    </div>
                </form>
            ) : (
                <p className="mb-8 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                    <Link href="/login" className="font-semibold underline">เข้าสู่ระบบ</Link> เพื่อแสดงความคิดเห็น
                </p>
            )}

            <div className="space-y-4">
                {comments.map((c) => (
                    <div key={c.id} className="flex gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center">
                            {c.user_image ? <img src={c.user_image} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-gray-400" />}
                        </div>
                        <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-900 dark:text-white">{c.user_name || "ผู้ใช้"}</span>
                                {c.is_author && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${accent.badge}`}>ผู้เขียน</span>}
                                <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString("th-TH")}</span>
                                <span className="ml-auto flex items-center gap-1">
                                    {!c.is_mine && session?.user && <ReportButton targetType="COMMENT" targetId={c.id} compact />}
                                    {c.can_delete && (
                                        <button onClick={() => handleDelete(c.id)} title="ลบความคิดเห็น" className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </span>
                            </div>
                            {/* Plain text only, never HTML */}
                            <p className="mt-1 text-gray-700 dark:text-gray-300 whitespace-pre-line break-words">{c.body}</p>
                        </div>
                    </div>
                ))}
                {!loading && comments.length === 0 && (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">ยังไม่มีความคิดเห็น</p>
                )}
            </div>

            {hasMore && (
                <div className="text-center mt-6">
                    <button onClick={() => load(page + 1)} disabled={loading} className="px-5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50">
                        {loading ? "กำลังโหลด..." : "ดูเพิ่มเติม"}
                    </button>
                </div>
            )}
        </section>
    );
}
