"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { User, Mail, Calendar, BookOpen, ImageIcon, Save, Camera, Eye, Heart, Bookmark } from 'lucide-react';
import Image from 'next/image';

interface UserProfile {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: string;
    created_at: string;
}

interface Stats {
    novelsRead: number;
    comicsRead: number;
    bookmarks: number;
}

export default function ProfilePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [stats, setStats] = useState<Stats>({ novelsRead: 0, comicsRead: 0, bookmarks: 0 });
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({ name: '' });
    const [saving, setSaving] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            fetchProfile();
        }
    }, [status]);

    async function fetchProfile() {
        setLoading(true);
        try {
            const res = await fetch('/api/profile', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setProfile(data.user);
                setStats(data.stats);
                setFormData({ name: data.user.name || '' });
                if (data.user.image) setAvatarPreview(data.user.image);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files && e.target.files[0]) {
            setAvatarFile(e.target.files[0]);
            setAvatarPreview(URL.createObjectURL(e.target.files[0]));
        }
    }

    async function handleSave() {
        setSaving(true);
        try {
            let imageUrl = profile?.image || null;

            if (avatarFile) {
                const formData = new FormData();
                formData.append('file', avatarFile);
                const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include' });
                if (uploadRes.ok) {
                    const data = await uploadRes.json();
                    imageUrl = data.url;
                }
            }

            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: formData.name, image: imageUrl }),
                credentials: 'include',
            });

            if (res.ok) {
                alert('บันทึกข้อมูลสำเร็จ');
                setEditing(false);
                fetchProfile();
            } else {
                alert('เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error(error);
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

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
            <div className="container mx-auto px-4 max-w-4xl">
                {/* Profile Header */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border dark:border-gray-700 overflow-hidden">
                    {/* Cover */}
                    <div className="h-32 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

                    {/* Avatar & Info */}
                    <div className="px-6 pb-6">
                        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 -mt-16">
                            {/* Avatar */}
                            <div className="relative">
                                <div className="w-32 h-32 rounded-full bg-white dark:bg-gray-700 border-4 border-white dark:border-gray-800 shadow-lg overflow-hidden">
                                    {avatarPreview ? (
                                        <Image src={avatarPreview} alt="Avatar" fill className="object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
                                            <User className="w-16 h-16" />
                                        </div>
                                    )}
                                </div>
                                {editing && (
                                    <label className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full cursor-pointer hover:bg-indigo-700 transition shadow-lg">
                                        <Camera className="w-5 h-5" />
                                        <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                                    </label>
                                )}
                            </div>

                            {/* Name & Role */}
                            <div className="flex-1 text-center md:text-left">
                                {editing ? (
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="text-2xl font-bold bg-transparent border-b-2 border-indigo-500 outline-none text-gray-900 dark:text-white w-full max-w-xs"
                                        placeholder="ชื่อของคุณ"
                                    />
                                ) : (
                                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{profile?.name || 'ไม่ระบุชื่อ'}</h1>
                                )}
                                <p className="text-gray-500 dark:text-gray-400 flex items-center justify-center md:justify-start gap-2 mt-1">
                                    <Mail className="w-4 h-4" />
                                    {profile?.email}
                                </p>
                                <div className="flex items-center justify-center md:justify-start gap-4 mt-2">
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${profile?.role === 'ADMIN' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : profile?.role === 'AUTHOR' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                                        {profile?.role === 'ADMIN' ? '👑 Admin' : profile?.role === 'AUTHOR' ? '✍️ นักเขียน' : '👤 ผู้อ่าน'}
                                    </span>
                                    <span className="text-sm text-gray-400 flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        เข้าร่วมเมื่อ {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('th-TH') : '-'}
                                    </span>
                                </div>
                            </div>

                            {/* Edit Button */}
                            <div>
                                {editing ? (
                                    <div className="flex gap-2">
                                        <button onClick={() => { setEditing(false); setAvatarPreview(profile?.image || null); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                                            ยกเลิก
                                        </button>
                                        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50">
                                            <Save className="w-4 h-4" />
                                            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                                        </button>
                                    </div>
                                ) : (
                                    <button onClick={() => setEditing(true)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">
                                        แก้ไขโปรไฟล์
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border dark:border-gray-700 text-center">
                        <BookOpen className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.novelsRead}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">นิยายที่อ่าน</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border dark:border-gray-700 text-center">
                        <ImageIcon className="w-8 h-8 text-pink-500 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.comicsRead}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">การ์ตูนที่อ่าน</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border dark:border-gray-700 text-center">
                        <Bookmark className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.bookmarks}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">บุ๊กมาร์ก</p>
                    </div>
                </div>

                {/* Quick Links */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 mt-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">เมนูลัด</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <a href="/bookmarks" className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                            <Bookmark className="w-5 h-5 text-yellow-500" />
                            <span className="text-gray-700 dark:text-gray-300">บุ๊กมาร์ก</span>
                        </a>
                        <a href="/history" className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                            <Eye className="w-5 h-5 text-blue-500" />
                            <span className="text-gray-700 dark:text-gray-300">ประวัติการอ่าน</span>
                        </a>
                        {profile?.role === 'AUTHOR' && (
                            <a href="/author" className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                                <BookOpen className="w-5 h-5 text-purple-500" />
                                <span className="text-gray-700 dark:text-gray-300">หน้านักเขียน</span>
                            </a>
                        )}
                        {profile?.role === 'ADMIN' && (
                            <a href="/admin" className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                                <User className="w-5 h-5 text-red-500" />
                                <span className="text-gray-700 dark:text-gray-300">แอดมิน</span>
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
