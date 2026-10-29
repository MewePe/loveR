import { ShieldAlert } from 'lucide-react';
import { ITEM_STATUS_LABEL, ItemModerationStatus, isOneOf, ITEM_STATUSES } from '@/lib/moderationLabels';

// Small label next to a chapter/episode in its author's lists; nothing once it is published
export function ModerationBadge({ status }: { status: string }) {
    if (!isOneOf(ITEM_STATUSES, status) || status === 'APPROVED') return null;
    const tone = status === 'PENDING'
        ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300'
        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${tone}`}>{ITEM_STATUS_LABEL[status]}</span>;
}

// Shown on the reader pages when a chapter/episode hasn't passed the content check. Only its author and admins can
// open such an item (everyone else gets a 404), so this tells them why readers can't see it yet.
export default function ModerationNotice({ status, className = '' }: { status: string; className?: string }) {
    if (!isOneOf(ITEM_STATUSES, status) || status === 'APPROVED') return null;
    const s = status as Exclude<ItemModerationStatus, 'APPROVED'>;
    return (
        <div role="status" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${s === 'PENDING'
            ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200'
            : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200'} ${className}`}>
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p><span className="font-semibold">{ITEM_STATUS_LABEL[s]}</span> — ผู้อ่านยังมองไม่เห็นตอนนี้ เห็นได้เฉพาะคุณและแอดมิน</p>
        </div>
    );
}
