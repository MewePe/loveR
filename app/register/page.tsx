"use client";
// import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/Toast';

export default function Register() {
    const toast = useToast();
    const router = useRouter();
    // const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = formData.get('name');
        const email = formData.get('email');
        const password = formData.get('password');

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });

            if (res.ok) {
                router.push('/login');
            } else {
                const json = await res.json();
                toast.error(json.error || 'Registration failed');
            }
        } catch (err) {
            console.error(err);
            toast.error('An error occurred');
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border dark:border-gray-700">
                <h2 className="text-2xl font-bold text-center mb-6 text-indigo-600 dark:text-indigo-400">Join LoveRead</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                        <input name="name" type="text" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                        <input name="email" type="email" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                        <input name="password" type="password" required minLength={8} maxLength={72} placeholder="อย่างน้อย 8 ตัวอักษร" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition">
                        Sign Up
                    </button>
                </form>
                <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                    Already have an account? <Link href="/api/auth/signin" className="text-indigo-600 dark:text-indigo-400 hover:underline">Login</Link>
                </p>
            </div>
        </div>
    );
}
