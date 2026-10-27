import { Wrench } from 'lucide-react';
import Link from 'next/link';

export default function MaintenancePage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md text-center">
                <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Wrench className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">ระบบปิดปรับปรุงชั่วคราว</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    ขออภัยในความไม่สะดวก ขณะนี้เรากำลังปรับปรุงระบบ<br />
                    กรุณากลับมาใหม่อีกครั้งในภายหลัง
                </p>
                <Link href="/login" className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600">
                    เข้าสู่ระบบสำหรับผู้ดูแล
                </Link>
            </div>
        </div>
    );
}
