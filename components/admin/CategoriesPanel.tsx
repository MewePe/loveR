"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Tag, Trash2 } from "lucide-react";
import { ActionButton, PageHeader, card, fetchJson, input, sendJson } from "@/components/admin/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

interface Category { id: string; name: string; slug: string; }

// หมวดหมู่ tab
export default function CategoriesPanel() {
    const toast = useToast();
    const confirm = useConfirm();
    const [categories, setCategories] = useState<Category[] | null>(null);
    const [form, setForm] = useState({ name: "", slug: "" });
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setCategories(await fetchJson<Category[]>("/api/admin/categories", toast.error));
    }, [toast.error]);
    useEffect(() => { load(); }, [load]);

    async function add(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        const ok = await sendJson("/api/admin/categories", "POST", form, toast.error);
        setSaving(false);
        if (ok) {
            toast.success(`เพิ่มหมวด "${form.name}" แล้ว`);
            setForm({ name: "", slug: "" });
            await load();
        }
    }

    async function remove(c: Category) {
        if (!(await confirm(`ลบหมวด "${c.name}"? เรื่องที่อยู่ในหมวดนี้จะถูกเอาหมวดนี้ออก`, { danger: true }))) return;
        const ok = await fetchJson(`/api/admin/categories/${c.id}`, toast.error, { method: "DELETE" });
        if (ok) {
            toast.success("ลบหมวดหมู่แล้ว");
            await load();
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader title="จัดการหมวดหมู่" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`${card} p-5 h-fit`}>
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2"><Plus className="w-5 h-5" /> เพิ่มหมวดหมู่</h2>
                    <form onSubmit={add} className="space-y-4">
                        <div>
                            <label htmlFor="cat-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อหมวดหมู่</label>
                            <input id="cat-name" type="text" required value={form.name} onChange={(e) => { const name = e.target.value; setForm({ name, slug: name.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, "") }); }} className={`w-full ${input}`} placeholder="เช่น โรแมนติก" />
                        </div>
                        <div>
                            <label htmlFor="cat-slug" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug (ใช้ใน URL)</label>
                            <input id="cat-slug" type="text" required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={`w-full ${input}`} placeholder="เช่น romance" />
                        </div>
                        <button type="submit" disabled={saving} className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? "กำลังเพิ่ม..." : "เพิ่มหมวดหมู่"}</button>
                    </form>
                </div>
                <div className={`${card} overflow-hidden md:col-span-2`}>
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"><h3 className="font-medium text-gray-700 dark:text-gray-300">หมวดหมู่ทั้งหมด ({categories?.length ?? 0})</h3></div>
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {categories?.map((c) => (
                            <div key={c.id} className="p-4 flex justify-between items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400"><Tag className="w-5 h-5" /></div>
                                    <div className="min-w-0"><div className="font-medium text-gray-900 dark:text-white">{c.name}</div><div className="text-sm text-gray-500 dark:text-gray-400 break-all">/{c.slug}</div></div>
                                </div>
                                <ActionButton icon={Trash2} label="ลบ" onClick={() => remove(c)} title={`ลบหมวด "${c.name}"`} />
                            </div>
                        ))}
                        {categories && categories.length === 0 && <div className="p-8 text-center text-gray-500 dark:text-gray-400">ยังไม่มีหมวดหมู่</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}
