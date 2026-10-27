import Link from 'next/link';
import { profileHref } from '@/lib/username';

// An author's name linking to their public profile (/profile/[username]). Plain text when the author is unknown.
export default function AuthorLink({ id, username, name, className = '', fallback = 'ไม่ระบุชื่อ' }: {
    id?: string | null; username?: string | null; name?: string | null; className?: string; fallback?: string;
}) {
    if (!id && !username) return <span className={className}>{name || fallback}</span>;
    return (
        <Link href={profileHref({ id, username })} className={`hover:underline ${className}`}>
            {name || fallback}
        </Link>
    );
}
