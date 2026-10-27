import Link from 'next/link';
import type { ContentType } from '@/lib/contentRef';

export type CategoryTagData = { id: string; name: string; slug: string };

export function categoryHref(slug: string) {
    return `/category/${encodeURIComponent(slug)}`;
}

const COLORS = {
    novel: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50',
    comic: 'bg-pink-50 text-pink-700 hover:bg-pink-100 dark:bg-pink-900/30 dark:text-pink-300 dark:hover:bg-pink-900/50',
};
const SIZES = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm font-medium',
};

// A story's category tags; each links to /category/[slug]. Renders nothing when the story has no categories.
export default function CategoryTags({ categories, type, size = 'sm', className = '' }: {
    categories: CategoryTagData[] | undefined; type: ContentType; size?: keyof typeof SIZES; className?: string;
}) {
    if (!categories?.length) return null;
    return (
        <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="หมวดหมู่">
            {categories.map((c) => (
                <li key={c.id}>
                    <Link href={categoryHref(c.slug)} className={`inline-block rounded-full transition ${SIZES[size]} ${COLORS[type]}`}>
                        {c.name}
                    </Link>
                </li>
            ))}
        </ul>
    );
}
