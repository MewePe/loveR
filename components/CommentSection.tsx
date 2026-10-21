"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Reply, Trash2, User } from "lucide-react";
import ReportButton from "@/components/ReportButton";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

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
    replies?: Comment[]; // top-level comments only; replies are one level deep
}

const MAX_LENGTH = 1000;

const ACCENTS = {
    indigo: { button: "bg-indigo-600 hover:bg-indigo-700", ring: "focus:ring-indigo-500", badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
    pink: { button: "bg-pink-600 hover:bg-pink-700", ring: "focus:ring-pink-500", badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" },
};

export default function CommentSection({ contentType, contentId, accentColor = "indigo" }: CommentSectionProps) {
    const toast = useToast();
    const { data: session, status } = useSession();
    const confirm = useConfirm();
    const accent = ACCENTS[accentColor];
    const [comments, setComments] = useState<Comment[]>([]);
    const [totalAll, setTotalAll] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState("");
    const [posting, setPosting] = useState(false);
    // Reply form open under one top-level comment
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState("");

    const load = useCallback(async (pageToLoad: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/comments?content_type=${contentType}&content_id=${contentId}&page=${pageToLoad}`);
            if (!res.ok) return;
            const data = await res.json();
            // Skip ones already shown: new comments shift the pages while reading
            setComments((prev) => (pageToLoad === 1 ? data.comments : [...prev, ...data.comments.filter((n: Comment) => !prev.some((c) => c.id === n.id))]));
            setTotalAll(data.total_with_replies);
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

    // Posts a comment (or a reply when parentId is set). Returns the created comment, or null on failure.
    async function post(body: string, parentId?: string): Promise<Comment | null> {
        setPosting(true);
        try {
            const res = await fetch("/api/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content_type: contentType, content_id: contentId, body, parent_id: parentId }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "เกิดข้อผิดพลาด");
                return null;
            }
            return data.comment;
        } catch (error) {
            console.error(error);
            toast.error("เกิดข้อผิดพลาด");
            return null;
        } finally {
            setPosting(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!text.trim()) return;
        if (await post(text)) {
            setText("");
            await load(1);
        }
    }

    async function handleReply(e: React.FormEvent, parentId: string) {
        e.preventDefault();
        if (!replyText.trim()) return;
        const reply = await post(replyText, parentId);
        if (reply) {
            setComments((prev) => prev.map((c) => (c.id === parentId ? { ...c, replies: [...(c.replies ?? []), reply] } : c)));
            setTotalAll((t) => t + 1);
            setReplyTo(null);
            setReplyText("");
        }
    }

    async function handleDelete(target: Comment, parentId?: string) {
        const hasReplies = !parentId && (target.replies?.length ?? 0) > 0;
        const message = hasReplies ? "ลบความคิดเห็นนี้? คำตอบกลับทั้งหมดจะถูกลบด้วย" : "ลบความคิดเห็นนี้?";
        if (!(await confirm(message, { danger: true, confirmText: "ลบ" }))) return;
        const res = await fetch(`/api/comments/${target.id}`, { method: "DELETE" });
        if (!res.ok) {
            toast.error("ลบไม่สำเร็จ");
            return;
        }
        if (parentId) {
            setComments((prev) => prev.map((c) => (c.id === parentId ? { ...c, replies: c.replies?.filter((r) => r.id !== target.id) } : c)));
            setTotalAll((t) => t - 1);
        } else {
            setComments((prev) => prev.filter((c) => c.id !== target.id));
            setTotalAll((t) => t - 1 - (target.replies?.length ?? 0));
        }
    }

    function renderComment(c: Comment, parentId?: string) {
        const small = !!parentId;
        return (
            <div className="flex gap-3">
                <div className={`${small ? "w-8 h-8" : "w-10 h-10"} rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center`}>
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
                                <button onClick={() => handleDelete(c, parentId)} title="ลบความคิดเห็น" className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </span>
                    </div>
                    {/* Plain text only, never HTML */}
                    <p className="mt-1 text-gray-700 dark:text-gray-300 whitespace-pre-line break-words">{c.body}</p>
                    {!parentId && session?.user && (
                        <button
                            onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText(""); }}
                            className="mt-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            <Reply className="w-4 h-4" /> ตอบกลับ
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <section id="comments" className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <MessageCircle className="w-6 h-6" /> ความคิดเห็น ({totalAll})
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
                    <div key={c.id} className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                        {renderComment(c)}

                        {((c.replies?.length ?? 0) > 0 || replyTo === c.id) && (
                            <div className="mt-4 ml-6 sm:ml-12 pl-4 border-l-2 border-gray-100 dark:border-gray-700 space-y-4">
                                {c.replies?.map((r) => <div key={r.id}>{renderComment(r, c.id)}</div>)}
                                {replyTo === c.id && (
                                    <form onSubmit={(e) => handleReply(e, c.id)}>
                                        <textarea
                                            autoFocus
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            maxLength={MAX_LENGTH}
                                            rows={2}
                                            placeholder={`ตอบกลับ ${c.user_name || "ผู้ใช้"}...`}
                                            className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:ring-2 ${accent.ring} outline-none resize-none text-sm`}
                                        />
                                        <div className="flex justify-end gap-2 mt-2">
                                            <button type="button" onClick={() => setReplyTo(null)} className="px-3 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                                                ยกเลิก
                                            </button>
                                            <button type="submit" disabled={posting || !replyText.trim()} className={`px-4 py-1.5 text-sm text-white rounded-lg font-medium disabled:opacity-50 ${accent.button}`}>
                                                {posting ? "กำลังส่ง..." : "ตอบกลับ"}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
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
