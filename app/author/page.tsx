"use client";
import { useEffect, useState } from 'react';
import { LayoutDashboard, BookOpen, DollarSign, Wallet, User, LogOut, Plus, Save, Upload, AlertCircle, Eye, Edit, Trash2, Send, FileText, MoreVertical, ImageIcon } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import EarningsPanel from '@/components/author/EarningsPanel';
import WalletPanel from '@/components/author/WalletPanel';
import { useConfirm } from '@/components/ConfirmDialog';

type TabType = 'dashboard' | 'novels' | 'comics' | 'earnings' | 'wallet' | 'profile';

const menuItems = [
    { name: 'ภาพรวมนักเขียน', key: 'dashboard' as TabType, icon: LayoutDashboard },
    { name: 'นิยายของฉัน', key: 'novels' as TabType, icon: BookOpen },
    { name: 'การ์ตูนของฉัน', key: 'comics' as TabType, icon: ImageIcon },
    { name: 'รายได้ของฉัน', key: 'earnings' as TabType, icon: DollarSign },
    { name: 'กระเป๋าเงินนักเขียน', key: 'wallet' as TabType, icon: Wallet },
    { name: 'ข้อมูลนักเขียน', key: 'profile' as TabType, icon: User },
];

export default function AuthorDashboard() {
    const confirm = useConfirm();
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>('dashboard');
    const [stats, setStats] = useState({ novels: 0, comics: 0, views: 0 });
    const [novels, setNovels] = useState<any[]>([]);
    const [profile, setProfile] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [files, setFiles] = useState<{ id_card?: File, bank_book?: File }>({});
    const [previews, setPreviews] = useState<{ id_card?: string, bank_book?: string }>({});

    // Create novel form state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newNovel, setNewNovel] = useState({ title: '', description: '', categoryId: '' });
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);

    // Edit novel state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingNovel, setEditingNovel] = useState<any>(null);

    // Comics state
    const [comics, setComics] = useState<any[]>([]);
    const [showComicModal, setShowComicModal] = useState(false);
    const [newComic, setNewComic] = useState({ title: '', description: '', categoryId: '' });
    const [showEditComicModal, setShowEditComicModal] = useState(false);
    const [editingComic, setEditingComic] = useState<any>(null);

    // Categories state
    const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            fetchData();
        }
    }, [status, router]);

    async function fetchData() {
        setLoading(true);
        try {
            // Fetch stats
            const statsRes = await fetch('/api/author/stats', { credentials: 'include' });
            if (statsRes.ok) {
                const data = await statsRes.json();
                setStats(data);
            }

            // Fetch novels
            const novelsRes = await fetch('/api/author/novels', { credentials: 'include' });
            if (novelsRes.ok) {
                const data = await novelsRes.json();
                setNovels(data);
            }

            // Fetch comics
            const comicsRes = await fetch('/api/author/comics', { credentials: 'include' });
            if (comicsRes.ok) {
                const data = await comicsRes.json();
                setComics(data);
            }

            // Fetch profile
            const profileRes = await fetch('/api/author/profile', { credentials: 'include' });
            if (profileRes.ok) {
                const data = await profileRes.json();
                setProfile(data);
                if (data.id_card_image) setPreviews(prev => ({ ...prev, id_card: data.id_card_image }));
                if (data.bank_book_image) setPreviews(prev => ({ ...prev, bank_book: data.bank_book_image }));
            }

            // Fetch categories
            const catsRes = await fetch('/api/categories');
            if (catsRes.ok) {
                setCategories(await catsRes.json());
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }

    // Show loading while checking auth
    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    // Redirect if not authenticated
    if (status === 'unauthenticated') {
        return null;
    }

    // Check if user has AUTHOR or ADMIN role
    const userRole = session?.user?.role;
    if (userRole === 'READER' || (!userRole && status === 'authenticated')) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md text-center">
                    <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <BookOpen className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">คุณยังไม่ได้เป็นนักเขียน</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        ต้องการเขียนนิยายหรือการ์ตูนบน LoveRead?<br />
                        สมัครเป็นนักเขียนเพื่อเริ่มต้นสร้างผลงานของคุณ!
                    </p>
                    <div className="space-y-3">
                        <a href="/become-author" className="block w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition">
                            สมัครเป็นนักเขียน
                        </a>
                        <a href="/" className="block w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                            กลับหน้าแรก
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    function handleProfileChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
        const { name, value } = e.target;
        setProfile((prev: any) => ({ ...prev, [name]: value }));
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, type: 'id_card' | 'bank_book') {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setFiles(prev => ({ ...prev, [type]: file }));
            setPreviews(prev => ({ ...prev, [type]: URL.createObjectURL(file) }));
        }
    }

    async function handleProfileSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);

        const formData = new FormData();
        Object.keys(profile).forEach(key => {
            if (profile[key] !== null && key !== 'id_card_image' && key !== 'bank_book_image') {
                formData.append(key, profile[key]);
            }
        });

        if (files.id_card) formData.append('id_card_image', files.id_card);
        if (files.bank_book) formData.append('bank_book_image', files.bank_book);

        try {
            const res = await fetch('/api/author/profile', {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            if (res.ok) {
                alert('บันทึกข้อมูลสำเร็จ');
                fetchData();
            } else {
                alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
            }
        } catch (error) {
            console.error(error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    }

    async function handleCreateNovel(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);

        try {
            let coverImageUrl = null;

            // Upload cover image if selected
            if (coverFile) {
                const formData = new FormData();
                formData.append('file', coverFile);

                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                });

                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    coverImageUrl = uploadData.url;
                }
            }

            const res = await fetch('/api/novels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: newNovel.title,
                    description: newNovel.description,
                    categoryId: newNovel.categoryId,
                    coverImage: coverImageUrl,
                }),
                credentials: 'include',
            });

            if (res.ok) {
                alert('สร้างนิยายสำเร็จ');
                setShowCreateModal(false);
                setNewNovel({ title: '', description: '', categoryId: '' });
                setCoverFile(null);
                setCoverPreview(null);
                fetchData();
            } else {
                alert('เกิดข้อผิดพลาดในการสร้างนิยาย');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSaving(false);
        }
    }

    function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setCoverFile(file);
            setCoverPreview(URL.createObjectURL(file));
        }
    }

    function openEditModal(novel: any) {
        setEditingNovel(novel);
        setNewNovel({ title: novel.title, description: novel.description || '', categoryId: novel.category_id || '' });
        setCoverPreview(novel.cover_image || null);
        setCoverFile(null);
        setShowEditModal(true);
    }

    async function handleEditNovel(e: React.FormEvent) {
        e.preventDefault();
        if (!editingNovel) return;
        setSaving(true);

        try {
            let coverImageUrl = editingNovel.cover_image;

            // Upload new cover if selected
            if (coverFile) {
                const formData = new FormData();
                formData.append('file', coverFile);

                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                });

                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    coverImageUrl = uploadData.url;
                }
            }

            const res = await fetch(`/api/novels/${editingNovel.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: newNovel.title,
                    description: newNovel.description,
                    categoryId: newNovel.categoryId,
                    coverImage: coverImageUrl,
                }),
                credentials: 'include',
            });

            if (res.ok) {
                alert('แก้ไขนิยายสำเร็จ');
                setShowEditModal(false);
                setEditingNovel(null);
                setNewNovel({ title: '', description: '', categoryId: '' });
                setCoverFile(null);
                setCoverPreview(null);
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

    async function handlePublishNovel(novelId: string) {
        if (!(await confirm('ต้องการเผยแพร่นิยายนี้หรือไม่?'))) return;
        try {
            const res = await fetch(`/api/novels/${novelId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'PUBLISHED' }),
                credentials: 'include',
            });
            if (res.ok) {
                alert('เผยแพร่นิยายสำเร็จ');
                fetchData();
            } else {
                alert('เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error(error);
        }
    }

    async function handleDeleteNovel(novelId: string) {
        if (!(await confirm('ต้องการลบนิยายนี้หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้', { danger: true }))) return;
        try {
            const res = await fetch(`/api/novels/${novelId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (res.ok) {
                alert('ลบนิยายสำเร็จ');
                fetchData();
            } else {
                alert('เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error(error);
        }
    }

    // Comic handlers
    async function handleCreateComic(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            let coverImageUrl = null;
            if (coverFile) {
                const formData = new FormData();
                formData.append('file', coverFile);
                const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include' });
                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    coverImageUrl = uploadData.url;
                }
            }
            const res = await fetch('/api/comics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newComic.title, description: newComic.description, categoryId: newComic.categoryId, coverImage: coverImageUrl }),
                credentials: 'include',
            });
            if (res.ok) {
                alert('สร้างการ์ตูนสำเร็จ');
                setShowComicModal(false);
                setNewComic({ title: '', description: '', categoryId: '' });
                setCoverFile(null);
                setCoverPreview(null);
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

    function openEditComicModal(comic: any) {
        setEditingComic(comic);
        setNewComic({ title: comic.title, description: comic.description || '', categoryId: comic.category_id || '' });
        setCoverPreview(comic.cover_image || null);
        setCoverFile(null);
        setShowEditComicModal(true);
    }

    async function handleEditComic(e: React.FormEvent) {
        e.preventDefault();
        if (!editingComic) return;
        setSaving(true);
        try {
            let coverImageUrl = editingComic.cover_image;
            if (coverFile) {
                const formData = new FormData();
                formData.append('file', coverFile);
                const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include' });
                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    coverImageUrl = uploadData.url;
                }
            }
            const res = await fetch(`/api/comics/${editingComic.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newComic.title, description: newComic.description, categoryId: newComic.categoryId, coverImage: coverImageUrl }),
                credentials: 'include',
            });
            if (res.ok) {
                alert('แก้ไขการ์ตูนสำเร็จ');
                setShowEditComicModal(false);
                setEditingComic(null);
                setNewComic({ title: '', description: '', categoryId: '' });
                setCoverFile(null);
                setCoverPreview(null);
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

    async function handlePublishComic(comicId: string) {
        if (!(await confirm('ต้องการเผยแพร่การ์ตูนนี้หรือไม่?'))) return;
        try {
            const res = await fetch(`/api/comics/${comicId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'PUBLISHED' }),
                credentials: 'include',
            });
            if (res.ok) {
                alert('เผยแพร่การ์ตูนสำเร็จ');
                fetchData();
            } else {
                alert('เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error(error);
        }
    }

    async function handleDeleteComic(comicId: string) {
        if (!(await confirm('ต้องการลบการ์ตูนนี้หรือไม่?', { danger: true }))) return;
        try {
            const res = await fetch(`/api/comics/${comicId}`, { method: 'DELETE', credentials: 'include' });
            if (res.ok) {
                alert('ลบการ์ตูนสำเร็จ');
                fetchData();
            } else {
                alert('เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error(error);
        }
    }

    // Render content based on active tab
    function renderContent() {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            );
        }

        switch (activeTab) {
            case 'dashboard':
                return renderDashboard();
            case 'novels':
                return renderNovels();
            case 'comics':
                return renderComics();
            case 'earnings':
                return renderEarnings();
            case 'wallet':
                return renderWallet();
            case 'profile':
                return renderProfile();
            default:
                return null;
        }
    }

    function renderDashboard() {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ภาพรวมนักเขียน</h1>
                        <p className="text-gray-500 dark:text-gray-400">ยินดีต้อนรับกลับมา!</p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition shadow-sm flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        สร้างนิยายใหม่
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">📚</div>
                            <div>
                                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">นิยายทั้งหมด</h3>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.novels}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-lg">🎨</div>
                            <div>
                                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">การ์ตูนทั้งหมด</h3>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.comics}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">👁️</div>
                            <div>
                                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">ยอดวิวทั้งหมด</h3>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.views?.toLocaleString() || 0}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Works */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">ผลงานล่าสุด</h3>
                    {novels.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {novels.slice(0, 6).map((novel: any) => (
                                <div key={novel.id} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border dark:border-gray-700">
                                    <h4 className="font-semibold text-gray-900 dark:text-white truncate">{novel.title}</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{novel.description}</p>
                                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                                        <Eye className="w-4 h-4" />
                                        <span>{novel.views || 0}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed dark:border-gray-700">
                            ยังไม่มีผลงาน เริ่มเขียนกันเลย!
                        </div>
                    )}
                </div>
            </div>
        );
    }

    function renderNovels() {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">นิยายของฉัน</h1>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition shadow-sm flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        สร้างนิยายใหม่
                    </button>
                </div>

                {novels.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {novels.map((novel: any) => (
                            <div key={novel.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden hover:shadow-md transition">
                                <div className="h-32 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center relative">
                                    {novel.cover_image ? (
                                        <Image src={novel.cover_image} alt={novel.title} width={80} height={120} className="object-cover" />
                                    ) : (
                                        <BookOpen className="w-12 h-12 text-white/50" />
                                    )}
                                </div>
                                <div className="p-4">
                                    <h3 className="font-bold text-gray-900 dark:text-white truncate">{novel.title}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{novel.description}</p>
                                    <div className="flex items-center justify-between mt-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${novel.status === 'PUBLISHED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                            }`}>
                                            {novel.status === 'PUBLISHED' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}
                                        </span>
                                        <div className="flex items-center gap-1 text-sm text-gray-400">
                                            <Eye className="w-4 h-4" />
                                            <span>{novel.views || 0}</span>
                                        </div>
                                    </div>
                                    {/* Management Buttons */}
                                    <div className="flex gap-2 mt-4 pt-3 border-t dark:border-gray-700">
                                        {novel.status === 'DRAFT' && (
                                            <button
                                                onClick={() => handlePublishNovel(novel.id)}
                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                                            >
                                                <Send className="w-4 h-4" />
                                                เผยแพร่
                                            </button>
                                        )}
                                        <button
                                            onClick={() => router.push(`/author/novel/${novel.id}/chapters`)}
                                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition"
                                        >
                                            <FileText className="w-4 h-4" />
                                            จัดการบท
                                        </button>
                                        <button
                                            onClick={() => openEditModal(novel)}
                                            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteNovel(novel.id)}
                                            className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
                        <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">ยังไม่มีนิยาย</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">เริ่มสร้างนิยายเรื่องแรกของคุณเลย!</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
                        >
                            สร้างนิยายใหม่
                        </button>
                    </div>
                )}
            </div>
        );
    }

    function renderComics() {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">การ์ตูนของฉัน</h1>
                    <button
                        onClick={() => { setNewComic({ title: '', description: '', categoryId: '' }); setCoverFile(null); setCoverPreview(null); setShowComicModal(true); }}
                        className="bg-pink-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-pink-700 transition shadow-sm flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        สร้างการ์ตูนใหม่
                    </button>
                </div>

                {comics.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {comics.map((comic: any) => (
                            <div key={comic.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden hover:shadow-md transition">
                                <div className="h-32 bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center relative">
                                    {comic.cover_image ? (
                                        <Image src={comic.cover_image} alt={comic.title} width={80} height={120} className="object-cover" />
                                    ) : (
                                        <ImageIcon className="w-12 h-12 text-white/50" />
                                    )}
                                </div>
                                <div className="p-4">
                                    <h3 className="font-bold text-gray-900 dark:text-white truncate">{comic.title}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{comic.description}</p>
                                    <div className="flex items-center justify-between mt-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${comic.status === 'PUBLISHED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                                            {comic.status === 'PUBLISHED' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}
                                        </span>
                                        <div className="flex items-center gap-1 text-sm text-gray-400">
                                            <Eye className="w-4 h-4" />
                                            <span>{comic.views || 0}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-4 pt-3 border-t dark:border-gray-700">
                                        {comic.status === 'DRAFT' && (
                                            <button onClick={() => handlePublishComic(comic.id)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition">
                                                <Send className="w-4 h-4" />เผยแพร่
                                            </button>
                                        )}
                                        <button onClick={() => router.push(`/author/comic/${comic.id}/episodes`)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-pink-600 text-white text-sm rounded-lg hover:bg-pink-700 transition">
                                            <FileText className="w-4 h-4" />จัดการตอน
                                        </button>
                                        <button onClick={() => openEditComicModal(comic)} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDeleteComic(comic.id)} className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
                        <ImageIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">ยังไม่มีการ์ตูน</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">เริ่มสร้างการ์ตูนเรื่องแรกของคุณเลย!</p>
                        <button onClick={() => { setNewComic({ title: '', description: '', categoryId: '' }); setCoverFile(null); setCoverPreview(null); setShowComicModal(true); }} className="bg-pink-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-pink-700 transition">
                            สร้างการ์ตูนใหม่
                        </button>
                    </div>
                )}
            </div>
        );
    }

    function renderEarnings() {
        return <EarningsPanel />;
    }

    function renderWallet() {
        return <WalletPanel />;
    }

    function renderProfile() {
        return (
            <div className="max-w-4xl">
                <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-900 dark:text-white">
                    <span className="w-1 h-8 bg-indigo-600 rounded-full inline-block"></span>
                    ข้อมูลนักเขียน
                </h1>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-8 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
                    <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                        สถานะการลงทะเบียนนักเขียน : {profile.status === 'APPROVED' ? <span className="text-green-600">อนุมัติแล้ว</span> : profile.status === 'REJECTED' ? <span className="text-red-600">ถูกปฏิเสธ ({profile.rejection_reason})</span> : <span className="text-yellow-600">ยังไม่ได้ลงทะเบียน / รอการตรวจสอบ</span>}
                    </span>
                </div>

                <form onSubmit={handleProfileSubmit} className="space-y-8">
                    {/* Personal Info */}
                    <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                            📋 ข้อมูลส่วนบุคคล
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">คำนำหน้า*</label>
                                <select name="title" value={profile.title || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                    <option value="">เลือก</option>
                                    <option value="นาย">นาย</option>
                                    <option value="นาง">นาง</option>
                                    <option value="นางสาว">นางสาว</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">ชื่อ*</label>
                                    <input type="text" name="first_name" value={profile.first_name || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">นามสกุล*</label>
                                    <input type="text" name="last_name" value={profile.last_name || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">หมายเลขบัตรประชาชน*</label>
                                <input type="text" name="id_card_number" value={profile.id_card_number || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">ที่อยู่ตามบัตรประชาชน*</label>
                                <textarea name="address" value={profile.address || ''} onChange={handleProfileChange} rows={3} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">จังหวัด*</label>
                                <input type="text" name="province" value={profile.province || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">อำเภอ/เขต*</label>
                                <input type="text" name="district" value={profile.district || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">ตำบล/แขวง*</label>
                                <input type="text" name="sub_district" value={profile.sub_district || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">รหัสไปรษณีย์*</label>
                                <input type="text" name="postal_code" value={profile.postal_code || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">เบอร์โทรศัพท์*</label>
                                <input type="text" name="phone_number" value={profile.phone_number || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                        </div>
                    </section>

                    {/* Bank Info */}
                    <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                            🏦 ข้อมูลบัญชีธนาคาร
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">ชื่อธนาคาร*</label>
                                <select name="bank_name" value={profile.bank_name || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                    <option value="">เลือกธนาคาร</option>
                                    <option value="kbank">กสิกรไทย</option>
                                    <option value="scb">ไทยพาณิชย์</option>
                                    <option value="bbl">กรุงเทพ</option>
                                    <option value="ktb">กรุงไทย</option>
                                    <option value="ttb">ทีทีบี</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">เลขที่บัญชีธนาคาร*</label>
                                <input type="text" name="bank_account_number" value={profile.bank_account_number || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">ชื่อบัญชีธนาคาร*</label>
                                <input type="text" name="bank_account_name" value={profile.bank_account_name || ''} onChange={handleProfileChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                        </div>
                    </section>

                    {/* Uploads */}
                    <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
                        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                            📂 อัปโหลดเอกสาร
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* ID Card */}
                            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleFileChange(e, 'id_card')}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                {previews.id_card ? (
                                    <div className="relative h-40 w-full mb-2">
                                        <Image src={previews.id_card} alt="ID Card" fill className="object-contain rounded-lg" />
                                    </div>
                                ) : (
                                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                                )}
                                <p className="font-medium text-gray-700 dark:text-gray-300">สำเนาบัตรประชาชน*</p>
                                <p className="text-xs text-gray-500 mt-1">.jpg .png ขนาดไม่เกิน 5MB</p>
                            </div>

                            {/* Bank Book */}
                            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleFileChange(e, 'bank_book')}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                {previews.bank_book ? (
                                    <div className="relative h-40 w-full mb-2">
                                        <Image src={previews.bank_book} alt="Bank Book" fill className="object-contain rounded-lg" />
                                    </div>
                                ) : (
                                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                                )}
                                <p className="font-medium text-gray-700 dark:text-gray-300">สำเนาบัญชีธนาคาร*</p>
                                <p className="text-xs text-gray-500 mt-1">.jpg .png ขนาดไม่เกิน 5MB</p>
                            </div>
                        </div>
                    </section>

                    <div className="flex justify-center pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-full font-bold hover:bg-indigo-700 transition shadow-lg disabled:opacity-50"
                        >
                            <Save className="w-5 h-5" />
                            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
            {/* Sidebar */}
            <div className="w-64 bg-white dark:bg-gray-800 h-screen shadow-md flex flex-col fixed left-0 top-0 z-40">
                <div className="p-6 flex items-center gap-3 border-b dark:border-gray-700">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
                        W
                    </div>
                    <span className="text-xl font-bold text-gray-800 dark:text-white">Writer Center</span>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {menuItems.map((item) => {
                        const isActive = activeTab === item.key;
                        return (
                            <button
                                key={item.key}
                                onClick={() => setActiveTab(item.key)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ${isActive
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="font-medium">{item.name}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t dark:border-gray-700">
                    <button
                        onClick={() => signOut({ callbackUrl: '/' })}
                        className="flex items-center gap-3 px-4 py-3 w-full text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">ออกจากระบบ</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="pl-64 flex-1">
                <main className="p-8">
                    {renderContent()}
                </main>
            </div>

            {/* Create Novel Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 w-full max-w-lg mx-4 shadow-2xl">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">สร้างนิยายใหม่</h2>
                        <form onSubmit={handleCreateNovel} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อนิยาย</label>
                                <input
                                    type="text"
                                    required
                                    value={newNovel.title}
                                    onChange={(e) => setNewNovel({ ...newNovel, title: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    placeholder="ชื่อนิยายของคุณ"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">เรื่องย่อ</label>
                                <textarea
                                    required
                                    rows={4}
                                    value={newNovel.description}
                                    onChange={(e) => setNewNovel({ ...newNovel, description: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    placeholder="เรื่องย่อนิยาย"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ปกนิยาย</label>
                                <div className="flex items-center gap-4">
                                    {coverPreview ? (
                                        <div className="relative w-24 h-32 rounded-lg overflow-hidden">
                                            <Image src={coverPreview} alt="Cover preview" fill className="object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => { setCoverFile(null); setCoverPreview(null); }}
                                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"
                                            >
                                                <Upload className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="w-24 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition">
                                            <Upload className="w-6 h-6 text-gray-400" />
                                            <span className="text-xs text-gray-400 mt-1">อัพโหลด</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleCoverChange}
                                                className="hidden"
                                            />
                                        </label>
                                    )}
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        <p>รูปปกนิยาย</p>
                                        <p className="text-xs">แนะนำ 400x600 px</p>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">หมวดหมู่ (ไม่บังคับ)</label>
                                <select
                                    value={newNovel.categoryId}
                                    onChange={(e) => setNewNovel({ ...newNovel, categoryId: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                                >
                                    {saving ? 'กำลังสร้าง...' : 'สร้างนิยาย'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Novel Modal */}
            {showEditModal && editingNovel && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 w-full max-w-lg mx-4 shadow-2xl">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">แก้ไขนิยาย</h2>
                        <form onSubmit={handleEditNovel} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อนิยาย</label>
                                <input
                                    type="text"
                                    required
                                    value={newNovel.title}
                                    onChange={(e) => setNewNovel({ ...newNovel, title: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">เรื่องย่อ</label>
                                <textarea
                                    required
                                    rows={4}
                                    value={newNovel.description}
                                    onChange={(e) => setNewNovel({ ...newNovel, description: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ปกนิยาย</label>
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
                                        <label className="w-24 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition">
                                            <Upload className="w-6 h-6 text-gray-400" />
                                            <span className="text-xs text-gray-400 mt-1">อัพโหลด</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleCoverChange}
                                                className="hidden"
                                            />
                                        </label>
                                    )}
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        <p>รูปปกนิยาย</p>
                                        <p className="text-xs">แนะนำ 400x600 px</p>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">หมวดหมู่ (ไม่บังคับ)</label>
                                <select
                                    value={newNovel.categoryId}
                                    onChange={(e) => setNewNovel({ ...newNovel, categoryId: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                                    onClick={() => { setShowEditModal(false); setEditingNovel(null); setCoverFile(null); setCoverPreview(null); }}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                                >
                                    {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Comic Modal */}
            {showComicModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 w-full max-w-lg mx-4 shadow-2xl">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">สร้างการ์ตูนใหม่</h2>
                        <form onSubmit={handleCreateComic} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อการ์ตูน</label>
                                <input type="text" required value={newComic.title} onChange={(e) => setNewComic({ ...newComic, title: e.target.value })} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="ชื่อการ์ตูนของคุณ" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">เรื่องย่อ</label>
                                <textarea required rows={4} value={newComic.description} onChange={(e) => setNewComic({ ...newComic, description: e.target.value })} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="เรื่องย่อการ์ตูน" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ปกการ์ตูน</label>
                                <div className="flex items-center gap-4">
                                    {coverPreview ? (
                                        <div className="relative w-24 h-32 rounded-lg overflow-hidden">
                                            <Image src={coverPreview} alt="Cover preview" fill className="object-cover" />
                                            <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(null); }} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"><Trash2 className="w-3 h-3" /></button>
                                        </div>
                                    ) : (
                                        <label className="w-24 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-pink-500 transition">
                                            <Upload className="w-6 h-6 text-gray-400" /><span className="text-xs text-gray-400 mt-1">อัพโหลด</span>
                                            <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
                                        </label>
                                    )}
                                    <div className="text-sm text-gray-500 dark:text-gray-400"><p>รูปปกการ์ตูน</p><p className="text-xs">แนะนำ 400x600 px</p></div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">หมวดหมู่ (ไม่บังคับ)</label>
                                <select
                                    value={newComic.categoryId}
                                    onChange={(e) => setNewComic({ ...newComic, categoryId: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                    <option value="">ไม่ระบุหมวดหมู่</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => { setShowComicModal(false); setCoverFile(null); setCoverPreview(null); }} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">ยกเลิก</button>
                                <button type="submit" disabled={saving} className="flex-1 bg-pink-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-pink-700 transition disabled:opacity-50">{saving ? 'กำลังสร้าง...' : 'สร้างการ์ตูน'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Comic Modal */}
            {showEditComicModal && editingComic && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 w-full max-w-lg mx-4 shadow-2xl">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">แก้ไขการ์ตูน</h2>
                        <form onSubmit={handleEditComic} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อการ์ตูน</label>
                                <input type="text" required value={newComic.title} onChange={(e) => setNewComic({ ...newComic, title: e.target.value })} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">เรื่องย่อ</label>
                                <textarea required rows={4} value={newComic.description} onChange={(e) => setNewComic({ ...newComic, description: e.target.value })} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ปกการ์ตูน</label>
                                <div className="flex items-center gap-4">
                                    {coverPreview ? (
                                        <div className="relative w-24 h-32 rounded-lg overflow-hidden">
                                            <Image src={coverPreview} alt="Cover preview" fill className="object-cover" />
                                            <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(null); }} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"><Trash2 className="w-3 h-3" /></button>
                                        </div>
                                    ) : (
                                        <label className="w-24 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-pink-500 transition">
                                            <Upload className="w-6 h-6 text-gray-400" /><span className="text-xs text-gray-400 mt-1">อัพโหลด</span>
                                            <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
                                        </label>
                                    )}
                                    <div className="text-sm text-gray-500 dark:text-gray-400"><p>รูปปกการ์ตูน</p><p className="text-xs">แนะนำ 400x600 px</p></div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">หมวดหมู่ (ไม่บังคับ)</label>
                                <select
                                    value={newComic.categoryId}
                                    onChange={(e) => setNewComic({ ...newComic, categoryId: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                    <option value="">ไม่ระบุหมวดหมู่</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => { setShowEditComicModal(false); setEditingComic(null); setCoverFile(null); setCoverPreview(null); }} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">ยกเลิก</button>
                                <button type="submit" disabled={saving} className="flex-1 bg-pink-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-pink-700 transition disabled:opacity-50">{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

