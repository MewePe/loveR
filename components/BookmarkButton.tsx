"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";

interface BookmarkButtonProps {
    contentType: "novel" | "comic";
    contentId: string;
    className?: string;
    accentColor?: string; // indigo or pink
}

export default function BookmarkButton({ contentType, contentId, className = "", accentColor = "indigo" }: BookmarkButtonProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const [bookmarked, setBookmarked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [animating, setAnimating] = useState(false);

    useEffect(() => {
        if (session?.user) {
            checkBookmark();
        } else {
            setLoading(false);
        }
    }, [session, contentType, contentId]);

    async function checkBookmark() {
        try {
            const res = await fetch(`/api/bookmarks?content_type=${contentType}&content_id=${contentId}`);
            if (res.ok) {
                const data = await res.json();
                setBookmarked(data.bookmarked);
            } else {
                setBookmarked(false);
            }
        } catch (error) {
            console.error(error);
            setBookmarked(false);
        } finally {
            setLoading(false);
        }
    }

    async function toggleBookmark() {
        if (!session?.user) {
            router.push("/login");
            return;
        }

        setAnimating(true);
        try {
            const method = bookmarked ? "DELETE" : "POST";
            const res = await fetch("/api/bookmarks", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content_type: contentType, content_id: contentId }),
            });

            if (res.ok) {
                const data = await res.json();
                setBookmarked(data.bookmarked);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setTimeout(() => setAnimating(false), 300);
        }
    }

    const colors = {
        indigo: {
            active: "bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700",
            inactive: "bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-indigo-600 hover:text-indigo-600 dark:hover:border-indigo-400 dark:hover:text-indigo-400",
        },
        pink: {
            active: "bg-pink-600 border-pink-600 text-white hover:bg-pink-700",
            inactive: "bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-pink-600 hover:text-pink-600 dark:hover:border-pink-400 dark:hover:text-pink-400",
        },
    };

    const colorSet = colors[accentColor as keyof typeof colors] || colors.indigo;

    return (
        <button
            onClick={toggleBookmark}
            disabled={loading}
            className={`px-8 py-3 rounded-lg font-bold transition flex items-center gap-2 ${bookmarked ? colorSet.active : colorSet.inactive
                } ${animating ? "scale-110" : "scale-100"} transform transition-all duration-200 ${loading ? "opacity-50 cursor-wait" : ""
                } ${className}`}
        >
            <Bookmark
                className={`w-5 h-5 transition-transform duration-200 ${animating ? "scale-125" : ""}`}
                fill={bookmarked ? "currentColor" : "none"}
            />
            {bookmarked ? "อยู่ในชั้นหนังสือแล้ว" : "เพิ่มไปยังชั้นหนังสือ"}
        </button>
    );
}
