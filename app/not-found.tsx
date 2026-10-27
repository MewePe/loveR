import { SearchX } from 'lucide-react';
import Link from 'next/link';

// Shown for unknown URLs and wherever a page calls notFound() (e.g. unpublished stories, unknown categories).
// Replaces Next's English default.
export default function NotFound() {
    return (
        <div className="min-h-[70vh] bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md text-center">
                <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <SearchX className="w-10 h-10 text-indigo-700 dark:text-indigo-400" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">ไม่พบหน้าที่คุณต้องการ</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">หน้านี้อาจถูกลบ ย้ายไปที่อื่น หรือยังไม่เปิดให้อ่าน</p>
                <div className="flex justify-center gap-3">
                    <Link href="/" className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition">กลับหน้าแรก</Link>
                    <Link href="/search" className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition">ค้นหาเรื่อง</Link>
                </div>
            </div>
        </div>
    );
}
