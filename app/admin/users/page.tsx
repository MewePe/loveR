"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Search, Shield, Ban, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    created_at: string;
}

export default function AdminUsers() {
    const { data: session } = useSession();
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (session?.user?.role !== 'ADMIN') return;
        fetchUsers();
    }, [session, search]);

    async function fetchUsers() {
        try {
            const res = await fetch(`/api/admin/users?search=${search}`);
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } finally {
            setLoading(false);
        }
    }

    async function updateUserRole(id: string, newRole: string) {
        if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;

        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
            });

            if (res.ok) {
                fetchUsers();
            } else {
                alert('Failed to update user');
            }
        } catch (error) {
            console.error(error);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
                    <Link href="/admin" className="text-indigo-600 hover:underline">Back to Dashboard</Link>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                    <div className="p-4 border-b dark:border-gray-700">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search users..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase">
                                <tr>
                                    <th className="px-6 py-3">User</th>
                                    <th className="px-6 py-3">Role</th>
                                    <th className="px-6 py-3">Joined</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                                                    user.role === 'WRITER' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' :
                                                        user.role === 'BANNED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                                            'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            {user.role !== 'ADMIN' && (
                                                <>
                                                    <button
                                                        onClick={() => updateUserRole(user.id, 'ADMIN')}
                                                        className="text-gray-400 hover:text-purple-600 transition"
                                                        title="Promote to Admin"
                                                    >
                                                        <Shield className="w-4 h-4" />
                                                    </button>
                                                    {user.role === 'BANNED' ? (
                                                        <button
                                                            onClick={() => updateUserRole(user.id, 'READER')}
                                                            className="text-gray-400 hover:text-green-600 transition"
                                                            title="Unban"
                                                        >
                                                            <CheckCircle className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => updateUserRole(user.id, 'BANNED')}
                                                            className="text-gray-400 hover:text-red-600 transition"
                                                            title="Ban User"
                                                        >
                                                            <Ban className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
