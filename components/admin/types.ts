// Shared by app/admin/page.tsx and the panels in components/admin/

export type TabType = 'dashboard' | 'users' | 'content' | 'reports' | 'moderation' | 'writers' | 'payments' | 'logs' | 'categories' | 'settings';

// Pending work from /api/admin/counts (red badges in the sidebar)
export interface PendingCounts { writers: number; topups: number; withdrawals: number; reports: number; moderation: number; }

// Open a tab, optionally with extra query params (e.g. { user: id } or { view: 'withdrawals' })
export type Navigate = (tab: TabType, params?: Record<string, string>) => void;

export interface PanelProps {
    navigate: Navigate;
    params: { get(name: string): string | null }; // the page's search params
    counts: PendingCounts | null;
    refreshCounts: () => void;
}
