"use client";
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { BookOpen, Edit, Eye, FileText, ImageIcon, Plus, Send, Trash2 } from 'lucide-react';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { Work, WorkKind, WORK_KINDS } from './types';

interface WorksPanelProps {
    kind: WorkKind;
    works: Work[];
    onCreate: () => void;
    onEdit: (work: Work) => void;
    onChanged: () => void; // reload after publish/delete
}

// "นิยายของฉัน" / "การ์ตูนของฉัน" tab: the author's novels or comics with publish, manage, edit and delete
export default function WorksPanel({ kind, works, onCreate, onEdit, onChanged }: WorksPanelProps) {
    const toast = useToast();
    const confirm = useConfirm();
    const router = useRouter();
    const k = WORK_KINDS[kind];
    const Icon = kind === 'novel' ? BookOpen : ImageIcon;

    async function handlePublish(id: string) {
        if (!(await confirm(`ต้องการเผยแพร่${k.label}นี้หรือไม่?`))) return;
        try {
            const res = await fetch(`${k.api}/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'PUBLISHED' }),
                credentials: 'include',
            });
            if (res.ok) {
                toast.success(`เผยแพร่${k.label}สำเร็จ`);
                onChanged();
            } else {
                toast.error('เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error(error);
        }
    }

    async function handleDelete(id: string) {
        if (!(await confirm(k.deleteConfirm, { danger: true }))) return;
        try {
            const res = await fetch(`${k.api}/${id}`, { method: 'DELETE', credentials: 'include' });
            if (res.ok) {
                toast.success(`ลบ${k.label}สำเร็จ`);
                onChanged();
            } else {
                toast.error('เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error(error);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{k.label}ของฉัน</h1>
                <button
                    onClick={onCreate}
                    className={`${k.button} text-white px-4 py-2 rounded-lg font-medium transition shadow-sm flex items-center gap-2`}
                >
                    <Plus className="w-5 h-5" />
                    สร้าง{k.label}ใหม่
                </button>
            </div>

            {works.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {works.map((work) => (
                        <div key={work.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden hover:shadow-md transition">
                            <div className={`h-32 bg-gradient-to-br ${k.cover} flex items-center justify-center relative`}>
                                {work.cover_image ? (
                                    <Image src={work.cover_image} alt={work.title} width={80} height={120} className="object-cover" />
                                ) : (
                                    <Icon className="w-12 h-12 text-white/50" />
                                )}
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-gray-900 dark:text-white truncate">{work.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{work.description}</p>
                                <div className="flex items-center justify-between mt-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${work.status === 'PUBLISHED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                                        {work.status === 'PUBLISHED' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}
                                    </span>
                                    <div className="flex items-center gap-1 text-sm text-gray-400">
                                        <Eye className="w-4 h-4" />
                                        <span>{work.views || 0}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-4 pt-3 border-t dark:border-gray-700">
                                    {work.status === 'DRAFT' && (
                                        <button
                                            onClick={() => handlePublish(work.id)}
                                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                                        >
                                            <Send className="w-4 h-4" />
                                            เผยแพร่
                                        </button>
                                    )}
                                    <button
                                        onClick={() => router.push(k.manageUrl(work.id))}
                                        className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 ${k.button} text-white text-sm rounded-lg transition`}
                                    >
                                        <FileText className="w-4 h-4" />
                                        {k.manageLabel}
                                    </button>
                                    <button
                                        onClick={() => onEdit(work)}
                                        className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(work.id)}
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
                    <Icon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">ยังไม่มี{k.label}</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">เริ่มสร้าง{k.label}เรื่องแรกของคุณเลย!</p>
                    <button onClick={onCreate} className={`${k.button} text-white px-6 py-2 rounded-lg font-medium transition`}>
                        สร้าง{k.label}ใหม่
                    </button>
                </div>
            )}
        </div>
    );
}
