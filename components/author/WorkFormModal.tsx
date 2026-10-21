"use client";
import { useState } from 'react';
import Image from 'next/image';
import { Trash2, Upload } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { Category, Work, WorkKind, WORK_KINDS } from './types';

interface WorkFormModalProps {
    kind: WorkKind;
    work?: Work; // edit this novel/comic; create a new one when omitted
    categories: Category[];
    onClose: () => void;
    onSaved: () => void;
}

// Create / edit form for a novel or comic: title, synopsis, cover (uploaded via /api/upload) and category
export default function WorkFormModal({ kind, work, categories, onClose, onSaved }: WorkFormModalProps) {
    const toast = useToast();
    const k = WORK_KINDS[kind];
    const [form, setForm] = useState({
        title: work?.title ?? '',
        description: work?.description || '',
        categoryId: work?.category_id || '',
    });
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(work?.cover_image || null);
    const [saving, setSaving] = useState(false);

    function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setCoverFile(file);
            setCoverPreview(URL.createObjectURL(file));
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            let coverImageUrl = work ? work.cover_image : null;
            if (coverFile) {
                const formData = new FormData();
                formData.append('file', coverFile);
                const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include' });
                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    coverImageUrl = uploadData.url;
                }
            }

            const res = await fetch(work ? `${k.api}/${work.id}` : k.api, {
                method: work ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: form.title, description: form.description, categoryId: form.categoryId, coverImage: coverImageUrl }),
                credentials: 'include',
            });

            if (res.ok) {
                toast.success(`${work ? 'แก้ไข' : 'สร้าง'}${k.label}สำเร็จ`);
                onSaved();
            } else {
                toast.error(work ? 'เกิดข้อผิดพลาด' : k.createError);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSaving(false);
        }
    }

    const inputClass = `w-full px-4 py-2 border rounded-lg focus:ring-2 ${k.ring} outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white`;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 w-full max-w-lg shadow-2xl max-h-full overflow-y-auto">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{work ? 'แก้ไข' : 'สร้าง'}{k.label}{work ? '' : 'ใหม่'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อ{k.label}</label>
                        <input
                            type="text"
                            required
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            className={inputClass}
                            placeholder={work ? undefined : `ชื่อ${k.label}ของคุณ`}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">เรื่องย่อ</label>
                        <textarea
                            required
                            rows={4}
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className={inputClass}
                            placeholder={work ? undefined : `เรื่องย่อ${k.label}`}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ปก{k.label}</label>
                        <div className="flex items-center gap-4">
                            {coverPreview ? (
                                <div className="relative w-24 h-32 rounded-lg overflow-hidden">
                                    <Image src={coverPreview} alt="Cover preview" fill className="object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => { setCoverFile(null); setCoverPreview(null); }}
                                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ) : (
                                <label className={`w-24 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer ${k.dropzone} transition`}>
                                    <Upload className="w-6 h-6 text-gray-400" />
                                    <span className="text-xs text-gray-400 mt-1">อัพโหลด</span>
                                    <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
                                </label>
                            )}
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                <p>รูปปก{k.label}</p>
                                <p className="text-xs">แนะนำ 400x600 px</p>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">หมวดหมู่ (ไม่บังคับ)</label>
                        <select
                            value={form.categoryId}
                            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                            className={inputClass}
                        >
                            <option value="">ไม่ระบุหมวดหมู่</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className={`flex-1 ${k.button} text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50`}
                        >
                            {work
                                ? (saving ? 'กำลังบันทึก...' : 'บันทึก')
                                : (saving ? 'กำลังสร้าง...' : `สร้าง${k.label}`)}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
