"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart } from "lucide-react";

// Pages with their own full-height layout (dashboards with a fixed sidebar, the readers) don't get a footer
const HIDDEN = [/^\/admin/, /^\/author/, /^\/read\//, /^\/comic\/[^/]+\/read\//, /^\/maintenance/];

const COLUMNS = [
    { title: "สำรวจ", links: [["หน้าแรก", "/"], ["ค้นหาเรื่อง", "/search"], ["จัดอันดับ", "/ranking"], ["นิยายยอดนิยม", "/ranking?type=novel"], ["การ์ตูนยอดนิยม", "/ranking?type=comic"]] },
    { title: "นักอ่าน", links: [["เติมเหรียญ", "/coins"], ["ที่คั่นหน้า", "/bookmarks"], ["ประวัติการอ่าน", "/history"], ["แจ้งเตือน", "/notifications"]] },
    { title: "นักเขียน", links: [["สมัครเป็นนักเขียน", "/become-author"], ["ศูนย์นักเขียน", "/author"]] },
] as const;

export default function Footer() {
    const pathname = usePathname();
    if (HIDDEN.some((re) => re.test(pathname))) return null;
    return (
        <footer className="bg-gray-900 text-gray-300 dark:bg-gray-950 border-t border-gray-800">
            <div className="container mx-auto px-4 py-10 grid gap-8 grid-cols-2 md:grid-cols-4">
                <div className="col-span-2 md:col-span-1">
                    <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-white">
                        <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center"><Heart className="w-4 h-4 fill-white" aria-hidden="true" /></span>
                        LoveRead
                    </Link>
                    <p className="mt-3 text-sm text-gray-400 max-w-xs">อ่านนิยายและการ์ตูนออนไลน์ สนับสนุนนักเขียนที่คุณชอบ และเริ่มเขียนเรื่องของคุณเอง</p>
                </div>
                {COLUMNS.map((col) => (
                    <nav key={col.title} aria-label={col.title}>
                        <h2 className="text-sm font-semibold text-white mb-3">{col.title}</h2>
                        <ul className="space-y-2 text-sm">
                            {col.links.map(([label, href]) => (
                                <li key={href}><Link href={href} className="text-gray-400 hover:text-white transition">{label}</Link></li>
                            ))}
                        </ul>
                    </nav>
                ))}
            </div>
            <div className="border-t border-gray-800">
                <p className="container mx-auto px-4 py-4 text-xs text-gray-400">© {new Date().getFullYear()} LoveRead สงวนลิขสิทธิ์</p>
            </div>
        </footer>
    );
}
