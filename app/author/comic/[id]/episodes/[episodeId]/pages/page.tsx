"use client";
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft, Plus, Trash2, GripVertical, Upload,
    ImageIcon, Save, Loader2, Check, X, MoveUp, MoveDown
} from 'lucide-react';
import Image from 'next/image';
import { useConfirm } from '@/components/ConfirmDialog';

interface ComicPage {
    id: string;
    image_url: string;
    page_order: number;
    episode_id: string;
}

interface Episode {
    id: string;
    title: string;
    comic_id: string;
}

export default function PageManagement() {
    const confirm = useConfirm();
    const { status } = useSession();
    const router = useRouter();
    const params = useParams();
    const comicId = params.id as string;
    const episodeId = params.episodeId as string;

    const [episode, setEpisode] = useState<Episode | null>(null);
    const [pages, setPages] = useState<ComicPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // New files queued for upload
    const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
    const [queuedPreviews, setQueuedPreviews] = useState<string[]>([]);

    const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, episodeId]);

    async function fetchData() {
        setLoading(true);
        try {
            const epRes = await fetch(
                `/api/comics/${comicId}/episodes/${episodeId}`,
                { credentials: 'include' }
            );
            if (epRes.ok) setEpisode(await epRes.json());

            const pagesRes = await fetch(
                `/api/comics/${comicId}/episodes/${episodeId}/pages`,
                { credentials: 'include' }
            );
            if (pagesRes.ok) setPages(await pagesRes.json());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    // ---------- Queue management ----------
    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files) return;
        const files = Array.from(e.target.files);
        setQueuedFiles(prev => [...prev, ...files]);
        setQueuedPreviews(prev => [
            ...prev,
            ...files.map(f => URL.createObjectURL(f)),
        ]);
        e.target.value = '';
    }

    function removeQueued(index: number) {
        URL.revokeObjectURL(queuedPreviews[index]);
        setQueuedFiles(prev => prev.filter((_, i) => i !== index));
        setQueuedPreviews(prev => prev.filter((_, i) => i !== index));
    }

    // ---------- Upload queued files ----------
    async function handleUpload() {
        if (queuedFiles.length === 0) return;
        setUploading(true);
        try {
            const uploadedUrls: string[] = [];
            for (const file of queuedFiles) {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('purpose', 'comic-page');
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: fd,
                    credentials: 'include',
                });
                if (res.ok) {
                    const data = await res.json();
                    uploadedUrls.push(data.url);
                } else {
                    showToast('อัปโหลดรูปบางรูปล้มเหลว', 'error');
                }
            }

            if (uploadedUrls.length > 0) {
                const saveRes = await fetch(
                    `/api/comics/${comicId}/episodes/${episodeId}/pages`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageUrls: uploadedUrls }),
                        credentials: 'include',
                    }
                );
                if (saveRes.ok) {
                    showToast(`อัปโหลดสำเร็จ ${uploadedUrls.length} หน้า`);
                    setQueuedFiles([]);
                    setQueuedPreviews([]);
                    fetchData();
                } else {
                    showToast('บันทึกหน้าล้มเหลว', 'error');
                }
            }
        } catch (err) {
            console.error(err);
            showToast('เกิดข้อผิดพลาด', 'error');
        } finally {
            setUploading(false);
        }
    }

    // ---------- Delete a saved page ----------
    async function handleDeletePage(pageId: string) {
        if (!(await confirm('ต้องการลบหน้านี้หรือไม่?', { danger: true }))) return;
        try {
            const res = await fetch(
                `/api/comics/${comicId}/episodes/${episodeId}/pages?pageId=${pageId}`,
                { method: 'DELETE', credentials: 'include' }
            );
            if (res.ok) {
                showToast('ลบหน้าสำเร็จ');
                fetchData();
            } else {
                showToast('ลบหน้าล้มเหลว', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('เกิดข้อผิดพลาด', 'error');
        }
    }

    // ---------- Reorder helpers ----------
    function movePage(index: number, direction: 'up' | 'down') {
        const newPages = [...pages];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= newPages.length) return;
        [newPages[index], newPages[swapIndex]] = [newPages[swapIndex], newPages[index]];
        setPages(newPages.map((p, i) => ({ ...p, page_order: i + 1 })));
        setIsDirty(true);
    }

    async function handleSaveOrder() {
        setSaving(true);
        try {
            const res = await fetch(
                `/api/comics/${comicId}/episodes/${episodeId}/pages`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pages: pages.map(p => ({ id: p.id, page_order: p.page_order })),
                    }),
                    credentials: 'include',
                }
            );
            if (res.ok) {
                showToast('บันทึกลำดับสำเร็จ');
                setIsDirty(false);
            } else {
                showToast('บันทึกลำดับล้มเหลว', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('เกิดข้อผิดพลาด', 'error');
        } finally {
            setSaving(false);
        }
    }

    // ---------- Loading & auth guard ----------
    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Toast notification */}
            {toast && (
                <div
                    className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all duration-300
                        ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
                >
                    {toast.type === 'success'
                        ? <Check className="w-4 h-4" />
                        : <X className="w-4 h-4" />}
                    {toast.msg}
                </div>
            )}

            <div className="max-w-5xl mx-auto p-6">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => router.push(`/author/comic/${comicId}/episodes`)}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            จัดการหน้าการ์ตูน
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 truncate">
                            {episode?.title}
                        </p>
                    </div>

                    {/* Save order button — visible only when order changed */}
                    {isDirty && (
                        <button
                            onClick={handleSaveOrder}
                            disabled={saving}
                            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
                        >
                            {saving
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Save className="w-4 h-4" />}
                            บันทึกลำดับ
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* ── Left: Upload panel ── */}
                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-5 sticky top-6">
                            <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                                <Plus className="w-5 h-5 text-pink-500" />
                                อัปโหลดหน้าใหม่
                            </h2>

                            {/* Drop zone */}
                            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 cursor-pointer hover:border-pink-400 dark:hover:border-pink-500 transition group">
                                <Upload className="w-8 h-8 text-gray-400 group-hover:text-pink-500 transition mb-2" />
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                    คลิกเพื่อเลือกรูปภาพ
                                </span>
                                <span className="text-xs text-gray-400 mt-1">
                                    รองรับหลายรูปพร้อมกัน
                                </span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={handleFileSelect}
                                />
                            </label>

                            {/* Queued preview grid */}
                            {queuedPreviews.length > 0 && (
                                <div className="mt-4 grid grid-cols-3 gap-2">
                                    {queuedPreviews.map((src, i) => (
                                        <div
                                            key={i}
                                            className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 group"
                                        >
                                            <Image
                                                src={src}
                                                alt={`preview-${i}`}
                                                fill
                                                className="object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition" />
                                            <button
                                                type="button"
                                                onClick={() => removeQueued(i)}
                                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                            <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                                                {i + 1}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Upload button */}
                            <button
                                onClick={handleUpload}
                                disabled={queuedFiles.length === 0 || uploading}
                                className="mt-4 w-full flex items-center justify-center gap-2 bg-pink-600 text-white py-2.5 rounded-lg font-medium hover:bg-pink-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        กำลังอัปโหลด...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        อัปโหลด{queuedFiles.length > 0 ? ` (${queuedFiles.length})` : ''}
                                    </>
                                )}
                            </button>

                            {/* Stats */}
                            <div className="mt-4 pt-4 border-t dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 space-y-1">
                                <div className="flex justify-between">
                                    <span>หน้าที่มีอยู่</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {pages.length} หน้า
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>รออัปโหลด</span>
                                    <span className="font-semibold text-pink-600">
                                        {queuedFiles.length} รูป
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Right: Pages list ── */}
                    <div className="lg:col-span-2 space-y-3">
                        {pages.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-16 text-center">
                                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <ImageIcon className="w-10 h-10 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                    ยังไม่มีหน้าการ์ตูน
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">
                                    เลือกรูปภาพจากแผงซ้ายแล้วกดอัปโหลด
                                </p>
                            </div>
                        ) : (
                            <>
                                {isDirty && (
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                                        <Save className="w-4 h-4 flex-shrink-0" />
                                        ลำดับหน้าถูกเปลี่ยน กด
                                        <strong className="mx-1">บันทึกลำดับ</strong>
                                        เพื่อยืนยัน
                                    </div>
                                )}

                                {pages.map((page, index) => (
                                    <div
                                        key={page.id}
                                        className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-3 flex items-center gap-4 hover:shadow-sm transition group"
                                    >
                                        {/* Grip */}
                                        <GripVertical className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0" />

                                        {/* Page number badge */}
                                        <div className="w-9 h-9 bg-pink-100 dark:bg-pink-900/30 rounded-lg flex items-center justify-center text-pink-600 dark:text-pink-400 font-bold text-sm flex-shrink-0">
                                            {index + 1}
                                        </div>

                                        {/* Thumbnail */}
                                        <div className="relative w-16 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 border dark:border-gray-600">
                                            <Image
                                                src={page.image_url}
                                                alt={`หน้า ${index + 1}`}
                                                fill
                                                // private pages need the viewer's cookies, which the image optimizer doesn't send
                                                unoptimized
                                                className="object-cover"
                                            />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 dark:text-white text-sm">
                                                หน้าที่ {index + 1}
                                            </p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                                                {page.image_url.split('/').pop()}
                                            </p>
                                        </div>

                                        {/* Actions — visible on hover */}
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                            <button
                                                onClick={() => movePage(index, 'up')}
                                                disabled={index === 0}
                                                title="เลื่อนขึ้น"
                                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                <MoveUp className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => movePage(index, 'down')}
                                                disabled={index === pages.length - 1}
                                                title="เลื่อนลง"
                                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                <MoveDown className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeletePage(page.id)}
                                                title="ลบหน้านี้"
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
