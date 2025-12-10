"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { BarChart3, Users, BookOpen, AlertTriangle, Tag, Settings, LogOut, Search, Shield, Ban, CheckCircle, XCircle, Eye, Trash2, Plus, Save, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Image from 'next/image';

type TabType = 'dashboard' | 'users' | 'content' | 'reports' | 'writers' | 'categories' | 'settings';

const menuItems = [
    { name: 'Dashboard', key: 'dashboard' as TabType, icon: BarChart3 },
    { name: 'Users', key: 'users' as TabType, icon: Users },
    { name: 'Content', key: 'content' as TabType, icon: BookOpen },
    { name: 'Reports', key: 'reports' as TabType, icon: AlertTriangle },
    { name: 'Writer Requests', key: 'writers' as TabType, icon: Users },
    { name: 'Categories', key: 'categories' as TabType, icon: Tag },
    { name: 'Settings', key: 'settings' as TabType, icon: Settings },
];

interface AdminStats { users: number; novels: number; chapters: number; comics: number; reports: number; }
interface User { id: string; name: string; email: string; role: string; created_at: string; }
interface ContentItem { id: string; title: string; author_name: string; status: string; created_at: string; }
interface Report { id: string; reporter_name: string; target_type: string; target_id: string; reason: string; status: string; created_at: string; }
interface WriterRequest { id: string; user_id: string; user_name: string; user_email: string; prefix: string; first_name: string; last_name: string; id_card_number: string; phone: string; province: string; status: string; admin_note: string; created_at: string; }
interface Category { id: string; name: string; slug: string; }

export default function AdminPanel() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>('dashboard');
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

    // Categories state
    const [categories, setCategories] = useState<Category[]>([]);
    const [newCategory, setNewCategory] = useState({ name: '', slug: '' });

    // Settings state
    const [settings, setSettings] = useState({ site_name: '', site_description: '', contact_email: '', maintenance_mode: false });
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

    useEffect(() => {
        if (session?.user?.role === 'ADMIN') {
            fetchTabData();
        }
    }, [activeTab, contentTab, userSearch]);

    async function fetchData() {
        setLoading(true);
        try {
            const res = await fetch('/api/admin', { credentials: 'include' });
            if (res.ok) setStats(await res.json());
        } finally {
            setLoading(false);
        }
    }

    async function fetchTabData() {
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
                const writersRes = await fetch('/api/admin/author-requests', { credentials: 'include' });
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
                    setSettings({ site_name: data.site_name || '', site_description: data.site_description || '', contact_email: data.contact_email || '', maintenance_mode: !!data.maintenance_mode });
                }
                break;
        }
    }

    // Action handlers
    async function updateUserRole(id: string, newRole: string) {
        if (!confirm(`Change role to ${newRole}?`)) return;
        const res = await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: newRole }), credentials: 'include' });
        if (res.ok) fetchTabData();
        else alert('Failed to update user');
    }

    async function updateContentStatus(id: string, newStatus: string) {
        if (!confirm(`Change status to ${newStatus}?`)) return;
        const res = await fetch(`/api/admin/content/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus, type: contentTab }), credentials: 'include' });
        if (res.ok) fetchTabData();
        else alert('Failed to update');
    }

    async function updateReportStatus(id: string, newStatus: string) {
        const res = await fetch(`/api/admin/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }), credentials: 'include' });
        if (res.ok) fetchTabData();
    }



    async function addCategory(e: React.FormEvent) {
        e.preventDefault();
        const res = await fetch('/api/admin/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCategory), credentials: 'include' });
        if (res.ok) { setNewCategory({ name: '', slug: '' }); fetchTabData(); }
        else alert('Failed to add category');
    }

    async function deleteCategory(id: string) {
        if (!confirm('Delete this category?')) return;
        const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) fetchTabData();
    }

    async function saveSettings(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings), credentials: 'include' });
        if (res.ok) alert('Settings saved');
        else alert('Failed to save');
        setSaving(false);
    }

    async function handleWriterAction(requestId: string, action: 'APPROVED' | 'REJECTED', note?: string) {
        const adminNote = action === 'REJECTED' ? prompt('หมายเหตุสำหรับการปฏิเสธ (ถ้ามี):') : null;
        const res = await fetch('/api/admin/author-requests', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, action, adminNote }),
            credentials: 'include'
        });
        if (res.ok) {
            alert(action === 'APPROVED' ? 'อนุมัติเรียบร้อย' : 'ปฏิเสธเรียบร้อย');
            fetchTabData();
        } else {
            alert('เกิดข้อผิดพลาด');
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

    const chartData = [
        { name: 'Users', count: stats?.users || 0 },
        { name: 'Novels', count: stats?.novels || 0 },
        { name: 'Comics', count: stats?.comics || 0 },
        { name: 'Reports', count: stats?.reports || 0 },
    ];

    function renderContent() {
        switch (activeTab) {
            case 'dashboard': return renderDashboard();
            case 'users': return renderUsers();
            case 'content': return renderContentSection();
            case 'reports': return renderReports();
            case 'writers': return renderWriters();
            case 'categories': return renderCategories();
            case 'settings': return renderSettings();
            default: return null;
        }
    }

    function renderDashboard() {
        return (
            <div className="space-y-6">
                <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h1><p className="text-gray-500 dark:text-gray-400">Welcome back, Admin.</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700"><div className="flex items-center justify-between mb-4"><h3 className="text-gray-500 dark:text-gray-400 font-medium">Total Users</h3><Users className="w-6 h-6 text-blue-500" /></div><p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.users}</p></div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700"><div className="flex items-center justify-between mb-4"><h3 className="text-gray-500 dark:text-gray-400 font-medium">Total Novels</h3><BookOpen className="w-6 h-6 text-indigo-500" /></div><p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.novels}</p></div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700"><div className="flex items-center justify-between mb-4"><h3 className="text-gray-500 dark:text-gray-400 font-medium">Total Comics</h3><FileText className="w-6 h-6 text-pink-500" /></div><p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.comics}</p></div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700"><div className="flex items-center justify-between mb-4"><h3 className="text-gray-500 dark:text-gray-400 font-medium">Pending Reports</h3><AlertTriangle className="w-6 h-6 text-red-500" /></div><p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.reports}</p></div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700 h-80">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Platform Statistics</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} /><XAxis dataKey="name" stroke="#6B7280" /><YAxis stroke="#6B7280" /><Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }} /><Legend /><Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} /></BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    function renderUsers() {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                    <div className="p-4 border-b dark:border-gray-700"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" /><input type="text" placeholder="Search users..." className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} /></div></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr><th className="px-6 py-3">User</th><th className="px-6 py-3">Role</th><th className="px-6 py-3">Joined</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4"><div className="font-medium text-gray-900 dark:text-white">{user.name}</div><div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div></td>
                                        <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : user.role === 'BANNED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>{user.role}</span></td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(user.created_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            {user.role !== 'ADMIN' && (<><button onClick={() => updateUserRole(user.id, 'ADMIN')} className="text-gray-400 hover:text-purple-600" title="Promote to Admin"><Shield className="w-4 h-4" /></button>{user.role === 'BANNED' ? <button onClick={() => updateUserRole(user.id, 'READER')} className="text-gray-400 hover:text-green-600" title="Unban"><CheckCircle className="w-4 h-4" /></button> : <button onClick={() => updateUserRole(user.id, 'BANNED')} className="text-gray-400 hover:text-red-600" title="Ban"><Ban className="w-4 h-4" /></button>}</>)}
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Management</h1>
                <div className="flex space-x-4">
                    <button onClick={() => setContentTab('novels')} className={`px-4 py-2 rounded-lg font-medium transition ${contentTab === 'novels' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}><BookOpen className="w-4 h-4 inline mr-2" />Novels</button>
                    <button onClick={() => setContentTab('comics')} className={`px-4 py-2 rounded-lg font-medium transition ${contentTab === 'comics' ? 'bg-pink-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}><FileText className="w-4 h-4 inline mr-2" />Comics</button>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr><th className="px-6 py-3">Title</th><th className="px-6 py-3">Author</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Created</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {contentItems.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{item.title}</td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{item.author_name}</td>
                                    <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.status === 'PUBLISHED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : item.status === 'BANNED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>{item.status}</span></td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(item.created_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-right space-x-2">{item.status !== 'PUBLISHED' && <button onClick={() => updateContentStatus(item.id, 'PUBLISHED')} className="text-gray-400 hover:text-green-600"><CheckCircle className="w-4 h-4" /></button>}{item.status !== 'BANNED' && <button onClick={() => updateContentStatus(item.id, 'BANNED')} className="text-gray-400 hover:text-red-600"><Ban className="w-4 h-4" /></button>}</td>
                                </tr>
                            ))}
                            {contentItems.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No content found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    function renderReports() {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Report Management</h1>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr><th className="px-6 py-3">Reporter</th><th className="px-6 py-3">Target</th><th className="px-6 py-3">Reason</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Date</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {reports.map((report) => (
                                <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{report.reporter_name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold text-indigo-600 dark:text-indigo-400">{report.target_type}</span>: {report.target_id}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{report.reason}</td>
                                    <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${report.status === 'RESOLVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : report.status === 'IGNORED' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>{report.status}</span></td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(report.created_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-right space-x-2">{report.status === 'PENDING' && (<><button onClick={() => updateReportStatus(report.id, 'RESOLVED')} className="text-gray-400 hover:text-green-600"><CheckCircle className="w-4 h-4" /></button><button onClick={() => updateReportStatus(report.id, 'IGNORED')} className="text-gray-400 hover:text-gray-600"><XCircle className="w-4 h-4" /></button></>)}</td>
                                </tr>
                            ))}
                            {reports.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No reports found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    function renderWriters() {
        const statusColors: any = {
            PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
            APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
            REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
        };
        const statusText: any = { PENDING: 'รอการอนุมัติ', APPROVED: 'อนุมัติแล้ว', REJECTED: 'ไม่อนุมัติ' };

        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">คำขอสมัครนักเขียน</h1>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr><th className="px-6 py-3">ชื่อ</th><th className="px-6 py-3">อีเมล</th><th className="px-6 py-3">เบอร์โทร</th><th className="px-6 py-3">จังหวัด</th><th className="px-6 py-3">สถานะ</th><th className="px-6 py-3">วันที่</th><th className="px-6 py-3 text-right">จัดการ</th></tr></thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {writerRequests.map((req) => (
                                <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{req.prefix}{req.first_name} {req.last_name}</td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{req.user_email}</td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{req.phone}</td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{req.province}</td>
                                    <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[req.status]}`}>{statusText[req.status]}</span></td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(req.created_at).toLocaleDateString('th-TH')}</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => setSelectedWriter(req)} className="text-gray-400 hover:text-blue-600"><Eye className="w-4 h-4" /></button>
                                        {req.status === 'PENDING' && (<>
                                            <button onClick={() => handleWriterAction(req.id, 'APPROVED')} className="text-gray-400 hover:text-green-600" title="อนุมัติ"><CheckCircle className="w-4 h-4" /></button>
                                            <button onClick={() => handleWriterAction(req.id, 'REJECTED')} className="text-gray-400 hover:text-red-600" title="ปฏิเสธ"><XCircle className="w-4 h-4" /></button>
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
                                <div><label className="text-sm text-gray-500">ชื่อ-นามสกุล</label><div className="font-medium dark:text-white">{selectedWriter.prefix}{selectedWriter.first_name} {selectedWriter.last_name}</div></div>
                                <div><label className="text-sm text-gray-500">อีเมล</label><div className="font-medium dark:text-white">{selectedWriter.user_email}</div></div>
                                <div><label className="text-sm text-gray-500">เลขบัตรประชาชน</label><div className="font-medium dark:text-white">{selectedWriter.id_card_number}</div></div>
                                <div><label className="text-sm text-gray-500">เบอร์โทร</label><div className="font-medium dark:text-white">{selectedWriter.phone}</div></div>
                                <div><label className="text-sm text-gray-500">จังหวัด</label><div className="font-medium dark:text-white">{selectedWriter.province}</div></div>
                                <div><label className="text-sm text-gray-500">สถานะ</label><div className="font-medium dark:text-white">{selectedWriter.status}</div></div>
                                {selectedWriter.admin_note && <div className="col-span-2"><label className="text-sm text-gray-500">หมายเหตุ</label><div className="font-medium dark:text-white bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1">{selectedWriter.admin_note}</div></div>}
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setSelectedWriter(null)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">ปิด</button>
                                {selectedWriter.status === 'PENDING' && <><button onClick={() => handleWriterAction(selectedWriter.id, 'REJECTED')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">ปฏิเสธ</button>
                                    <button onClick={() => handleWriterAction(selectedWriter.id, 'APPROVED')} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">อนุมัติ</button></>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    function renderCategories() {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Category Management</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-1">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700 sticky top-24">
                            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2"><Plus className="w-5 h-5" /> Add Category</h2>
                            <form onSubmit={addCategory} className="space-y-4">
                                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label><input type="text" required value={newCategory.name} onChange={(e) => { const name = e.target.value; const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''); setNewCategory({ name, slug }); }} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="e.g. Romance" /></div>
                                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug</label><input type="text" required value={newCategory.slug} onChange={(e) => setNewCategory({ ...newCategory, slug: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="e.g. romance" /></div>
                                <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">Add Category</button>
                            </form>
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                            <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"><h3 className="font-medium text-gray-700 dark:text-gray-300">All Categories</h3></div>
                            <div className="divide-y dark:divide-gray-700">
                                {categories.map((category) => (
                                    <div key={category.id} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <div className="flex items-center gap-3"><div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400"><Tag className="w-5 h-5" /></div><div><div className="font-medium text-gray-900 dark:text-white">{category.name}</div><div className="text-sm text-gray-500 dark:text-gray-400">/{category.slug}</div></div></div>
                                        <button onClick={() => deleteCategory(category.id)} className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-5 h-5" /></button>
                                    </div>
                                ))}
                                {categories.length === 0 && <div className="p-8 text-center text-gray-500 dark:text-gray-400">No categories found.</div>}
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Settings className="w-6 h-6" /> System Settings</h1>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
                    <form onSubmit={saveSettings} className="space-y-6">
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site Name</label><input type="text" value={settings.site_name} onChange={(e) => setSettings({ ...settings, site_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site Description</label><textarea value={settings.site_description} onChange={(e) => setSettings({ ...settings, site_description: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Email</label><input type="email" value={settings.contact_email} onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" /></div>
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg"><div><div className="font-medium text-gray-900 dark:text-white">Maintenance Mode</div><div className="text-sm text-gray-500 dark:text-gray-400">Disable site access for non-admins</div></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={settings.maintenance_mode} onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })} className="sr-only peer" /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div></label></div>
                        <div className="pt-4 border-t dark:border-gray-700"><button type="submit" disabled={saving} className="w-full flex justify-center items-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"><Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Settings'}</button></div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
            {/* Sidebar */}
            <div className="w-64 bg-white dark:bg-gray-800 h-screen shadow-md flex flex-col fixed left-0 top-0 z-40">
                <div className="p-6 flex items-center gap-3 border-b dark:border-gray-700">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">A</div>
                    <span className="text-xl font-bold text-gray-800 dark:text-white">Admin Panel</span>
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
                    <button onClick={() => signOut({ callbackUrl: '/' })} className="flex items-center gap-3 px-4 py-3 w-full text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <LogOut className="w-5 h-5" /><span className="font-medium">ออกจากระบบ</span>
                    </button>
                </div>
            </div>
            {/* Main Content */}
            <div className="pl-64 flex-1"><main className="p-8">{renderContent()}</main></div>
        </div>
    );
}
