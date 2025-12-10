"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateNovel() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);

        const data = {
            title: formData.get('title'),
            description: formData.get('description'),
            categoryId: formData.get('categoryId'), // In real app, fetch categories
            coverImage: 'https://placehold.co/400x600', // Mock for now, or implement upload
        };

        try {
            const res = await fetch('/api/novels', {
                method: 'POST',
                body: JSON.stringify(data),
            });

            if (res.ok) {
                const json = await res.json();
                router.push(`/author/novel/${json.id}`); // Redirect to edit/dashboard
            } else {
                alert('Failed to create novel');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Create New Novel</h1>
            <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border dark:border-gray-700">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                    <input name="title" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white dark:bg-gray-700 dark:border-gray-600" placeholder="Enter novel title" />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Synopsis</label>
                    <textarea name="description" required rows={4} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white dark:bg-gray-700 dark:border-gray-600" placeholder="What is your story about?" />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                    <select name="categoryId" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white dark:bg-gray-700 dark:border-gray-600">
                        <option value="">Select Category</option>
                        <option value="1">Romance</option>
                        <option value="2">Fantasy</option>
                        <option value="3">Action</option>
                    </select>
                </div>

                <button disabled={loading} type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition disabled:opacity-50">
                    {loading ? 'Creating...' : 'Create Novel'}
                </button>
            </form>
        </div>
    );
}
