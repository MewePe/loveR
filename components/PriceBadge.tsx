import { Lock, LockOpen } from 'lucide-react';

// Price label for a chapter/episode row: free, bought/owned, or locked with its coin price
export default function PriceBadge({ price, unlocked }: { price: number; unlocked: boolean }) {
    if (!price || price <= 0) {
        return <span className="text-green-600 dark:text-green-400 font-medium">ฟรี</span>;
    }
    if (unlocked) {
        return <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400"><LockOpen className="w-4 h-4" /> ซื้อแล้ว</span>;
    }
    return <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium"><Lock className="w-4 h-4" /> {price} เหรียญ</span>;
}
