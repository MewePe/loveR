"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Edit, Trash2, Save, X, GripVertical, Eye, Upload, ImageIcon } from 'lucide-react';
import Image from 'next/image';

interface Episode {
    id: string;
    title: string;
    episode_order: number;
    views: number;
    created_at: string;
    page_count?: number;
}

interface Comic {
    id: string;
    title: string;
    description: string;
}

export default function EpisodeManagement() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const comicId = params.id as string;

    const [comic, setComic] = useState<Comic | null>(null);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingEpisode, setEditingEpisode] = useState<Episode | null>(null);
    const [formData, setFormData] = useState({ title: '' });
    const [saving, setSaving] = useState(false);

    // Image upload state
    const [pageFiles, setPageFiles] = useState<File[]>([]);
    const [pagePreviews, setPagePreviews] = useState<string[]>([]);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            fetchData();
        }
    }, [status, comicId]);

    async function fetchData() {
        setLoading(true);
        try {
            const comicRes = await fetch(`/api/comics/${comicId}`, { credentials: 'include' });
            if (comicRes.ok) {
                setComic(await comicRes.json());
            }

            const episodesRes = await fetch(`/api/comics/${comicId}/episodes`, { credentials: 'include' });
            if (episodesRes.ok) {
                setEpisodes(await episodesRes.json());
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    function openCreateModal() {
        setEditingEpisode(null);
        setFormData({ title: '' });
        setPageFiles([]);
        setPagePreviews([]);
        setShowModal(true);
    }

    function openEditModal(episode: Episode) {
        setEditingEpisode(episode);
        setFormData({ title: episode.title });
        setPageFiles([]);
        setPagePreviews([]);
        setShowModal(true);
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setPageFiles(prev => [...prev, ...files]);
            const previews = files.map(file => URL.createObjectURL(file));
            setPagePreviews(prev => [...prev, ...previews]);
        }
    }

    function removePagePreview(index: number) {
        setPageFiles(prev => prev.filter((_, i) => i !== index));
        setPagePreviews(prev => prev.filter((_, i) => i !== index));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);

        try {
            // Upload images first
            const uploadedUrls: string[] = [];
            for (const file of pageFiles) {
                const formData = new FormData();
                formData.append('file', file);
                const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include' });
                if (uploadRes.ok) {
                    const data = await uploadRes.json();
                    uploadedUrls.push(data.url);
                }
            }

            const url = editingEpisode
                ? `/api/comics/${comicId}/episodes/${editingEpisode.id}`
                : `/api/comics/${comicId}/episodes`;

            const res = await fetch(url, {
                method: editingEpisode ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: formData.title, pages: uploadedUrls }),
                credentials: 'include',
            });

            if (res.ok) {
                alert(editingEpisode ? 'แก้ไขตอนสำเร็จ' : 'เพิ่มตอนสำเร็จ');
                setShowModal(false);
                fetchData();
            } else {
                alert('เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(episodeId: string) {
        if (!confirm('ต้องการลบตอนนี้หรือไม่?')) return;

        try {
            const res = await fetch(`/api/comics/${comicId}/episodes/${episodeId}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (res.ok) {
                alert('ลบตอนสำเร็จ');
                fetchData();
            } else {
                alert('เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error(error);
        }
    }

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="max-w-4xl mx-auto p-6">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => router.push('/author')} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition">
                        <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">จัดการตอน</h1>
                        <p className="text-gray-500 dark:text-gray-400">{comic?.title}</p>
                    </div>
                    <button onClick={openCreateModal} className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-pink-700 transition">
                        <Plus className="w-5 h-5" />
                        เพิ่มตอนใหม่
                    </button>
                </div>

                {/* Episodes List */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                    {episodes.length > 0 ? (
                        <div className="divide-y dark:divide-gray-700">
                            {episodes.map((episode, index) => (
                                <div key={episode.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                    <div className="text-gray-400 dark:text-gray-500">
                                        <GripVertical className="w-5 h-5" />
                                    </div>
                                    <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/30 rounded-lg flex items-center justify-center text-pink-600 dark:text-pink-400 font-bold">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-medium text-gray-900 dark:text-white">{episode.title}</h3>
                                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            <span className="flex items-center gap-1">
                                                <Eye className="w-4 h-4" />
                                                {episode.views || 0} views
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <ImageIcon className="w-4 h-4" />
                                                {episode.page_count || 0} หน้า
                                            </span>
                                            <span>{new Date(episode.created_at).toLocaleDateString('th-TH')}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => router.push(`/author/comic/${comicId}/episodes/${episode.id}/pages`)} className="p-2 text-gray-400 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition">
                                            <ImageIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => openEditModal(episode)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition">
                                            <Edit className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleDelete(episode.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
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
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">ยังไม่มีตอน</h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-4">เริ่มเพิ่มตอนแรกของการ์ตูนกันเลย!</p>
                            <button onClick={openCreateModal} className="bg-pink-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-pink-700 transition">
                                เพิ่มตอนใหม่
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingEpisode ? 'แก้ไขตอน' : 'เพิ่มตอนใหม่'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อตอน</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none"
                                    placeholder="เช่น ตอนที่ 1: เริ่มต้นการผจญภัย"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">อัพโหลดรูปภาพ</label>
                                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
                                    <label className="flex flex-col items-center cursor-pointer py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition">
                                        <Upload className="w-10 h-10 text-gray-400 mb-2" />
                                        <span className="text-sm text-gray-500 dark:text-gray-400">คลิกเพื่อเลือกรูปภาพ</span>
                                        <span className="text-xs text-gray-400">รองรับหลายรูปภาพ</span>
                                        <input type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
                                    </label>

                                    {pagePreviews.length > 0 && (
                                        <div className="grid grid-cols-4 gap-3 mt-4">
                                            {pagePreviews.map((preview, index) => (
                                                <div key={index} className="relative aspect-[3/4] bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                                                    <Image src={preview} alt={`Page ${index + 1}`} fill className="object-cover" />
                                                    <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">{index + 1}</div>
                                                    <button type="button" onClick={() => removePagePreview(index)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                                    ยกเลิก
                                </button>
                                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-pink-700 transition disabled:opacity-50">
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
