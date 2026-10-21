"use client";
import { Eye, Plus } from 'lucide-react';
import { Work } from './types';

export interface AuthorStats { novels: number; comics: number; views: number; }

interface DashboardPanelProps {
    stats: AuthorStats;
    novels: Work[];
    onCreateNovel: () => void;
}

// "ภาพรวมนักเขียน" tab: totals from /api/author/stats and the latest novels
export default function DashboardPanel({ stats, novels, onCreateNovel }: DashboardPanelProps) {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ภาพรวมนักเขียน</h1>
                    <p className="text-gray-500 dark:text-gray-400">ยินดีต้อนรับกลับมา!</p>
                </div>
                <button
                    onClick={onCreateNovel}
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
                        {novels.slice(0, 6).map((novel) => (
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
