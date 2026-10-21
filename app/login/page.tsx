"use client";
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import Link from 'next/link';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const result = await signIn('credentials', { email, password, redirect: false });
            if (result?.error) {
                setError(result.code === 'rate_limited'
                    ? 'ล็อกอินผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่'
                    : 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
                return;
            }
            // Full navigation so every component picks up the new session
            window.location.href = '/';
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border dark:border-gray-700">
                <h2 className="text-2xl font-bold text-center mb-6 text-indigo-600 dark:text-indigo-400">เข้าสู่ระบบ</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">อีเมล</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white dark:bg-gray-700 dark:border-gray-600"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">รหัสผ่าน</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white dark:bg-gray-700 dark:border-gray-600"
                        />
                    </div>
                    {error && (
                        <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}
                    <button type="submit" disabled={submitting} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition disabled:opacity-50">
                        {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                    </button>
                </form>
                <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                    ยังไม่มีบัญชี? <Link href="/register" className="text-indigo-600 dark:text-indigo-400 hover:underline">สมัครสมาชิก</Link>
                </p>
            </div>
        </div>
    );
}
