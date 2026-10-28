"use client";
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, BarChart3, BookOpen, History, LogOut, PenTool, Settings, ShieldCheck, Tag, Users, Wallet } from 'lucide-react';
import DashboardPanel from '@/components/admin/DashboardPanel';
import UsersPanel from '@/components/admin/UsersPanel';
import ContentPanel from '@/components/admin/ContentPanel';
import ReportsPanel from '@/components/admin/ReportsPanel';
import ModerationPanel from '@/components/admin/ModerationPanel';
import WritersPanel from '@/components/admin/WritersPanel';
import PaymentsPanel from '@/components/admin/PaymentsPanel';
import AuditLogPanel from '@/components/admin/AuditLogPanel';
import CategoriesPanel from '@/components/admin/CategoriesPanel';
import SettingsPanel from '@/components/admin/SettingsPanel';
import { CountBadge, fetchJson, qs } from '@/components/admin/ui';
import { Navigate, PanelProps, PendingCounts, TabType } from '@/components/admin/types';

const COUNTS_POLL_MS = 60_000;

// badge: which pending counts (from /api/admin/counts) show as a red number on the menu item
const menuItems: { name: string; key: TabType; icon: typeof Users; badge?: (c: PendingCounts) => number }[] = [
    { name: 'ภาพรวม', key: 'dashboard', icon: BarChart3 },
    { name: 'ผู้ใช้', key: 'users', icon: Users },
    { name: 'เนื้อหา', key: 'content', icon: BookOpen },
    { name: 'รายงาน', key: 'reports', icon: AlertTriangle, badge: (c) => c.reports },
    { name: 'คิวตรวจเนื้อหา', key: 'moderation', icon: ShieldCheck, badge: (c) => c.moderation },
    { name: 'คำขอเป็นนักเขียน', key: 'writers', icon: PenTool, badge: (c) => c.writers },
    { name: 'การเงิน', key: 'payments', icon: Wallet, badge: (c) => c.topups + c.withdrawals },
    { name: 'ประวัติการทำงาน', key: 'logs', icon: History },
    { name: 'หมวดหมู่', key: 'categories', icon: Tag },
    { name: 'ตั้งค่า', key: 'settings', icon: Settings },
];

const PANELS: Record<TabType, React.ComponentType<PanelProps>> = {
    dashboard: DashboardPanel,
    users: UsersPanel,
    content: ContentPanel,
    reports: ReportsPanel,
    moderation: ModerationPanel,
    writers: WritersPanel,
    payments: PaymentsPanel,
    logs: AuditLogPanel,
    categories: CategoriesPanel,
    settings: SettingsPanel,
};

// Admin dashboard: sidebar with pending-work badges + one panel per tab (components/admin/).
// The URL holds the state (?tab=, plus ?user= / ?view= / ?type= / ?target= for some tabs) so links from
// notifications and the back button work.
function AdminPanel() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab');
    const activeTab: TabType = menuItems.some((item) => item.key === tabParam) ? tabParam as TabType : 'dashboard';
    const isAdmin = status === 'authenticated' && session?.user?.role === 'ADMIN';
    const [counts, setCounts] = useState<PendingCounts | null>(null);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
        else if (status === 'authenticated' && !isAdmin) router.push('/');
    }, [status, isAdmin, router]);

    const refreshCounts = useCallback(async () => {
        const c = await fetchJson<PendingCounts>('/api/admin/counts');
        if (c) setCounts(c);
    }, []);

    // On load, on every tab change, and every minute while the browser tab is visible
    useEffect(() => {
        if (!isAdmin) return;
        refreshCounts();
        const timer = setInterval(() => { if (document.visibilityState === 'visible') refreshCounts(); }, COUNTS_POLL_MS);
        return () => clearInterval(timer);
    }, [isAdmin, activeTab, refreshCounts]);

    const navigate = useCallback<Navigate>((tab, params) => {
        router.push(`/admin?${qs({ tab, ...params })}`);
        window.scrollTo({ top: 0 });
    }, [router]);

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                {status === 'loading' && <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>}
            </div>
        );
    }

    const Panel = PANELS[activeTab];
    // Remount when a sub-view changes so each one starts with its own default filters
    const panelKey = [activeTab, searchParams.get('view'), searchParams.get('type'), searchParams.get('target')].join(':');

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
            {/* Sidebar (md and up; phones get the tab strip below instead) */}
            <div className="hidden md:flex w-64 bg-white dark:bg-gray-800 h-screen shadow-md flex-col fixed left-0 top-0 z-40">
                <div className="p-6 flex items-center gap-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">A</div>
                    <span className="text-xl font-bold text-gray-800 dark:text-white">ผู้ดูแลระบบ</span>
                </div>
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="เมนูผู้ดูแลระบบ">
                    {menuItems.map((item) => {
                        const isActive = activeTab === item.key;
                        return (
                            <button key={item.key} onClick={() => navigate(item.key)} aria-current={isActive ? 'page' : undefined} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors w-full text-left ${isActive ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                <item.icon className="w-5 h-5 flex-shrink-0" /><span className="font-medium flex-1">{item.name}</span>
                                {counts && item.badge && <CountBadge count={item.badge(counts)} />}
                            </button>
                        );
                    })}
                </nav>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <button onClick={() => signOut({ callbackUrl: '/' })} className="flex items-center gap-3 px-4 py-3 w-full text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <LogOut className="w-5 h-5" /><span className="font-medium">ออกจากระบบ</span>
                    </button>
                </div>
            </div>
            {/* Main Content */}
            <div className="md:pl-64 flex-1 min-w-0">
                {/* Tab strip for phones; sign-out is in the Navbar's mobile menu */}
                <nav className="md:hidden flex gap-2 overflow-x-auto [scrollbar-width:none] px-4 pt-4 pb-1" aria-label="เมนูผู้ดูแลระบบ">
                    {menuItems.map((item) => (
                        <button key={item.key} onClick={() => navigate(item.key)} aria-current={activeTab === item.key ? 'page' : undefined} className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm whitespace-nowrap flex-shrink-0 transition-colors ${activeTab === item.key ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}>
                            <item.icon className="w-4 h-4" />{item.name}
                            {counts && item.badge && <CountBadge count={item.badge(counts)} />}
                        </button>
                    ))}
                </nav>
                <main className="p-4 md:p-8">
                    <Panel key={panelKey} navigate={navigate} params={searchParams} counts={counts} refreshCounts={refreshCounts} />
                </main>
            </div>
        </div>
    );
}

// useSearchParams() must sit inside Suspense or next build can't prerender the page
export default function AdminPanelPage() {
    return (
        <Suspense>
            <AdminPanel />
        </Suspense>
    );
}
