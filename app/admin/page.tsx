"use client";
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { BarChart3, Users, BookOpen, AlertTriangle, Tag, Settings, LogOut, Search, Shield, Ban, CheckCircle, XCircle, Eye, Trash2, Plus, Save, FileText, Wallet } from 'lucide-react';
import PaymentsPanel from '@/components/admin/PaymentsPanel';
import AnalyticsPanel from '@/components/admin/AnalyticsPanel';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';

type TabType = 'dashboard' | 'users' | 'content' | 'reports' | 'writers' | 'payments' | 'categories' | 'settings';

const menuItems = [
    { name: 'ภาพรวม', key: 'dashboard' as TabType, icon: BarChart3 },
    { name: 'ผู้ใช้', key: 'users' as TabType, icon: Users },
    { name: 'เนื้อหา', key: 'content' as TabType, icon: BookOpen },
    { name: 'รายงาน', key: 'reports' as TabType, icon: AlertTriangle },
    { name: 'คำขอเป็นนักเขียน', key: 'writers' as TabType, icon: Users },
    { name: 'การเงิน', key: 'payments' as TabType, icon: Wallet },
    { name: 'หมวดหมู่', key: 'categories' as TabType, icon: Tag },
    { name: 'ตั้งค่า', key: 'settings' as TabType, icon: Settings },
];

// Thai labels for enum values shown in the tables (unknown values fall back to the raw value)
const ROLE_LABEL: Record<string, string> = { ADMIN: 'แอดมิน', AUTHOR: 'นักเขียน', READER: 'ผู้อ่าน', BANNED: 'ถูกแบน', VISITOR: 'ผู้เยี่ยมชม' };
const CONTENT_STATUS_LABEL: Record<string, string> = { PUBLISHED: 'เผยแพร่แล้ว', DRAFT: 'ฉบับร่าง', ARCHIVED: 'เก็บถาวร', BANNED: 'ถูกระงับ' };
const REPORT_STATUS_LABEL: Record<string, string> = { PENDING: 'รอตรวจสอบ', RESOLVED: 'จัดการแล้ว', IGNORED: 'ไม่ดำเนินการ' };
const REPORT_TARGET_LABEL: Record<string, string> = { NOVEL: 'นิยาย', COMIC: 'การ์ตูน', COMMENT: 'คอมเมนต์' };

interface AdminStats { users: number; novels: number; chapters: number; comics: number; reports: number; }
interface User { id: string; name: string; email: string; role: string; created_at: string; }
interface ContentItem { id: string; title: string; author_name: string; status: string; created_at: string; }
interface Report { id: string; reporter_name: string; target_type: string; target_id: string; target_title: string | null; parent_type: string | null; parent_id: string | null; comment_author_name: string | null; reason: string; status: string; created_at: string; }
interface WriterRequest { user_id: string; user_name: string; email: string; title: string; first_name: string; last_name: string; id_card_number: string; phone_number: string; province: string; bank_name: string; bank_account_name: string; bank_account_number: string; id_card_image: string; bank_book_image: string; status: string; rejection_reason: string; created_at: string; }
interface Category { id: string; name: string; slug: string; }

function AdminPanel() {
    const toast = useToast();
    const confirm = useConfirm();
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>('dashboard');
    // ?tab=... opens a tab directly (links from notifications)
    const searchParams = useSearchParams();
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (menuItems.some((item) => item.key === tab)) setActiveTab(tab as TabType);
    }, [searchParams]);
    const [loading, setLoading] = useState(true);

    // Dashboard state
    const [stats, setStats] = useState<AdminStats | null>(null);

    // Users state
    const [users, setUsers] = useState<User[]>([]);
    const [userSearch, setUserSearch] = useState('');

    // Content state
    const [contentTab, setContentTab] = useState<'novels' | 'comics'>('novels');
    const [contentItems, setContentItems] = useState<ContentItem[]>([]);

    // Reports state
    const [reports, setReports] = useState<Report[]>([]);

    // Writers state
    const [writerRequests, setWriterRequests] = useState<WriterRequest[]>([]);
    const [selectedWriter, setSelectedWriter] = useState<WriterRequest | null>(null);
    // Writer application being rejected: the reason form is open while this is set
    const [rejecting, setRejecting] = useState<{ userId: string; reason: string; submitting: boolean } | null>(null);

    // Categories state
    const [categories, setCategories] = useState<Category[]>([]);
    const [newCategory, setNewCategory] = useState({ name: '', slug: '' });

    // Settings state
    const [settings, setSettings] = useState({ site_name: '', site_description: '', contact_email: '', maintenance_mode: false, author_share_percent: 70, payment_info: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated' && session?.user?.role?.toUpperCase() !== 'ADMIN') {
            router.push('/');
        } else if (status === 'authenticated') {
            fetchData();
        }
    }, [status, session, router]);

    async function fetchData() {
        setLoading(true);
        try {
            const res = await fetch('/api/admin', { credentials: 'include' });
            if (res.ok) setStats(await res.json());
        } finally {
            setLoading(false);
        }
    }

    const fetchTabData = useCallback(async () => {
        switch (activeTab) {
            case 'users':
                const usersRes = await fetch(`/api/admin/users?search=${userSearch}`, { credentials: 'include' });
                if (usersRes.ok) setUsers(await usersRes.json());
                break;
            case 'content':
                const contentRes = await fetch(`/api/admin/content?type=${contentTab}`, { credentials: 'include' });
                if (contentRes.ok) setContentItems(await contentRes.json());
                break;
            case 'reports':
                const reportsRes = await fetch('/api/admin/reports', { credentials: 'include' });
                if (reportsRes.ok) setReports(await reportsRes.json());
                break;
            case 'writers':
                const writersRes = await fetch('/api/admin/writers', { credentials: 'include' });
                if (writersRes.ok) setWriterRequests(await writersRes.json());
                break;
            case 'categories':
                const catsRes = await fetch('/api/admin/categories', { credentials: 'include' });
                if (catsRes.ok) setCategories(await catsRes.json());
                break;
            case 'settings':
                const settingsRes = await fetch('/api/admin/settings', { credentials: 'include' });
                if (settingsRes.ok) {
                    const data = await settingsRes.json();
                    setSettings({ site_name: data.site_name || '', site_description: data.site_description || '', contact_email: data.contact_email || '', maintenance_mode: !!data.maintenance_mode, author_share_percent: data.author_share_percent ?? 70, payment_info: data.payment_info || '' });
                }
                break;
        }
    }, [activeTab, contentTab, userSearch]);

    useEffect(() => {
        if (session?.user?.role === 'ADMIN') {
            fetchTabData();
        }
    }, [session?.user?.role, fetchTabData]);

    // Action handlers
    async function updateUserRole(id: string, newRole: string) {
        if (!(await confirm(`เปลี่ยนสิทธิ์ผู้ใช้เป็น "${ROLE_LABEL[newRole] ?? newRole}"?`))) return;
        const res = await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: newRole }), credentials: 'include' });
        if (res.ok) fetchTabData();
        else toast.error('เปลี่ยนสิทธิ์ผู้ใช้ไม่สำเร็จ');
    }

    async function updateContentStatus(id: string, newStatus: string) {
        if (!(await confirm(`เปลี่ยนสถานะเป็น "${CONTENT_STATUS_LABEL[newStatus] ?? newStatus}"?`))) return;
        const res = await fetch(`/api/admin/content/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus, type: contentTab }), credentials: 'include' });
        if (res.ok) fetchTabData();
        else toast.error('เปลี่ยนสถานะไม่สำเร็จ');
    }

    async function updateReportStatus(id: string, newStatus: string) {
        const res = await fetch(`/api/admin/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }), credentials: 'include' });
        if (res.ok) fetchTabData();
    }

    // Delete a reported comment and resolve the report
    async function deleteReportedComment(report: Report) {
        if (!(await confirm('ลบคอมเมนต์นี้?', { danger: true }))) return;
        const res = await fetch(`/api/comments/${report.target_id}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok || res.status === 404) await updateReportStatus(report.id, 'RESOLVED');
        else toast.error('ลบคอมเมนต์ไม่สำเร็จ');
    }

    async function addCategory(e: React.FormEvent) {
        e.preventDefault();
        const res = await fetch('/api/admin/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCategory), credentials: 'include' });
        if (res.ok) { setNewCategory({ name: '', slug: '' }); fetchTabData(); }
        else toast.error('เพิ่มหมวดหมู่ไม่สำเร็จ (ชื่อหรือ slug อาจซ้ำ)');
    }

    async function deleteCategory(id: string) {
        if (!(await confirm('ลบหมวดหมู่นี้? เรื่องที่อยู่ในหมวดนี้จะถูกเอาหมวดนี้ออก', { danger: true }))) return;
        const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) fetchTabData();
        else toast.error('ลบหมวดหมู่ไม่สำเร็จ');
    }

    async function saveSettings(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings), credentials: 'include' });
        if (res.ok) toast.success('บันทึกการตั้งค่าแล้ว');
        else toast.error('บันทึกการตั้งค่าไม่สำเร็จ');
        setSaving(false);
    }

    async function handleWriterAction(userId: string, action: 'APPROVED' | 'REJECTED', reason: string | null = null) {
        const res = await fetch(`/api/admin/writers/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: action, reason }),
            credentials: 'include'
        });
        if (res.ok) {
            toast.success(action === 'APPROVED' ? 'อนุมัติเรียบร้อย' : 'ปฏิเสธเรียบร้อย');
            setSelectedWriter(null);
            setRejecting(null);
            fetchTabData();
        } else {
            toast.error('เกิดข้อผิดพลาด');
        }
    }

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (status === 'unauthenticated' || (status === 'authenticated' && session?.user?.role?.toUpperCase() !== 'ADMIN')) return null;

    function renderContent() {
        switch (activeTab) {
            case 'dashboard': return renderDashboard();
            case 'users': return renderUsers();
            case 'content': return renderContentSection();
            case 'reports': return renderReports();
            case 'writers': return renderWriters();
            case 'payments': return <PaymentsPanel />;
            case 'categories': return renderCategories();
            case 'settings': return renderSettings();
            default: return null;
        }
    }

    function renderDashboard() {
        return (
            <div className="space-y-6">
                <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">ภาพรวมระบบ</h1><p className="text-gray-500 dark:text-gray-400">ยินดีต้อนรับกลับมา</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700"><div className="flex items-center justify-between mb-4"><h3 className="text-gray-500 dark:text-gray-400 font-medium">ผู้ใช้ทั้งหมด</h3><Users className="w-6 h-6 text-blue-500 dark:text-blue-400" /></div><p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.users}</p></div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700"><div className="flex items-center justify-between mb-4"><h3 className="text-gray-500 dark:text-gray-400 font-medium">นิยายทั้งหมด</h3><BookOpen className="w-6 h-6 text-indigo-500 dark:text-indigo-400" /></div><p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.novels}</p></div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700"><div className="flex items-center justify-between mb-4"><h3 className="text-gray-500 dark:text-gray-400 font-medium">การ์ตูนทั้งหมด</h3><FileText className="w-6 h-6 text-pink-500 dark:text-pink-400" /></div><p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.comics}</p></div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700"><div className="flex items-center justify-between mb-4"><h3 className="text-gray-500 dark:text-gray-400 font-medium">รายงานที่รอตรวจสอบ</h3><AlertTriangle className="w-6 h-6 text-red-500 dark:text-red-400" /></div><p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.reports}</p></div>
                </div>
                <AnalyticsPanel />
            </div>
        );
    }

    function renderUsers() {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">จัดการผู้ใช้</h1>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                    <div className="p-4 border-b dark:border-gray-700"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 w-5 h-5" /><input type="text" placeholder="ค้นหาชื่อหรืออีเมล..." className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} /></div></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr><th className="px-6 py-3">ผู้ใช้</th><th className="px-6 py-3">สิทธิ์</th><th className="px-6 py-3">สมัครเมื่อ</th><th className="px-6 py-3 text-right">จัดการ</th></tr></thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4"><div className="font-medium text-gray-900 dark:text-white">{user.name}</div><div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div></td>
                                        <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : user.role === 'BANNED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>{ROLE_LABEL[user.role] ?? user.role}</span></td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(user.created_at).toLocaleDateString('th-TH')}</td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            {user.role !== 'ADMIN' && (<><button onClick={() => updateUserRole(user.id, 'ADMIN')} className="text-gray-500 dark:text-gray-400 hover:text-purple-600" title="ตั้งเป็นแอดมิน"><Shield className="w-4 h-4" /></button>{user.role === 'BANNED' ? <button onClick={() => updateUserRole(user.id, 'READER')} className="text-gray-500 dark:text-gray-400 hover:text-green-600" title="ปลดแบน"><CheckCircle className="w-4 h-4" /></button> : <button onClick={() => updateUserRole(user.id, 'BANNED')} className="text-gray-500 dark:text-gray-400 hover:text-red-600" title="แบน"><Ban className="w-4 h-4" /></button>}</>)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    function renderContentSection() {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">จัดการเนื้อหา</h1>
                <div className="flex space-x-4">
                    <button onClick={() => setContentTab('novels')} className={`px-4 py-2 rounded-lg font-medium transition ${contentTab === 'novels' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}><BookOpen className="w-4 h-4 inline mr-2" />นิยาย</button>
                    <button onClick={() => setContentTab('comics')} className={`px-4 py-2 rounded-lg font-medium transition ${contentTab === 'comics' ? 'bg-pink-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}><FileText className="w-4 h-4 inline mr-2" />การ์ตูน</button>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr><th className="px-6 py-3">ชื่อเรื่อง</th><th className="px-6 py-3">ผู้เขียน</th><th className="px-6 py-3">สถานะ</th><th className="px-6 py-3">สร้างเมื่อ</th><th className="px-6 py-3 text-right">จัดการ</th></tr></thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {contentItems.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{item.title}</td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{item.author_name}</td>
                                    <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.status === 'PUBLISHED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : item.status === 'BANNED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>{CONTENT_STATUS_LABEL[item.status] ?? item.status}</span></td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(item.created_at).toLocaleDateString('th-TH')}</td>
                                    <td className="px-6 py-4 text-right space-x-2">{item.status !== 'PUBLISHED' && <button onClick={() => updateContentStatus(item.id, 'PUBLISHED')} className="text-gray-500 dark:text-gray-400 hover:text-green-600" title="เผยแพร่"><CheckCircle className="w-4 h-4" /></button>}{item.status !== 'BANNED' && <button onClick={() => updateContentStatus(item.id, 'BANNED')} className="text-gray-500 dark:text-gray-400 hover:text-red-600" title="ระงับ"><Ban className="w-4 h-4" /></button>}</td>
                                </tr>
                            ))}
                            {contentItems.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">ไม่พบเนื้อหา</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    function renderReports() {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">จัดการรายงาน</h1>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr><th className="px-6 py-3">ผู้รายงาน</th><th className="px-6 py-3">สิ่งที่ถูกรายงาน</th><th className="px-6 py-3">เหตุผล</th><th className="px-6 py-3">สถานะ</th><th className="px-6 py-3">วันที่</th><th className="px-6 py-3 text-right">จัดการ</th></tr></thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {reports.map((report) => (
                                <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{report.reporter_name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold text-indigo-600 dark:text-indigo-400">{REPORT_TARGET_LABEL[report.target_type] ?? report.target_type}</span>: {report.target_type === 'COMMENT' ? (report.target_title ? <a href={`/${report.parent_type === 'COMIC' ? 'comic' : 'novel'}/${report.parent_id}`} target="_blank" rel="noreferrer" className="hover:underline whitespace-pre-line line-clamp-3">{report.comment_author_name}: {report.target_title}</a> : <span className="italic">(ถูกลบแล้ว)</span>) : report.target_title ? <a href={`/${report.target_type === 'COMIC' ? 'comic' : 'novel'}/${report.target_id}`} target="_blank" rel="noreferrer" className="hover:underline">{report.target_title}</a> : report.target_id}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{report.reason}</td>
                                    <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${report.status === 'RESOLVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : report.status === 'IGNORED' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>{REPORT_STATUS_LABEL[report.status] ?? report.status}</span></td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(report.created_at).toLocaleDateString('th-TH')}</td>
                                    <td className="px-6 py-4 text-right space-x-2">{report.status === 'PENDING' && (<>{report.target_type === 'COMMENT' && report.target_title && <button onClick={() => deleteReportedComment(report)} title="ลบคอมเมนต์" className="text-gray-500 dark:text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}<button onClick={() => updateReportStatus(report.id, 'RESOLVED')} className="text-gray-500 dark:text-gray-400 hover:text-green-600" title="จัดการแล้ว"><CheckCircle className="w-4 h-4" /></button><button onClick={() => updateReportStatus(report.id, 'IGNORED')} className="text-gray-500 dark:text-gray-400 hover:text-gray-600" title="ไม่ดำเนินการ"><XCircle className="w-4 h-4" /></button></>)}</td>
                                </tr>
                            ))}
                            {reports.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">ไม่มีรายงาน</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    function renderWriters() {
        const statusColors: Record<string, string> = {
            PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
            APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
            REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
        };
        const statusText: Record<string, string> = { PENDING: 'รอการอนุมัติ', APPROVED: 'อนุมัติแล้ว', REJECTED: 'ไม่อนุมัติ' };

        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">คำขอสมัครนักเขียน</h1>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr><th className="px-6 py-3">ชื่อ</th><th className="px-6 py-3">อีเมล</th><th className="px-6 py-3">เบอร์โทร</th><th className="px-6 py-3">จังหวัด</th><th className="px-6 py-3">สถานะ</th><th className="px-6 py-3">วันที่</th><th className="px-6 py-3 text-right">จัดการ</th></tr></thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {writerRequests.map((req) => (
                                <tr key={req.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{req.title}{req.first_name} {req.last_name}</td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{req.email}</td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{req.phone_number}</td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{req.province}</td>
                                    <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[req.status]}`}>{statusText[req.status]}</span></td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(req.created_at).toLocaleDateString('th-TH')}</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => setSelectedWriter(req)} className="text-gray-500 dark:text-gray-400 hover:text-blue-600" title="ดูรายละเอียด"><Eye className="w-4 h-4" /></button>
                                        {req.status === 'PENDING' && (<>
                                            <button onClick={() => handleWriterAction(req.user_id, 'APPROVED')} className="text-gray-500 dark:text-gray-400 hover:text-green-600" title="อนุมัติ"><CheckCircle className="w-4 h-4" /></button>
                                            <button onClick={() => setRejecting({ userId: req.user_id, reason: '', submitting: false })} className="text-gray-500 dark:text-gray-400 hover:text-red-600" title="ปฏิเสธ"><XCircle className="w-4 h-4" /></button>
                                        </>)}
                                    </td>
                                </tr>
                            ))}
                            {writerRequests.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">ยังไม่มีคำขอ</td></tr>}
                        </tbody>
                    </table>
                </div>
                {selectedWriter && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">รายละเอียดคำขอ</h2>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div><label className="text-sm text-gray-500 dark:text-gray-400">ชื่อ-นามสกุล</label><div className="font-medium dark:text-white">{selectedWriter.title}{selectedWriter.first_name} {selectedWriter.last_name}</div></div>
                                <div><label className="text-sm text-gray-500 dark:text-gray-400">อีเมล</label><div className="font-medium dark:text-white">{selectedWriter.email}</div></div>
                                <div><label className="text-sm text-gray-500 dark:text-gray-400">เลขบัตรประชาชน</label><div className="font-medium dark:text-white">{selectedWriter.id_card_number}</div></div>
                                <div><label className="text-sm text-gray-500 dark:text-gray-400">เบอร์โทร</label><div className="font-medium dark:text-white">{selectedWriter.phone_number}</div></div>
                                <div><label className="text-sm text-gray-500 dark:text-gray-400">จังหวัด</label><div className="font-medium dark:text-white">{selectedWriter.province}</div></div>
                                <div><label className="text-sm text-gray-500 dark:text-gray-400">สถานะ</label><div className="font-medium dark:text-white">{statusText[selectedWriter.status] ?? selectedWriter.status}</div></div>
                                <div><label className="text-sm text-gray-500 dark:text-gray-400">ธนาคาร</label><div className="font-medium dark:text-white">{selectedWriter.bank_name || '-'}</div></div>
                                <div><label className="text-sm text-gray-500 dark:text-gray-400">เลขที่บัญชี / ชื่อบัญชี</label><div className="font-medium dark:text-white">{selectedWriter.bank_account_number || '-'} {selectedWriter.bank_account_name}</div></div>
                                <div><label className="text-sm text-gray-500 dark:text-gray-400">สำเนาบัตรประชาชน</label><div className="font-medium">{selectedWriter.id_card_image ? <a href={selectedWriter.id_card_image} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">ดูไฟล์</a> : <span className="dark:text-white">-</span>}</div></div>
                                <div><label className="text-sm text-gray-500 dark:text-gray-400">สำเนาบัญชีธนาคาร</label><div className="font-medium">{selectedWriter.bank_book_image ? <a href={selectedWriter.bank_book_image} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">ดูไฟล์</a> : <span className="dark:text-white">-</span>}</div></div>
                                {selectedWriter.rejection_reason && <div className="col-span-2"><label className="text-sm text-gray-500 dark:text-gray-400">หมายเหตุ</label><div className="font-medium dark:text-white bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1">{selectedWriter.rejection_reason}</div></div>}
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setSelectedWriter(null)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">ปิด</button>
                                {selectedWriter.status === 'PENDING' && <><button onClick={() => setRejecting({ userId: selectedWriter.user_id, reason: '', submitting: false })} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">ปฏิเสธ</button>
                                    <button onClick={() => handleWriterAction(selectedWriter.user_id, 'APPROVED')} className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800">อนุมัติ</button></>}
                            </div>
                        </div>
                    </div>
                )}
                {rejecting && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => !rejecting.submitting && setRejecting(null)}>
                        <form
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="reject-title"
                            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
                            onClick={(e) => e.stopPropagation()}
                            onSubmit={async (e) => {
                                e.preventDefault();
                                setRejecting({ ...rejecting, submitting: true });
                                await handleWriterAction(rejecting.userId, 'REJECTED', rejecting.reason.trim() || null);
                                setRejecting((current) => current && { ...current, submitting: false });
                            }}
                        >
                            <h2 id="reject-title" className="text-lg font-bold mb-1 text-gray-900 dark:text-white">ปฏิเสธคำขอเป็นนักเขียน</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">เหตุผลจะแสดงให้ผู้สมัครเห็น เพื่อแก้ไขแล้วส่งใหม่ได้</p>
                            <textarea
                                autoFocus
                                rows={4}
                                maxLength={500}
                                value={rejecting.reason}
                                onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value })}
                                onKeyDown={(e) => { if (e.key === 'Escape' && !rejecting.submitting) setRejecting(null); }}
                                placeholder="เช่น สำเนาบัตรประชาชนไม่ชัด (ไม่บังคับ)"
                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                            <div className="flex justify-end gap-3 mt-4">
                                <button type="button" disabled={rejecting.submitting} onClick={() => setRejecting(null)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50">ยกเลิก</button>
                                <button type="submit" disabled={rejecting.submitting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">{rejecting.submitting ? 'กำลังบันทึก...' : 'ปฏิเสธคำขอ'}</button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        );
    }

    function renderCategories() {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">จัดการหมวดหมู่</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-1">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700 sticky top-24">
                            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2"><Plus className="w-5 h-5" /> เพิ่มหมวดหมู่</h2>
                            <form onSubmit={addCategory} className="space-y-4">
                                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อหมวดหมู่</label><input type="text" required value={newCategory.name} onChange={(e) => { const name = e.target.value; const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''); setNewCategory({ name, slug }); }} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="เช่น โรแมนติก" /></div>
                                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug (ใช้ใน URL)</label><input type="text" required value={newCategory.slug} onChange={(e) => setNewCategory({ ...newCategory, slug: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="เช่น romance" /></div>
                                <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">เพิ่มหมวดหมู่</button>
                            </form>
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                            <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"><h3 className="font-medium text-gray-700 dark:text-gray-300">หมวดหมู่ทั้งหมด</h3></div>
                            <div className="divide-y dark:divide-gray-700">
                                {categories.map((category) => (
                                    <div key={category.id} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <div className="flex items-center gap-3"><div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400"><Tag className="w-5 h-5" /></div><div><div className="font-medium text-gray-900 dark:text-white">{category.name}</div><div className="text-sm text-gray-500 dark:text-gray-400">/{category.slug}</div></div></div>
                                        <button onClick={() => deleteCategory(category.id)} className="text-gray-500 dark:text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-5 h-5" /></button>
                                    </div>
                                ))}
                                {categories.length === 0 && <div className="p-8 text-center text-gray-500 dark:text-gray-400">ยังไม่มีหมวดหมู่</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    function renderSettings() {
        return (
            <div className="space-y-6 max-w-2xl">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Settings className="w-6 h-6" /> ตั้งค่าระบบ</h1>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
                    <form onSubmit={saveSettings} className="space-y-6">
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อเว็บไซต์</label><input type="text" value={settings.site_name} onChange={(e) => setSettings({ ...settings, site_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">คำอธิบายเว็บไซต์</label><textarea value={settings.site_description} onChange={(e) => setSettings({ ...settings, site_description: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">อีเมลติดต่อ</label><input type="email" value={settings.contact_email} onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ส่วนแบ่งรายได้นักเขียน (%)</label><input type="number" min={0} max={100} step={1} value={settings.author_share_percent} onChange={(e) => setSettings({ ...settings, author_share_percent: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" /><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ใช้กับการซื้อตอนครั้งถัดไป ไม่ย้อนหลัง</p></div>
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ข้อมูลการชำระเงิน (แสดงในหน้าเติมเหรียญ)</label><textarea value={settings.payment_info} onChange={(e) => setSettings({ ...settings, payment_info: e.target.value })} rows={3} placeholder={'เช่น ธนาคารกสิกรไทย 123-4-56789-0 ชื่อบัญชี ...\nPromptPay 08x-xxx-xxxx'} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" /></div>
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg"><div><div className="font-medium text-gray-900 dark:text-white">โหมดปิดปรับปรุง</div><div className="text-sm text-gray-500 dark:text-gray-400">ผู้ที่ไม่ใช่แอดมินจะเข้าเว็บไม่ได้</div></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={settings.maintenance_mode} onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })} className="sr-only peer" /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div></label></div>
                        <div className="pt-4 border-t dark:border-gray-700"><button type="submit" disabled={saving} className="w-full flex justify-center items-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"><Save className="w-4 h-4" />{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</button></div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
            {/* Sidebar (md and up; phones get the tab strip below instead) */}
            <div className="hidden md:flex w-64 bg-white dark:bg-gray-800 h-screen shadow-md flex-col fixed left-0 top-0 z-40">
                <div className="p-6 flex items-center gap-3 border-b dark:border-gray-700">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">A</div>
                    <span className="text-xl font-bold text-gray-800 dark:text-white">ผู้ดูแลระบบ</span>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {menuItems.map((item) => {
                        const isActive = activeTab === item.key;
                        return (
                            <button key={item.key} onClick={() => setActiveTab(item.key)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ${isActive ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                <item.icon className="w-5 h-5" /><span className="font-medium">{item.name}</span>
                            </button>
                        );
                    })}
                </nav>
                <div className="p-4 border-t dark:border-gray-700">
                    <button onClick={() => signOut({ callbackUrl: '/' })} className="flex items-center gap-3 px-4 py-3 w-full text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <LogOut className="w-5 h-5" /><span className="font-medium">ออกจากระบบ</span>
                    </button>
                </div>
            </div>
            {/* Main Content */}
            <div className="md:pl-64 flex-1 min-w-0">
                {/* Tab strip for phones; sign-out is in the Navbar's mobile menu */}
                <nav className="md:hidden flex gap-2 overflow-x-auto [scrollbar-width:none] px-4 pt-4 pb-1">
                    {menuItems.map((item) => (
                        <button key={item.key} onClick={() => setActiveTab(item.key)} className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm whitespace-nowrap flex-shrink-0 transition-colors ${activeTab === item.key ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}>
                            <item.icon className="w-4 h-4" />{item.name}
                        </button>
                    ))}
                </nav>
                <main className="p-4 md:p-8">{renderContent()}</main>
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
