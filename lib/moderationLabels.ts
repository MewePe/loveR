// Moderation enum values and their Thai labels. No server imports, so client components can use it too.

// chapters.moderation_status / comic_episodes.moderation_status. Only APPROVED items are shown to readers.
export const ITEM_STATUSES = ['APPROVED', 'PENDING', 'BLOCKED', 'REJECTED'] as const;
export type ItemModerationStatus = typeof ITEM_STATUSES[number];
export const ITEM_STATUS_LABEL: Record<ItemModerationStatus, string> = {
    APPROVED: 'เผยแพร่แล้ว',
    PENDING: 'รอแอดมินตรวจ',
    BLOCKED: 'ถูกระงับ รอแอดมินตรวจ',
    REJECTED: 'ไม่ผ่านการตรวจ',
};

// What the API decided the content is (moderation_checks.verdict)
export const VERDICTS = ['SAFE', 'MATURE', 'EXPLICIT', 'ILLEGAL', 'MINOR', 'REFUSED', 'ERROR'] as const;
export type Verdict = typeof VERDICTS[number];
export const VERDICT_LABEL: Record<Verdict, string> = {
    SAFE: 'เนื้อหาทั่วไป',
    MATURE: 'เนื้อหา 18+',
    EXPLICIT: 'โป๊โจ่งแจ้ง',
    ILLEGAL: 'ผิดกฎหมาย',
    MINOR: 'ทางเพศเกี่ยวกับตัวละครที่ดูเป็นเด็ก',
    REFUSED: 'API ไม่ยอมตรวจเนื้อหานี้',
    ERROR: 'ตรวจไม่ได้ (API ขัดข้อง)',
};
// Verdicts that block the item whatever the story's label is. REFUSED (Gemini's own filter wouldn't answer) isn't one:
// it also happens on harmless text, so it waits for an admin like an outage.
export const SEVERE_VERDICTS: readonly Verdict[] = ['EXPLICIT', 'ILLEGAL', 'MINOR'];

// moderation_checks.status. The admin queue is PENDING.
export const CHECK_STATUSES = ['CHECKING', 'CLEARED', 'PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED'] as const;
export type CheckStatus = typeof CHECK_STATUSES[number];
export const CHECK_STATUS_LABEL: Record<CheckStatus, string> = {
    CHECKING: 'กำลังตรวจ',
    CLEARED: 'ผ่านอัตโนมัติ',
    PENDING: 'รอแอดมินตรวจ',
    APPROVED: 'แอดมินอนุมัติ',
    REJECTED: 'แอดมินปฏิเสธ',
    SUPERSEDED: 'มีการแก้ไขใหม่กว่า',
};

export const CHECK_SOURCES = ['SUBMIT', 'EDIT', 'READER_REPORT'] as const;
export type CheckSource = typeof CHECK_SOURCES[number];
export const SOURCE_LABEL: Record<CheckSource, string> = {
    SUBMIT: 'ลงตอนใหม่',
    EDIT: 'แก้ไขตอน',
    READER_REPORT: 'ผู้อ่านรายงานว่าติดป้ายผิด',
};

// Issue categories the API may give for each problem it finds
export const ISSUE_CATEGORIES = ['sexual', 'violence', 'language', 'drugs', 'self_harm', 'hate', 'illegal', 'minor', 'other'] as const;
export type IssueCategory = typeof ISSUE_CATEGORIES[number];
export const ISSUE_CATEGORY_LABEL: Record<IssueCategory, string> = {
    sexual: 'เนื้อหาทางเพศ',
    violence: 'ความรุนแรง',
    language: 'คำหยาบ',
    drugs: 'ยาเสพติด',
    self_harm: 'ทำร้ายตัวเอง',
    hate: 'เกลียดชัง/เหยียด',
    illegal: 'ผิดกฎหมาย',
    minor: 'เกี่ยวกับผู้เยาว์',
    other: 'อื่นๆ',
};

export interface ModerationIssue { page: number | null; category: IssueCategory; reason: string }
export interface ModerationAnalysis { summary: string; issues: ModerationIssue[] }

export const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
    typeof value === 'string' && (list as readonly string[]).includes(value);
