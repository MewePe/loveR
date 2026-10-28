"use client";

import { Flag, ShieldCheck } from "lucide-react";
import { ActionButton, PageHeader, card } from "@/components/admin/ui";
import { PanelProps } from "@/components/admin/types";

// คิวตรวจเนื้อหา: placeholder for scope item 12 (automatic content check by API). The menu, its badge
// (/api/admin/counts → moderation, always 0 for now) and this page exist so the feature can slot in later.
export default function ModerationPanel({ navigate }: PanelProps) {
    return (
        <div className="space-y-6">
            <PageHeader title="คิวตรวจเนื้อหา" subtitle="เนื้อหาที่ระบบตรวจอัตโนมัติแล้วพบว่าอาจไม่เหมาะสม" />
            <div className={`${card} p-6 sm:p-10 text-center`}>
                <ShieldCheck className="w-12 h-12 mx-auto text-indigo-600 dark:text-indigo-400 mb-4" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">ยังไม่ได้เปิดใช้การตรวจเนื้อหาอัตโนมัติ</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-6">
                    เมื่อเปิดใช้ ระบบจะตรวจคอมเมนต์ บท/ตอน ชื่อเรื่อง และเรื่องย่อด้วย API ตรวจเนื้อหา
                    รายการที่ถูกตีธงจะมารอให้แอดมินตัดสินที่หน้านี้ โดยไม่บล็อกการโพสต์อัตโนมัติ
                </p>
                <ActionButton icon={Flag} label="ไปที่รายงานจากผู้อ่าน" small={false} onClick={() => navigate("reports")} />
            </div>
        </div>
    );
}
