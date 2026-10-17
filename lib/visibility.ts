export type Viewer = { id?: string | null; role?: string | null } | null | undefined;

// Statuses an author may set on their own novel/comic. BANNED is admin-only (via /api/admin/content).
export const AUTHOR_SETTABLE_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

export function isOwnerOrAdmin(viewer: Viewer, authorId: string | null | undefined) {
    return !!viewer?.id && (viewer.role === 'ADMIN' || viewer.id === authorId);
}

// Only PUBLISHED novels/comics are public; drafts, archived and banned ones are visible to the owner and admins
// `content` is a novels/comics row (needs its status and author_id columns)
export function canViewContent(viewer: Viewer, content: Record<string, unknown>) {
    return content.status === 'PUBLISHED' || isOwnerOrAdmin(viewer, content.author_id as string | null | undefined);
}
