"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import Link from 'next/link';

export default function AdminSettings() {
    const { data: session } = useSession();
    const [settings, setSettings] = useState({
        site_name: '',
        site_description: '',
        contact_email: '',
        maintenance_mode: false,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (session?.user?.role !== 'ADMIN') return;
        fetchSettings();
    }, [session]);

    async function fetchSettings() {
        try {
            const res = await fetch('/api/admin/settings');
            if (res.ok) {
                const data = await res.json();
                setSettings({
                    site_name: data.site_name || '',
                    site_description: data.site_description || '',
                    contact_email: data.contact_email || '',
                    maintenance_mode: !!data.maintenance_mode,
                });
            }
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });

            if (res.ok) {
                alert('Settings saved successfully');
            } else {
                alert('Failed to save settings');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <SettingsIcon className="w-6 h-6" /> System Settings
                    </h1>
                    <Link href="/admin" className="text-indigo-600 hover:underline">Back to Dashboard</Link>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site Name</label>
                            <input
                                type="text"
                                value={settings.site_name}
                                onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site Description</label>
                            <textarea
                                value={settings.site_description}
                                onChange={(e) => setSettings({ ...settings, site_description: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Email</label>
                            <input
                                type="email"
                                value={settings.contact_email}
                                onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div>
                                <div className="font-medium text-gray-900 dark:text-white">Maintenance Mode</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Disable site access for non-admins</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.maintenance_mode}
                                    onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        <div className="pt-4 border-t dark:border-gray-700">
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full flex justify-center items-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
