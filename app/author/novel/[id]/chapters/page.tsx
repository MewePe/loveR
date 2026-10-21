"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Edit, Trash2, Save, X, GripVertical, Eye } from 'lucide-react';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';

interface Chapter {
    id: string;
    title: string;
    content: string;
    chapter_order: number;
    views: number;
    price: number;
    created_at: string;
}

interface Novel {
    id: string;
    title: string;
    description: string;
}

export default function ChapterManagement() {
    const toast = useToast();
    const confirm = useConfirm();
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const novelId = params.id as string;

    const [novel, setNovel] = useState<Novel | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
    const [formData, setFormData] = useState({ title: '', content: '', price: 0 });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            fetchData();
        }
    }, [status, novelId]);

    async function fetchData() {
        setLoading(true);
        try {
            // Fetch novel info
            const novelRes = await fetch(`/api/novels/${novelId}`, { credentials: 'include' });
            if (novelRes.ok) {
                setNovel(await novelRes.json());
            }

            // Fetch chapters
            const chaptersRes = await fetch(`/api/novels/${novelId}/chapters`, { credentials: 'include' });
            if (chaptersRes.ok) {
                setChapters(await chaptersRes.json());
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    function openCreateModal() {
        setEditingChapter(null);
        setFormData({ title: '', content: '', price: 0 });
        setShowModal(true);
    }

    function openEditModal(chapter: Chapter) {
        setEditingChapter(chapter);
        setFormData({ title: chapter.title, content: chapter.content || '', price: chapter.price || 0 });
        setShowModal(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);

        try {
            const url = editingChapter
                ? `/api/novels/${novelId}/chapters/${editingChapter.id}`
                : `/api/novels/${novelId}/chapters`;

            const res = await fetch(url, {
                method: editingChapter ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
                credentials: 'include',
            });

            if (res.ok) {
                toast.success(editingChapter ? 'แก้ไขบทสำเร็จ' : 'เพิ่มบทสำเร็จ');
                setShowModal(false);
                fetchData();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(chapterId: string) {
        if (!(await confirm('ต้องการลบบทนี้หรือไม่?', { danger: true }))) return;

        try {
            const res = await fetch(`/api/novels/${novelId}/chapters/${chapterId}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (res.ok) {
                toast.success('ลบบทสำเร็จ');
                fetchData();
            } else {
                toast.error('เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error(error);
        }
    }

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="max-w-4xl mx-auto p-6">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => router.push('/author')}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">จัดการบท</h1>
                        <p className="text-gray-500 dark:text-gray-400">{novel?.title}</p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
                    >
                        <Plus className="w-5 h-5" />
                        เพิ่มบทใหม่
                    </button>
                </div>

                {/* Chapters List */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                    {chapters.length > 0 ? (
                        <div className="divide-y dark:divide-gray-700">
                            {chapters.map((chapter, index) => (
                                <div key={chapter.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                    <div className="text-gray-400 dark:text-gray-500">
                                        <GripVertical className="w-5 h-5" />
                                    </div>
                                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-medium text-gray-900 dark:text-white">{chapter.title}</h3>
                                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            <span className="flex items-center gap-1">
                                                <Eye className="w-4 h-4" />
                                                {chapter.views || 0} views
                                            </span>
                                            <span className={chapter.price > 0 ? 'text-amber-600 dark:text-amber-400' : ''}>
                                                {chapter.price > 0 ? `🔒 ${chapter.price} เหรียญ` : 'ฟรี'}
                                            </span>
                                            <span>{new Date(chapter.created_at).toLocaleDateString('th-TH')}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openEditModal(chapter)}
                                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition"
                                        >
                                            <Edit className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(chapter.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Plus className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">ยังไม่มีบท</h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-4">เริ่มเขียนบทแรกของนิยายกันเลย!</p>
                            <button
                                onClick={openCreateModal}
                                className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
                            >
                                เพิ่มบทใหม่
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingChapter ? 'แก้ไขบท' : 'เพิ่มบทใหม่'}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    ชื่อบท
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="เช่น บทที่ 1: จุดเริ่มต้น"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    ราคา (เหรียญ)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    max={10000}
                                    step={1}
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                                    className="w-40 px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">0 = อ่านฟรี (1 เหรียญ = 1 บาท)</span>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    เนื้อหา
                                </label>
                                <textarea
                                    required
                                    rows={15}
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                    placeholder="เขียนเนื้อหาบทที่นี่..."
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                                >
                                    <Save className="w-5 h-5" />
                                    {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
