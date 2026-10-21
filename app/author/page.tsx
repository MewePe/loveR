"use client";
import { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, BookOpen, DollarSign, Wallet, User, LogOut, ImageIcon } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardPanel, { AuthorStats } from '@/components/author/DashboardPanel';
import WorksPanel from '@/components/author/WorksPanel';
import WorkFormModal from '@/components/author/WorkFormModal';
import EarningsPanel from '@/components/author/EarningsPanel';
import WalletPanel from '@/components/author/WalletPanel';
import WriterProfilePanel from '@/components/author/WriterProfilePanel';
import { Category, Work, WorkKind } from '@/components/author/types';

type TabType = 'dashboard' | 'novels' | 'comics' | 'earnings' | 'wallet' | 'profile';

const menuItems = [
    { name: 'ภาพรวมนักเขียน', key: 'dashboard' as TabType, icon: LayoutDashboard },
    { name: 'นิยายของฉัน', key: 'novels' as TabType, icon: BookOpen },
    { name: 'การ์ตูนของฉัน', key: 'comics' as TabType, icon: ImageIcon },
    { name: 'รายได้ของฉัน', key: 'earnings' as TabType, icon: DollarSign },
    { name: 'กระเป๋าเงินนักเขียน', key: 'wallet' as TabType, icon: Wallet },
    { name: 'ข้อมูลนักเขียน', key: 'profile' as TabType, icon: User },
];

// Writer Center: sidebar + one panel per tab (components/author/). This page loads the data the dashboard,
// novels and comics tabs share; earnings, wallet and profile panels load their own.
export default function AuthorDashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>('dashboard');
    const [stats, setStats] = useState<AuthorStats>({ novels: 0, comics: 0, views: 0 });
    const [novels, setNovels] = useState<Work[]>([]);
    const [comics, setComics] = useState<Work[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    // Open create/edit form: a novel/comic to edit, or none to create a new one
    const [form, setForm] = useState<{ kind: WorkKind; work?: Work } | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const statsRes = await fetch('/api/author/stats', { credentials: 'include' });
            if (statsRes.ok) setStats(await statsRes.json());

            const novelsRes = await fetch('/api/author/novels', { credentials: 'include' });
            if (novelsRes.ok) setNovels(await novelsRes.json());

            const comicsRes = await fetch('/api/author/comics', { credentials: 'include' });
            if (comicsRes.ok) setComics(await comicsRes.json());

            const catsRes = await fetch('/api/categories');
            if (catsRes.ok) setCategories(await catsRes.json());
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            fetchData();
        }
    }, [status, router, fetchData]);

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
                        <Link href="/become-author" className="block w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition">
                            สมัครเป็นนักเขียน
                        </Link>
                        <Link href="/" className="block w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                            กลับหน้าแรก
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    function renderContent() {
        switch (activeTab) {
            case 'earnings':
                return <EarningsPanel />;
            case 'wallet':
                return <WalletPanel />;
            case 'profile':
                return <WriterProfilePanel />;
        }

        if (loading) {
            return (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            );
        }

        switch (activeTab) {
            case 'dashboard':
                return <DashboardPanel stats={stats} novels={novels} onCreateNovel={() => setForm({ kind: 'novel' })} />;
            case 'novels':
            case 'comics': {
                const kind: WorkKind = activeTab === 'novels' ? 'novel' : 'comic';
                return (
                    <WorksPanel
                        kind={kind}
                        works={kind === 'novel' ? novels : comics}
                        onCreate={() => setForm({ kind })}
                        onEdit={(work) => setForm({ kind, work })}
                        onChanged={fetchData}
                    />
                );
            }
        }
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

            {form && (
                <WorkFormModal
                    // Remount per novel/comic so the form starts from that work's values
                    key={`${form.kind}-${form.work?.id ?? 'new'}`}
                    kind={form.kind}
                    work={form.work}
                    categories={categories}
                    onClose={() => setForm(null)}
                    onSaved={() => { setForm(null); fetchData(); }}
                />
            )}
        </div>
    );
}
