// Admin audit log action keys and their Thai labels. No server imports, so the admin page can use it too.
export const ADMIN_ACTIONS = {
    USER_ROLE: 'เปลี่ยนสิทธิ์ผู้ใช้',
    USER_BAN: 'แบนผู้ใช้',
    USER_UNBAN: 'ปลดแบนผู้ใช้',
    COINS_ADJUST: 'ปรับยอดเหรียญ',
    CONTENT_STATUS: 'เปลี่ยนสถานะเรื่อง',
    MODERATION_APPROVE: 'อนุมัติตอน (ตรวจเนื้อหา)',
    MODERATION_RELABEL: 'ปรับเป็น 18+ แล้วอนุมัติตอน',
    MODERATION_REJECT: 'ปฏิเสธตอน (ตรวจเนื้อหา)',
    REPORT_STATUS: 'จัดการรายงาน',
    COMMENT_DELETE: 'ลบคอมเมนต์',
    WRITER_APPROVE: 'อนุมัตินักเขียน',
    WRITER_REJECT: 'ปฏิเสธนักเขียน',
    TOPUP_APPROVE: 'อนุมัติเติมเหรียญ',
    TOPUP_REJECT: 'ปฏิเสธเติมเหรียญ',
    WITHDRAWAL_APPROVE: 'อนุมัติถอนเงิน',
    WITHDRAWAL_REJECT: 'ปฏิเสธถอนเงิน',
    CATEGORY_CREATE: 'เพิ่มหมวดหมู่',
    CATEGORY_DELETE: 'ลบหมวดหมู่',
    SETTINGS_UPDATE: 'แก้ไขการตั้งค่า',
} as const;
export type AdminAction = keyof typeof ADMIN_ACTIONS;

export function isAdminAction(value: unknown): value is AdminAction {
    return typeof value === 'string' && Object.hasOwn(ADMIN_ACTIONS, value);
}

// Thai labels for enum values shown in the admin pages and in log details
export const ROLE_LABEL: Record<string, string> = { ADMIN: 'แอดมิน', AUTHOR: 'นักเขียน', READER: 'ผู้อ่าน', BANNED: 'ถูกแบน', VISITOR: 'ผู้เยี่ยมชม' };
export const CONTENT_STATUS_LABEL: Record<string, string> = { PUBLISHED: 'เผยแพร่', DRAFT: 'ฉบับร่าง', ARCHIVED: 'ซ่อน', BANNED: 'ถูกแบน' };
export const REPORT_STATUS_LABEL: Record<string, string> = { PENDING: 'รอตรวจสอบ', RESOLVED: 'จัดการแล้ว', IGNORED: 'ไม่ดำเนินการ' };
