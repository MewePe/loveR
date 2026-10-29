"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Camera, Check, ImagePlus, Loader2, Save, Trash2, User, X } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { USERNAME_MAX, isDefaultUsername, usernameProblem } from '@/lib/username';

// Same keys and labels as SOCIAL_PLATFORMS in lib/authors.ts (that module uses the database)
const SOCIALS = [
    { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/...' },
    { key: 'x', label: 'X', placeholder: 'https://x.com/...' },
    { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/...' },
    { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@...' },
    { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@...' },
    { key: 'website', label: 'เว็บไซต์', placeholder: 'https://...' },
] as const;
type Socials = Partial<Record<typeof SOCIALS[number]['key'], string>>;
// Same limits as lib/profile.ts
const MAX_NAME = 100;
const MAX_BIO = 1000;
const DEFAULT_COVER = '/images/default-cover.svg';

type Check = { state: 'idle' | 'checking' | 'ok' | 'current' | 'error'; message?: string };

const input = 'w-full px-3 py-2 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none';

// Edit your own profile (every user): avatar, cover, display name, @username (checked as you type), bio and
// social links → PATCH /api/profile, then back to your profile page.
export default function EditProfilePage() {
    const toast = useToast();
    const router = useRouter();
    const { status } = useSession();
    const [userId, setUserId] = useState('');
    const [savedUsername, setSavedUsername] = useState('');
    const [form, setForm] = useState({ name: '', username: '', bio: '', image: null as string | null, cover_image: null as string | null, social_links: {} as Socials });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState<'image' | 'cover_image' | null>(null);
    const [check, setCheck] = useState<Check>({ state: 'idle' });
    const checkSeq = useRef(0);
    const loaded = useRef<typeof form | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/profile', { credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.error || 'โหลดข้อมูลโปรไฟล์ไม่สำเร็จ');
                return;
            }
            const u = data.user;
            setUserId(u.id);
            setSavedUsername(u.username || '');
            const initial = { name: u.name || '', username: u.username || '', bio: u.bio || '', image: u.image, cover_image: u.cover_image, social_links: u.social_links || {} };
            loaded.current = initial;
            setForm(initial);
            setCheck({ state: 'current' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
        else if (status === 'authenticated') load();
    }, [status, router, load]);

    // Live username check: format rules right away, then "taken?" from the server after a short pause
    useEffect(() => {
        if (loading) return;
        const typed = form.username;
        if (typed === savedUsername) { setCheck({ state: 'current' }); return; }
        const problem = usernameProblem(typed, savedUsername);
        if (problem) { setCheck({ state: 'error', message: problem }); return; }
        setCheck({ state: 'checking' });
        const seq = ++checkSeq.current;
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/profile/username?username=${encodeURIComponent(typed)}`, { credentials: 'include' });
                const data = await res.json().catch(() => ({}));
                if (seq !== checkSeq.current) return; // a newer keystroke won
                if (!res.ok) setCheck({ state: 'error', message: data.error || 'ตรวจชื่อผู้ใช้ไม่สำเร็จ' });
                else if (data.available) setCheck({ state: data.current ? 'current' : 'ok', message: 'ใช้ชื่อนี้ได้' });
                else setCheck({ state: 'error', message: data.error });
            } catch {
                if (seq === checkSeq.current) setCheck({ state: 'error', message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' });
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [form.username, savedUsername, loading]);

    async function upload(field: 'image' | 'cover_image', e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploading(field);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.error || 'อัปโหลดรูปไม่สำเร็จ');
                return;
            }
            setForm((f) => ({ ...f, [field]: data.url }));
        } catch {
            toast.error('อัปโหลดรูปไม่สำเร็จ');
        } finally {
            setUploading(null);
        }
    }

    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (check.state === 'error' || check.state === 'checking') {
            toast.error(check.state === 'checking' ? 'กำลังตรวจชื่อผู้ใช้ กรุณารอสักครู่' : `ชื่อผู้ใช้: ${check.message}`);
            return;
        }
        // Only what changed (an untouched old value never blocks saving the rest)
        const changes = Object.fromEntries(Object.entries(form).filter(([key, value]) =>
            JSON.stringify(value) !== JSON.stringify(loaded.current?.[key as keyof typeof form])));
        if (Object.keys(changes).length === 0) {
            router.push(`/profile/${encodeURIComponent(savedUsername)}`);
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(changes),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.error || 'บันทึกไม่สำเร็จ');
                if (res.status === 409) setCheck({ state: 'error', message: data.error });
                return;
            }
            toast.success('บันทึกโปรไฟล์แล้ว');
            window.dispatchEvent(new Event('loveread:profile-updated')); // Navbar name/avatar
router.push(`/profile/${encodeURIComponent(data.username)}`);
            router.refresh();
        } catch {
            toast.error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่');
        } finally {
            setSaving(false);
        }
    }

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    const checkTone = check.state === 'error' ? 'text-red-700 dark:text-red-400' : check.state === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400';
    const stillDefault = isDefaultUsername(userId, form.username);

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
            <form onSubmit={save} className="container mx-auto max-w-3xl sm:px-4 sm:pt-6">
                <div className="flex items-center gap-3 px-4 sm:px-0 py-4 sm:pt-0">
                    <Link href={`/profile/${encodeURIComponent(savedUsername)}`} className="p-2 -ml-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800" aria-label="กลับไปหน้าโปรไฟล์" title="กลับไปหน้าโปรไฟล์">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">แก้ไขโปรไฟล์</h1>
                </div>

                {/* Cover + avatar, laid out like the profile page */}
                <section className="bg-white dark:bg-gray-800 sm:rounded-2xl shadow-sm border-y sm:border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="relative aspect-[5/2] sm:aspect-[3/1] bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600">
                        <img src={form.cover_image || DEFAULT_COVER} alt="" className="w-full h-full object-cover" />
                        <div className="absolute right-3 bottom-3 flex gap-2">
                            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/60 text-white text-sm font-medium cursor-pointer hover:bg-black/75 focus-within:ring-2 focus-within:ring-white">
                                {uploading === 'cover_image' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                                เปลี่ยนรูปปก
                                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => upload('cover_image', e)} disabled={!!uploading} />
                            </label>
                            {form.cover_image && (
                                <button type="button" onClick={() => setForm({ ...form, cover_image: null })} className="p-2 rounded-full bg-black/60 text-white hover:bg-black/75" aria-label="ลบรูปปก" title="ลบรูปปก">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="px-4 sm:px-6 pb-5">
                        <div className="flex items-end gap-3">
                            <div className="relative -mt-12 sm:-mt-16 shrink-0">
                                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full ring-4 ring-white dark:ring-gray-800 bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                                    {form.image ? <img src={form.image} alt="รูปโปรไฟล์" className="w-full h-full object-cover" /> : <User className="w-12 h-12 text-gray-500 dark:text-gray-400" />}
                                </div>
                                <label className="absolute bottom-0 right-0 p-2 rounded-full bg-indigo-600 text-white shadow cursor-pointer hover:bg-indigo-700 focus-within:ring-2 focus-within:ring-indigo-300" title="เปลี่ยนรูปโปรไฟล์">
                                    {uploading === 'image' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                                    <span className="sr-only">เปลี่ยนรูปโปรไฟล์</span>
                                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => upload('image', e)} disabled={!!uploading} />
                                </label>
                            </div>
                            {form.image && (
                                <button type="button" onClick={() => setForm({ ...form, image: null })} className="mb-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-700 dark:hover:text-red-400">
                                    ลบรูปโปรไฟล์
                                </button>
                            )}
                        </div>
                        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">รูปปกแนะนำขนาด 1500×500 รองรับ JPG, PNG, WEBP, GIF ไม่เกิน 10MB</p>
                    </div>
                </section>

                <section className="mt-4 sm:mt-6 bg-white dark:bg-gray-800 sm:rounded-2xl shadow-sm border-y sm:border border-gray-100 dark:border-gray-700 p-4 sm:p-6 space-y-5">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อที่แสดง</label>
                        <input id="name" required maxLength={MAX_NAME} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} placeholder="ชื่อของคุณ" />
                    </div>

                    <div id="username" className="scroll-mt-24">
                        <label htmlFor="username-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อผู้ใช้ (@username)</label>
                        {stillDefault && (
                            <p className="mb-2 text-sm text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2">
                                ตอนนี้ยังเป็นชื่ออัตโนมัติ ตั้งชื่อที่จำง่ายเพื่อให้คนอื่นค้นหาและแชร์โปรไฟล์ของคุณได้
                            </p>
                        )}
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">@</span>
                            <input
                                id="username-input"
                                value={form.username}
                                maxLength={USERNAME_MAX}
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                aria-describedby="username-help"
                                aria-invalid={check.state === 'error'}
                                // Lowercase as you type; other characters are kept so the rule message can explain them
                                onChange={(e) => setForm({ ...form, username: e.target.value.replace(/^@/, '').toLowerCase() })}
                                className={`${input} pl-7 pr-9 ${check.state === 'error' ? 'border-red-500 dark:border-red-500' : ''}`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true">
                                {check.state === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-gray-500 dark:text-gray-400" />}
                                {check.state === 'ok' && <Check className="w-4 h-4 text-green-700 dark:text-green-400" />}
                                {check.state === 'error' && <X className="w-4 h-4 text-red-700 dark:text-red-400" />}
                            </span>
                        </div>
                        <p id="username-help" aria-live="polite" className={`mt-1 text-xs ${checkTone}`}>
                            {check.state === 'checking' ? 'กำลังตรวจสอบ...'
                                : check.state === 'error' || check.state === 'ok' ? check.message
                                : 'a-z ตัวเล็ก, 0-9 และ _ ยาว 3-30 ตัว ลิงก์โปรไฟล์ของคุณจะเป็น /profile/ตามด้วยชื่อนี้'}
                        </p>
                    </div>

                    <div>
                        <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">แนะนำตัว</label>
                        <textarea id="bio" rows={4} maxLength={MAX_BIO} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className={`${input} resize-y`} placeholder="เล่าเกี่ยวกับตัวคุณสั้นๆ" />
                        <p className="mt-1 text-xs text-right text-gray-500 dark:text-gray-400">{form.bio.length}/{MAX_BIO}</p>
                    </div>

                    <fieldset>
                        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ลิงก์โซเชียล (ไม่บังคับ)</legend>
                        <div className="grid sm:grid-cols-2 gap-3">
                            {SOCIALS.map((s) => (
                                <label key={s.key} className="block">
                                    <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{s.label}</span>
                                    <input
                                        type="url"
                                        inputMode="url"
                                        value={form.social_links[s.key] ?? ''}
                                        onChange={(e) => setForm({ ...form, social_links: { ...form.social_links, [s.key]: e.target.value } })}
                                        placeholder={s.placeholder}
                                        className={input}
                                    />
                                </label>
                            ))}
                        </div>
                    </fieldset>
                </section>

                {/* Sticky on phones so the save button is always reachable */}
                <div className="sticky bottom-0 mt-4 sm:mt-6 px-4 sm:px-0 py-3 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur flex justify-end gap-3">
                    <Link href={`/profile/${encodeURIComponent(savedUsername)}`} className="px-5 py-2.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-100 dark:hover:bg-gray-800">
                        ยกเลิก
                    </Link>
                    <button type="submit" disabled={saving || !!uploading || check.state === 'error'} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50">
                        <Save className="w-4 h-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </form>
        </main>
    );
}
