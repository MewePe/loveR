"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, UserCog } from "lucide-react";
import UserDetail from "@/components/admin/UserDetail";
import { ActionButton, Badge, EmptyRow, PageHeader, Pagination, card, fetchJson, fmtDate, input, qs, rowHover, td, th, thead } from "@/components/admin/ui";
import { PanelProps } from "@/components/admin/types";
import { ROLE_LABEL } from "@/lib/adminActions";
import { useToast } from "@/components/Toast";

export interface AdminUserRow {
    id: string; name: string | null; email: string; username: string | null; role: string; base_role: string;
    is_banned: boolean; ban_reason: string | null; coins: number; created_at: string;
}
interface UserList { users: AdminUserRow[]; total: number; page: number; pageSize: number; }

export const ROLE_TONE: Record<string, "purple" | "blue" | "gray"> = { ADMIN: "purple", AUTHOR: "blue", READER: "gray" };

// ผู้ใช้ tab: filterable, paged list. ?user=<id> opens the detail view instead.
export default function UsersPanel({ navigate, params }: PanelProps) {
    const toast = useToast();
    const userId = params.get("user");
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState(""); // search, debounced
    const [role, setRole] = useState("");
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const [data, setData] = useState<UserList | null>(null);

    useEffect(() => {
        const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const load = useCallback(async () => {
        setData(await fetchJson<UserList>(`/api/admin/users?${qs({ search: query, role, status, page })}`, toast.error));
    }, [query, role, status, page, toast.error]);
    useEffect(() => { if (!userId) load(); }, [load, userId]);

    if (userId) return <UserDetail id={userId} onBack={() => navigate("users")} navigate={navigate} />;

    const open = (id: string) => navigate("users", { user: id });

    return (
        <div className="space-y-6">
            <PageHeader title="จัดการผู้ใช้" subtitle="กดที่ผู้ใช้เพื่อดูรายละเอียด เปลี่ยนสิทธิ์ แบน หรือปรับยอดเหรียญ" />
            <div className={`${card} overflow-hidden`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col lg:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 w-5 h-5" />
                        <input type="search" placeholder="ค้นหาชื่อ อีเมล หรือชื่อผู้ใช้..." aria-label="ค้นหาผู้ใช้" className={`w-full pl-10 ${input}`} value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <div className="flex gap-3">
                        <select aria-label="กรองตามสิทธิ์" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className={`flex-1 ${input}`}>
                            <option value="">ทุกสิทธิ์</option>
                            <option value="READER">ผู้อ่าน</option>
                            <option value="AUTHOR">นักเขียน</option>
                            <option value="ADMIN">แอดมิน</option>
                        </select>
                        <select aria-label="กรองตามสถานะ" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={`flex-1 ${input}`}>
                            <option value="">ทุกสถานะ</option>
                            <option value="active">ปกติ</option>
                            <option value="banned">ถูกแบน</option>
                        </select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className={thead}><tr><th className={th}>ผู้ใช้</th><th className={th}>สิทธิ์</th><th className={th}>สถานะ</th><th className={`${th} text-right`}>เหรียญ</th><th className={th}>สมัครเมื่อ</th><th className={`${th} text-right`}>จัดการ</th></tr></thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {data?.users.map((u) => (
                                <tr key={u.id} className={`${rowHover} cursor-pointer`} onClick={() => open(u.id)}>
                                    <td className="px-4 py-3 min-w-48">
                                        <div className="font-medium text-gray-900 dark:text-white">{u.name || "(ไม่มีชื่อ)"}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 break-all">{u.email}</div>
                                    </td>
                                    <td className={td}><Badge tone={ROLE_TONE[u.base_role] ?? "gray"}>{ROLE_LABEL[u.base_role] ?? u.base_role}</Badge></td>
                                    <td className={td}>{u.is_banned ? <Badge tone="red">ถูกแบน</Badge> : <Badge tone="green">ปกติ</Badge>}</td>
                                    <td className={`${td} text-right font-medium text-gray-900 dark:text-white tabular-nums`}>{u.coins.toLocaleString("th-TH")}</td>
                                    <td className={`${td} whitespace-nowrap`}>{fmtDate(u.created_at)}</td>
                                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                        <ActionButton icon={UserCog} label="จัดการ" title="ดูรายละเอียดและจัดการผู้ใช้" onClick={() => open(u.id)} />
                                    </td>
                                </tr>
                            ))}
                            {data && data.users.length === 0 && <EmptyRow colSpan={6} text="ไม่พบผู้ใช้" />}
                            {!data && <EmptyRow colSpan={6} text="กำลังโหลด..." />}
                        </tbody>
                    </table>
                </div>
                {data && <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onChange={setPage} />}
            </div>
        </div>
    );
}
