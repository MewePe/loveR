"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { BookOpen, FileText, CheckCircle, Ban, Eye } from 'lucide-react';
import Link from 'next/link';

interface ContentItem {
    id: string;
    title: string;
    author_name: string;
    status: string;
    created_at: string;
}

export default function AdminContent() {
    const { data: session } = useSession();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'novels' | 'comics'>('novels');
    const [items, setItems] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (session?.user?.role !== 'ADMIN') return;
        fetchContent();
    }, [session, activeTab]);

    async function fetchContent() {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/content?type=${activeTab}`);
            if (res.ok) {
                const data = await res.json();
                setItems(data);
            }
        } finally {
            setLoading(false);
        }
    }

    async function updateStatus(id: string, newStatus: string) {
        if (!confirm(`Change status to ${newStatus}?`)) return;

        try {
            const res = await fetch(`/api/admin/content/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, type: activeTab }),
            });

            if (res.ok) {
                fetchContent();
            } else {
                alert('Failed to update status');
            }
        } catch (error) {
            console.error(error);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Management</h1>
                    <Link href="/admin" className="text-indigo-600 hover:underline">Back to Dashboard</Link>
                </div>

                {/* Tabs */}
                <div className="flex space-x-4 mb-6">
                    <button
                        onClick={() => setActiveTab('novels')}
                        className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === 'novels'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4" /> Novels
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('comics')}
                        className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === 'comics'
                            ? 'bg-pink-600 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" /> Comics
                        </div>
                    </button>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase">
                                <tr>
                                    <th className="px-6 py-3">Title</th>
                                    <th className="px-6 py-3">Author</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Created</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {items.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            {item.title}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                            {item.author_name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                ${item.status === 'PUBLISHED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                                    item.status === 'BANNED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <Link href={`/${activeTab === 'novels' ? 'novel' : 'comic'}/${item.id}`} target="_blank" className="text-gray-400 hover:text-blue-600 transition inline-block" title="View">
                                                <Eye className="w-4 h-4" />
                                            </Link>
                                            {item.status !== 'PUBLISHED' && (
                                                <button
                                                    onClick={() => updateStatus(item.id, 'PUBLISHED')}
                                                    className="text-gray-400 hover:text-green-600 transition"
                                                    title="Approve"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                            {item.status !== 'BANNED' && (
                                                <button
                                                    onClick={() => updateStatus(item.id, 'BANNED')}
                                                    className="text-gray-400 hover:text-red-600 transition"
                                                    title="Ban"
                                                >
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {items.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                            No content found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
