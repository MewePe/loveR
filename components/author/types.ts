// Shared by the author dashboard (app/author/page.tsx) and its panels

// A novel or comic as returned by /api/author/novels and /api/author/comics
export interface Work {
    id: string;
    title: string;
    description: string | null;
    cover_image: string | null;
    status: string;
    categories: { id: string; name: string; slug: string }[]; // in the order the author picked them
    views: number;
}

export type WorkKind = 'novel' | 'comic';

export interface Category {
    id: string;
    name: string;
    slug: string;
}

// Wording, colours and routes that differ between novels and comics. Class names are written out in full
// so Tailwind can find them.
export const WORK_KINDS = {
    novel: {
        label: 'นิยาย',
        api: '/api/novels',
        manageUrl: (id: string) => `/author/novel/${id}/chapters`,
        manageLabel: 'จัดการบท',
        deleteConfirm: 'ต้องการลบนิยายนี้หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้',
        createError: 'เกิดข้อผิดพลาดในการสร้างนิยาย',
        button: 'bg-indigo-600 hover:bg-indigo-700',
        accent: 'indigo',
        ring: 'focus:ring-indigo-500',
        dropzone: 'hover:border-indigo-500',
        cover: 'from-indigo-500 to-purple-600',
    },
    comic: {
        label: 'การ์ตูน',
        api: '/api/comics',
        manageUrl: (id: string) => `/author/comic/${id}/episodes`,
        manageLabel: 'จัดการตอน',
        deleteConfirm: 'ต้องการลบการ์ตูนนี้หรือไม่?',
        createError: 'เกิดข้อผิดพลาด',
        button: 'bg-pink-600 hover:bg-pink-700',
        accent: 'pink',
        ring: 'focus:ring-pink-500',
        dropzone: 'hover:border-pink-500',
        cover: 'from-pink-500 to-rose-600',
    },
} as const;

export const STATUS_LABEL: Record<string, string> = {
    DRAFT: 'ฉบับร่าง',
    PUBLISHED: 'เผยแพร่แล้ว',
    ARCHIVED: 'เก็บเข้าคลัง',
    BANNED: 'ถูกระงับ',
};
