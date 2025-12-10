"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Trash2, Plus, Tag } from 'lucide-react';
import Link from 'next/link';

interface Category {
    id: string;
    name: string;
    slug: string;
}

export default function AdminCategories() {
    const { data: session } = useSession();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [newCategory, setNewCategory] = useState({ name: '', slug: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (session?.user?.role !== 'ADMIN') return;
        fetchCategories();
    }, [session]);

    async function fetchCategories() {
        try {
            const res = await fetch('/api/admin/categories');
            if (res.ok) {
                const data = await res.json();
                setCategories(data);
            }
        } finally {
            setLoading(false);
        }
    }

    async function handleAddCategory(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/admin/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCategory),
            });

            if (res.ok) {
                setNewCategory({ name: '', slug: '' });
                fetchCategories();
            } else {
                const json = await res.json();
                alert(json.error || 'Failed to create category');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this category?')) return;

        try {
            const res = await fetch(`/api/admin/categories/${id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                fetchCategories();
            } else {
                alert('Failed to delete category');
            }
        } catch (error) {
            console.error(error);
        }
    }

    // Auto-generate slug from name
    function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
        const name = e.target.value;
        const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
        setNewCategory({ name, slug });
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Category Management</h1>
                    <Link href="/admin" className="text-indigo-600 hover:underline">Back to Dashboard</Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Add Category Form */}
                    <div className="md:col-span-1">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700 sticky top-24">
                            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                                <Plus className="w-5 h-5" /> Add Category
                            </h2>
                            <form onSubmit={handleAddCategory} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newCategory.name}
                                        onChange={handleNameChange}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="e.g. Romance"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug</label>
                                    <input
                                        type="text"
                                        required
                                        value={newCategory.slug}
                                        onChange={(e) => setNewCategory({ ...newCategory, slug: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="e.g. romance"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Adding...' : 'Add Category'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Categories List */}
                    <div className="md:col-span-2">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                            <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                <h3 className="font-medium text-gray-700 dark:text-gray-300">All Categories</h3>
                            </div>
                            <div className="divide-y dark:divide-gray-700">
                                {categories.map((category) => (
                                    <div key={category.id} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                                                <Tag className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">{category.name}</div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">/{category.slug}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(category.id)}
                                            className="text-gray-400 hover:text-red-600 transition p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                                {categories.length === 0 && !loading && (
                                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                        No categories found. Add one to get started.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
