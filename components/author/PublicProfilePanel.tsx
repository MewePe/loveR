"use client";
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, ImagePlus, Trash2 } from 'lucide-react';
import { useToast } from '@/components/Toast';

// Same keys and labels as SOCIAL_PLATFORMS in lib/authors.ts (that module uses the database)
const SOCIALS = [
    { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/...' },
    { key: 'x', label: 'X', placeholder: 'https://x.com/...' },
    { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/...' },
    { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@...' },
    { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@...' },
    { key: 'website', label: 'เว็บไซต์', placeholder: 'https://...' },
] as const;
const MAX_BIO = 1000;
const DEFAULT_COVER = '/images/default-cover.svg';

type Socials = Partial<Record<typeof SOCIALS[number]['key'], string>>;

// "โปรไฟล์สาธารณะ" tab: what readers see at /profile/<username> (username, banner, bio, social links).
// Name and avatar are edited on /profile.
export default function PublicProfilePanel() {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [savedUsername, setSavedUsername] = useState('');
    const [form, setForm] = useState({ username: '', bio: '', cover_image: '' as string | null, social_links: {} as Socials });

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/author/public-profile', { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            setSavedUsername(data.username || '');
            setForm({ username: data.username || '', bio: data.bio || '', cover_image: data.cover_image, social_links: data.social_links || {} });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function uploadCover(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.error || 'อัปโหลดรูปไม่สำเร็จ');
                return;
            }
            setForm((f) => ({ ...f, cover_image: data.url }));
        } finally {
            setUploading(false);
        }
    }

    async function save(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/author/public-profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.error || 'บันทึกไม่สำเร็จ');
                return;
            }
            setSavedUsername(data.username);
            setForm((f) => ({ ...f, username: data.username }));
            toast.success('บันทึกโปรไฟล์แล้ว');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    const input = 'w-full px-3 py-2 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none';
    const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

    return (
        <div className="max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                    <span className="w-1 h-8 bg-indigo-600 rounded-full inline-block"></span>
                    โปรไฟล์สาธารณะ
                </h1>
                {savedUsername && (
                    <Link href={`/profile/${savedUsername}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-400 hover:underline">
                        ดูหน้าโปรไฟล์ <ExternalLink className="w-4 h-4" />
                    </Link>
                )}
            </div>

            <form onSubmit={save} className="space-y-6">
                <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700 space-y-4">
                    <div>
                        <p className={label}>รูปปก</p>
                        <div className="aspect-[3/1] rounded-lg overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 relative">
                            <img src={form.cover_image || DEFAULT_COVER} alt="ตัวอย่างรูปปกโปรไฟล์" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                <ImagePlus className="w-4 h-4" /> {uploading ? 'กำลังอัปโหลด...' : 'เปลี่ยนรูปปก'}
                                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={uploadCover} className="sr-only" />
                            </label>
                            {form.cover_image && (
                                <button type="button" onClick={() => setForm({ ...form, cover_image: null })} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                                    <Trash2 className="w-4 h-4" /> ใช้ภาพเริ่มต้น
                                </button>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400">แนะนำ 1500x500 px, JPG/PNG/WEBP/GIF ไม่เกิน 10MB</span>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="pp-username" className={label}>ชื่อผู้ใช้ (ใช้ในลิงก์โปรไฟล์)</label>
                        <div className="flex items-center rounded-lg border bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-indigo-500">
                            <span className="pl-3 text-gray-500 dark:text-gray-300">@</span>
                            <input
                                id="pp-username"
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                                pattern="[a-z0-9_]{3,30}"
                                required
                                className="w-full px-2 py-2 rounded-lg bg-transparent text-gray-900 dark:text-white outline-none"
                            />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">3-30 ตัว ใช้ได้เฉพาะ a-z, 0-9 และ _ (เปลี่ยนแล้วลิงก์เดิมจะใช้ไม่ได้)</p>
                    </div>

                    <div>
                        <label htmlFor="pp-bio" className={label}>ข้อความแนะนำตัว</label>
                        <textarea
                            id="pp-bio"
                            rows={5}
                            maxLength={MAX_BIO}
                            value={form.bio}
                            onChange={(e) => setForm({ ...form, bio: e.target.value })}
                            placeholder="เล่าให้ผู้อ่านรู้จักคุณ เช่น แนวที่ชอบเขียน วันที่ลงตอนใหม่"
                            className={input}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-right">{form.bio.length}/{MAX_BIO}</p>
                    </div>
                </section>

                <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">ลิงก์โซเชียล</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">ใส่เฉพาะที่ต้องการแสดง ต้องขึ้นต้นด้วย https://</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {SOCIALS.map(({ key, label: name, placeholder }) => (
                            <div key={key}>
                                <label htmlFor={`pp-${key}`} className={label}>{name}</label>
                                <input
                                    id={`pp-${key}`}
                                    type="url"
                                    value={form.social_links[key] || ''}
                                    onChange={(e) => setForm({ ...form, social_links: { ...form.social_links, [key]: e.target.value } })}
                                    placeholder={placeholder}
                                    className={input}
                                />
                            </div>
                        ))}
                    </div>
                </section>

                <div className="flex justify-end">
                    <button type="submit" disabled={saving || uploading} className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
                        {saving ? 'กำลังบันทึก...' : 'บันทึกโปรไฟล์'}
                    </button>
                </div>
            </form>
        </div>
    );
}
