"use client";

import { useEffect, useState } from "react";
import { Save, Settings } from "lucide-react";
import { card, fetchJson, input, sendJson } from "@/components/admin/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

interface SiteSettings { site_name: string; site_description: string; contact_email: string; maintenance_mode: boolean; author_share_percent: number; payment_info: string; }

// ตั้งค่า tab (system_settings)
export default function SettingsPanel() {
    const toast = useToast();
    const confirm = useConfirm();
    const [settings, setSettings] = useState<SiteSettings | null>(null);
    const [saved, setSaved] = useState<SiteSettings | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchJson<Partial<SiteSettings>>("/api/admin/settings", toast.error).then((data) => {
            if (!data) return;
            const s = { site_name: data.site_name || "", site_description: data.site_description || "", contact_email: data.contact_email || "", maintenance_mode: !!data.maintenance_mode, author_share_percent: data.author_share_percent ?? 70, payment_info: data.payment_info || "" };
            setSettings(s);
            setSaved(s);
        });
    }, [toast.error]);

    if (!settings) return <div className="h-40 flex items-center justify-center text-gray-500 dark:text-gray-400">กำลังโหลด...</div>;

    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (!settings || !saved) return;
        // Only send what changed, so the admin log names the settings that were actually edited
        const changed = Object.fromEntries((Object.keys(settings) as (keyof SiteSettings)[])
            .filter((k) => settings[k] !== saved[k]).map((k) => [k, settings[k]]));
        if (Object.keys(changed).length === 0) {
            toast.success("ไม่มีการเปลี่ยนแปลง");
            return;
        }
        // Changes that affect every user get an extra confirmation
        const warnings = [
            settings.maintenance_mode !== saved.maintenance_mode && (settings.maintenance_mode ? "เปิดโหมดปิดปรับปรุง: ผู้ที่ไม่ใช่แอดมินจะเข้าเว็บไม่ได้" : "ปิดโหมดปิดปรับปรุง: ทุกคนจะเข้าเว็บได้ตามปกติ"),
            settings.author_share_percent !== saved.author_share_percent && `เปลี่ยนส่วนแบ่งนักเขียนจาก ${saved.author_share_percent}% เป็น ${settings.author_share_percent}% (มีผลกับการซื้อครั้งถัดไป)`,
        ].filter(Boolean);
        if (warnings.length && !(await confirm(`${warnings.join("\n")}\n\nบันทึกการตั้งค่า?`))) return;
        setSaving(true);
        const ok = await sendJson("/api/admin/settings", "POST", changed, toast.error);
        setSaving(false);
        if (ok) {
            toast.success("บันทึกการตั้งค่าแล้ว");
            setSaved(settings);
        }
    }

    const set = (patch: Partial<SiteSettings>) => setSettings({ ...settings, ...patch });
    const label = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

    return (
        <div className="space-y-6 max-w-2xl">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Settings className="w-6 h-6" /> ตั้งค่าระบบ</h1>
            <div className={`${card} p-5 sm:p-6`}>
                <form onSubmit={save} className="space-y-6">
                    <div><label htmlFor="s-name" className={label}>ชื่อเว็บไซต์</label><input id="s-name" type="text" value={settings.site_name} onChange={(e) => set({ site_name: e.target.value })} className={`w-full ${input}`} /></div>
                    <div><label htmlFor="s-desc" className={label}>คำอธิบายเว็บไซต์</label><textarea id="s-desc" value={settings.site_description} onChange={(e) => set({ site_description: e.target.value })} rows={3} className={`w-full ${input}`} /></div>
                    <div><label htmlFor="s-email" className={label}>อีเมลติดต่อ</label><input id="s-email" type="email" value={settings.contact_email} onChange={(e) => set({ contact_email: e.target.value })} className={`w-full ${input}`} /></div>
                    <div><label htmlFor="s-share" className={label}>ส่วนแบ่งรายได้นักเขียน (%)</label><input id="s-share" type="number" min={0} max={100} step={1} value={settings.author_share_percent} onChange={(e) => set({ author_share_percent: Number(e.target.value) })} className={`w-full ${input}`} /><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ใช้กับการซื้อตอนและการสนับสนุนครั้งถัดไป ไม่ย้อนหลัง</p></div>
                    <div><label htmlFor="s-pay" className={label}>ข้อมูลการชำระเงิน (แสดงในหน้าเติมเหรียญ)</label><textarea id="s-pay" value={settings.payment_info} onChange={(e) => set({ payment_info: e.target.value })} rows={3} placeholder={"เช่น ธนาคารกสิกรไทย 123-4-56789-0 ชื่อบัญชี ...\nPromptPay 08x-xxx-xxxx"} className={`w-full ${input}`} /></div>
                    <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <div><div className="font-medium text-gray-900 dark:text-white" id="s-maint-label">โหมดปิดปรับปรุง</div><div className="text-sm text-gray-500 dark:text-gray-400">ผู้ที่ไม่ใช่แอดมินจะเข้าเว็บไม่ได้</div></div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0"><input type="checkbox" aria-labelledby="s-maint-label" checked={settings.maintenance_mode} onChange={(e) => set({ maintenance_mode: e.target.checked })} className="sr-only peer" /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div></label>
                    </div>
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700"><button type="submit" disabled={saving} className="w-full flex justify-center items-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"><Save className="w-4 h-4" />{saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}</button></div>
                </form>
            </div>
        </div>
    );
}
