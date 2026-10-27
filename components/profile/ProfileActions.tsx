"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HeartHandshake, Pencil, Share2, UserCheck, UserPlus } from 'lucide-react';
import { useToast } from '@/components/Toast';
import SupportDialog from '@/components/profile/SupportDialog';

// Follow / support / share buttons on /profile/[username]. After a change the server page is refreshed so the
// follower count and top fans re-render from the database.
export default function ProfileActions({ authorId, authorName, isOwner, loggedIn, initiallyFollowing }: {
    authorId: string; authorName: string; isOwner: boolean; loggedIn: boolean; initiallyFollowing: boolean;
}) {
    const router = useRouter();
    const toast = useToast();
    const [following, setFollowing] = useState(initiallyFollowing);
    const [busy, setBusy] = useState(false);
    const [supportOpen, setSupportOpen] = useState(false);

    function requireLogin() {
        if (loggedIn) return true;
        router.push('/login');
        return false;
    }

    async function toggleFollow() {
        if (!requireLogin()) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/authors/${authorId}/follow`, { method: following ? 'DELETE' : 'POST', credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.error || 'เกิดข้อผิดพลาด');
                return;
            }
            setFollowing(data.following);
            toast.success(data.following ? `ติดตาม ${authorName} แล้ว` : `เลิกติดตาม ${authorName} แล้ว`);
            router.refresh();
        } finally {
            setBusy(false);
        }
    }

    async function share() {
        const url = window.location.href;
        try {
            if (navigator.share) {
                await navigator.share({ title: `${authorName} | LoveRead`, url });
                return;
            }
            await navigator.clipboard.writeText(url);
            toast.success('คัดลอกลิงก์โปรไฟล์แล้ว');
        } catch (error) {
            // Closing the share sheet throws AbortError; that's not a failure
            if ((error as Error)?.name !== 'AbortError') toast.error('แชร์ไม่สำเร็จ ลองคัดลอกลิงก์จากแถบที่อยู่แทน');
        }
    }

    const base = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition disabled:opacity-50';

    return (
        <div className="flex flex-wrap items-center gap-2">
            {isOwner ? (
                <Link href="/author?tab=public-profile" className={`${base} bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600`}>
                    <Pencil className="w-4 h-4" /> แก้ไขโปรไฟล์
                </Link>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={toggleFollow}
                        disabled={busy}
                        aria-pressed={following}
                        className={`${base} ${following
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                    >
                        {following ? <><UserCheck className="w-4 h-4" /> กำลังติดตาม</> : <><UserPlus className="w-4 h-4" /> ติดตาม</>}
                    </button>
                    <button
                        type="button"
                        onClick={() => requireLogin() && setSupportOpen(true)}
                        className={`${base} bg-pink-600 text-white hover:bg-pink-700`}
                    >
                        <HeartHandshake className="w-4 h-4" /> สนับสนุน
                    </button>
                </>
            )}
            <button
                type="button"
                onClick={share}
                title="แชร์โปรไฟล์"
                aria-label="แชร์โปรไฟล์"
                className={`${base} px-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700`}
            >
                <Share2 className="w-4 h-4" />
            </button>

            {supportOpen && (
                <SupportDialog
                    authorId={authorId}
                    authorName={authorName}
                    onClose={() => setSupportOpen(false)}
                    onSent={() => { setSupportOpen(false); router.refresh(); }}
                />
            )}
        </div>
    );
}
