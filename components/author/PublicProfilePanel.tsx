"use client";
import Link from 'next/link';
import { ExternalLink, Pencil } from 'lucide-react';

// "โปรไฟล์สาธารณะ" tab of /author. The profile (avatar, cover, name, @username, bio, social links) is now edited for
// every user at /profile/edit, so this tab only points there.
export default function PublicProfilePanel() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">โปรไฟล์สาธารณะ</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">หน้าที่ผู้อ่านเห็นเมื่อกดชื่อของคุณ: รูปปก รูปโปรไฟล์ ชื่อ @username แนะนำตัว ลิงก์โซเชียล ผลงาน และแฟนตัวยง</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-wrap gap-3">
                <Link href="/profile/edit" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">
                    <Pencil className="w-4 h-4" /> แก้ไขโปรไฟล์
                </Link>
                <Link href="/profile" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-100 dark:hover:bg-gray-700">
                    <ExternalLink className="w-4 h-4" /> ดูหน้าโปรไฟล์
                </Link>
            </div>
        </div>
    );
}
