// "5 นาทีที่แล้ว" style relative time (falls back to a Thai date after a week). No imports, so both server
// and client components can use it.
export function timeAgo(iso: string | Date) {
    const date = new Date(iso);
    const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "เมื่อสักครู่";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ชั่วโมงที่แล้ว`;
    if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)} วันที่แล้ว`;
    return date.toLocaleDateString("th-TH");
}
