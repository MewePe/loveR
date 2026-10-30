// Autosaved chapter drafts stay in this browser only. They can't go through the chapter API: saving there changes what
// readers see and starts a content check on every pause. Storage may be full or blocked, so nothing here throws.

export interface ChapterDraft {
    title: string;
    content: string;
    price: number;
    savedAt: number;
}

const keyOf = (userId: string, novelId: string, chapterId: string | null) =>
    `loveread:chapter-draft:${userId}:${novelId}:${chapterId ?? 'new'}`;

export function loadDraft(userId: string, novelId: string, chapterId: string | null): ChapterDraft | null {
    try {
        const raw = localStorage.getItem(keyOf(userId, novelId, chapterId));
        const draft = raw ? JSON.parse(raw) : null;
        return typeof draft?.content === 'string' && typeof draft?.title === 'string' ? draft : null;
    } catch {
        return null;
    }
}

export function saveDraft(userId: string, novelId: string, chapterId: string | null, draft: ChapterDraft) {
    try {
        localStorage.setItem(keyOf(userId, novelId, chapterId), JSON.stringify(draft));
        return true;
    } catch {
        return false;
    }
}

export function clearDraft(userId: string, novelId: string, chapterId: string | null) {
    try {
        localStorage.removeItem(keyOf(userId, novelId, chapterId));
    } catch {
        // Nothing to clean up if storage is blocked
    }
}
