import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { BookOpen, Facebook, FileText, Globe, ImageIcon, Instagram, MessageCircle, Music2, Twitter, User, Youtube } from 'lucide-react';
import { auth } from '@/lib/auth';
import {
    AuthorWork, getAuthorWorks, getFollowCounts, getPublicAuthor, getTopFans, isFollowing, profileHref,
    SOCIAL_PLATFORMS, SocialKey,
} from '@/lib/authors';
import CategoryTags from '@/components/CategoryTags';
import ProfileActions from '@/components/profile/ProfileActions';

const DEFAULT_COVER = '/images/default-cover.svg';

const SOCIAL_ICONS: Record<SocialKey, typeof Globe> = {
    facebook: Facebook, x: Twitter, instagram: Instagram, tiktok: Music2, youtube: Youtube, website: Globe,
};

const TABS = {
    novels: { type: 'novel', label: 'นิยาย', icon: BookOpen, href: '/novel/', cover: 'from-indigo-500 to-purple-600', items: 'ตอน', active: 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300' },
    comics: { type: 'comic', label: 'การ์ตูน', icon: ImageIcon, href: '/comic/', cover: 'from-pink-500 to-rose-600', items: 'ตอน', active: 'border-pink-600 text-pink-700 dark:border-pink-400 dark:text-pink-300' },
} as const;
type TabKey = keyof typeof TABS;

// Gold, silver and bronze for the top three fans (same colours as /ranking)
const MEDALS = ['bg-amber-400 text-amber-950', 'bg-gray-300 text-gray-900', 'bg-orange-300 text-orange-950'];
const MEDAL_LABELS = ['เหรียญทอง', 'เหรียญเงิน', 'เหรียญทองแดง'];

type Props = { params: Promise<{ username: string }>; searchParams: Promise<{ tab?: string }> };

function decode(param: string) {
    try { return decodeURIComponent(param); } catch { return param; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const author = await getPublicAuthor(decode((await params).username));
    if (!author) return { title: 'ไม่พบนักเขียน | LoveRead' };
    return {
        title: `${author.name || 'นักเขียน'}${author.username ? ` (@${author.username})` : ''} | LoveRead`,
        description: author.bio?.slice(0, 160) || `ผลงานของ ${author.name || 'นักเขียน'} บน LoveRead`,
    };
}

// Public author profile: banner, avatar, follow/support/share, bio, works by type and top fans
export default async function AuthorProfilePage({ params, searchParams }: Props) {
    const param = decode((await params).username);
    const { tab: rawTab } = await searchParams;
    const author = await getPublicAuthor(param);
    if (!author) notFound();
    // Old links by id (or a differently-cased username) go to the canonical URL
    if (author.username && param !== author.username) {
        redirect(profileHref(author) + (rawTab ? `?tab=${encodeURIComponent(rawTab)}` : ''));
    }

    const session = await auth();
    const viewerId = session?.user?.id ?? null;
    const [counts, fans, novels, comics, following] = await Promise.all([
        getFollowCounts(author.id),
        getTopFans(author.id),
        getAuthorWorks(author.id, 'novel'),
        getAuthorWorks(author.id, 'comic'),
        isFollowing(viewerId, author.id),
    ]);
    const works: Record<TabKey, AuthorWork[]> = { novels, comics };
    const tab: TabKey = rawTab === 'comics' || rawTab === 'novels' ? rawTab : (novels.length === 0 && comics.length > 0 ? 'comics' : 'novels');
    const current = TABS[tab];
    const name = author.name || 'นักเขียน';
    const socials = SOCIAL_PLATFORMS.filter((p) => author.social_links[p.key]);

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
            <div className="container mx-auto max-w-5xl sm:px-4 sm:pt-6">
                {/* Header */}
                <section className="bg-white dark:bg-gray-800 sm:rounded-2xl shadow-sm border-b sm:border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="aspect-[2/1] sm:aspect-[3/1] bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600">
                        <img src={author.cover_image || DEFAULT_COVER} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="px-4 sm:px-6 pb-6">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div className="-mt-12 sm:-mt-16 w-24 h-24 sm:w-32 sm:h-32 rounded-full ring-4 ring-white dark:ring-gray-800 bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center shrink-0">
                                {author.image
                                    ? <img src={author.image} alt={name} className="w-full h-full object-cover" />
                                    : <User className="w-12 h-12 text-gray-500 dark:text-gray-400" />}
                            </div>
                            <div className="pt-3">
                                <ProfileActions
                                    authorId={author.id}
                                    authorName={name}
                                    isOwner={viewerId === author.id}
                                    loggedIn={!!viewerId}
                                    initiallyFollowing={following}
                                />
                            </div>
                        </div>

                        <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white break-words">{name}</h1>
                        {author.username && <p className="text-gray-500 dark:text-gray-400">@{author.username}</p>}

                        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
                            <span><strong className="text-gray-900 dark:text-white">{counts.followers.toLocaleString()}</strong> ผู้ติดตาม</span>
                            <span><strong className="text-gray-900 dark:text-white">{counts.following.toLocaleString()}</strong> กำลังติดตาม</span>
                            <span><strong className="text-gray-900 dark:text-white">{(novels.length + comics.length).toLocaleString()}</strong> ผลงาน</span>
                        </p>

                        {socials.length > 0 && (
                            <ul className="mt-3 flex flex-wrap gap-2" aria-label="ลิงก์โซเชียล">
                                {socials.map(({ key, label }) => {
                                    const Icon = SOCIAL_ICONS[key];
                                    return (
                                        <li key={key}>
                                            <a
                                                href={author.social_links[key]}
                                                target="_blank"
                                                rel="noopener noreferrer nofollow ugc"
                                                title={label}
                                                aria-label={label}
                                                className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-300 transition"
                                            >
                                                <Icon className="w-4 h-4" />
                                            </a>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        {author.bio && (
                            <p className="mt-4 text-gray-700 dark:text-gray-300 whitespace-pre-line break-words leading-relaxed">{author.bio}</p>
                        )}
                    </div>
                </section>

                <div className="mt-6 px-4 sm:px-0 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
                    {/* Works */}
                    <section aria-labelledby="works-title" className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <h2 id="works-title" className="sr-only">ผลงาน</h2>
                        <nav className="flex border-b border-gray-200 dark:border-gray-700" aria-label="ประเภทผลงาน">
                            {(Object.keys(TABS) as TabKey[]).map((key) => {
                                const t = TABS[key];
                                const Icon = t.icon;
                                return (
                                    <Link
                                        key={key}
                                        href={`?tab=${key}`}
                                        scroll={false}
                                        aria-current={key === tab ? 'page' : undefined}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 -mb-px transition ${key === tab ? t.active : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
                                    >
                                        <Icon className="w-4 h-4" /> {t.label}
                                        <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-200">{works[key].length}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        {works[tab].length === 0 ? (
                            <p className="p-10 text-center text-gray-500 dark:text-gray-400">ยังไม่มี{current.label}ที่เผยแพร่</p>
                        ) : (
                            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                                {works[tab].map((work) => (
                                    <li key={work.id} className="flex gap-4 p-4">
                                        <Link href={current.href + work.id} tabIndex={-1} aria-hidden="true" className={`relative shrink-0 w-20 sm:w-24 aspect-[2/3] rounded-lg overflow-hidden bg-gradient-to-br ${current.cover}`}>
                                            {work.cover_image
                                                ? <img src={work.cover_image} alt="" className="w-full h-full object-cover" />
                                                : <current.icon className="w-8 h-8 text-white/60 m-auto h-full" />}
                                            {work.is_completed && (
                                                <span className="absolute top-1 left-1 bg-emerald-700 text-white text-[11px] font-medium px-1.5 py-0.5 rounded">จบแล้ว</span>
                                            )}
                                        </Link>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-bold text-gray-900 dark:text-white break-words">
                                                <Link href={current.href + work.id} className="hover:underline">{work.title}</Link>
                                                {work.is_completed && <span className="sr-only"> (จบแล้ว)</span>}
                                            </h3>
                                            <CategoryTags categories={work.categories} type={current.type} className="mt-1.5" />
                                            {work.description && (
                                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2 break-words">{work.description}</p>
                                            )}
                                            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {work.items.toLocaleString()} {current.items}</span>
                                                <span>👁️ {work.views.toLocaleString()} วิว</span>
                                                <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {work.comments.toLocaleString()} คอมเมนต์</span>
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* Top fans */}
                    <aside aria-labelledby="fans-title" className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                        <h2 id="fans-title" className="font-bold text-gray-900 dark:text-white">แฟนตัวยง</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">ผู้ที่สนับสนุน {name} มากที่สุด (ซื้อตอนและส่งเหรียญ)</p>
                        {fans.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">ยังไม่มีแฟนตัวยง มาเป็นคนแรกที่สนับสนุนกัน!</p>
                        ) : (
                            <ol className="space-y-3">
                                {fans.map((fan, i) => (
                                    <li key={fan.id} className="flex items-center gap-3">
                                        <span
                                            className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${MEDALS[i] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                                            title={MEDAL_LABELS[i]}
                                        >
                                            {i + 1}
                                            {MEDAL_LABELS[i] && <span className="sr-only"> ({MEDAL_LABELS[i]})</span>}
                                        </span>
                                        <span className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center shrink-0">
                                            {fan.image ? <img src={fan.image} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
                                        </span>
                                        <span className="text-sm text-gray-800 dark:text-gray-100 truncate">{fan.name || 'ผู้อ่าน'}</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </aside>
                </div>
            </div>
        </main>
    );
}
