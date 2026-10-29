import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import {
    BookOpen, Bookmark, CalendarDays, Coins, Facebook, FileText, Globe, History, ImageIcon, Instagram, MessageCircle,
    Music2, Sparkles, Twitter, User, Youtube,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import {
    AuthorWork, getAuthorWorks, getFollowCounts, getPublicProfile, getTopFans, isFollowing, profileHref,
    SOCIAL_PLATFORMS, SocialKey,
} from '@/lib/authors';
import { isDefaultUsername } from '@/lib/username';
import CategoryTags from '@/components/CategoryTags';
import StoryCover from '@/components/StoryCover';
import ProfileActions from '@/components/profile/ProfileActions';
import BookmarksTab from '@/components/profile/BookmarksTab';
import HistoryTab from '@/components/profile/HistoryTab';
import WalletTab from '@/components/profile/WalletTab';

const DEFAULT_COVER = '/images/default-cover.svg';

const SOCIAL_ICONS: Record<SocialKey, typeof Globe> = {
    facebook: Facebook, x: Twitter, instagram: Instagram, tiktok: Music2, youtube: Youtube, website: Globe,
};

// Works tabs (authors, everyone sees them) and owner tabs (only on your own profile)
const WORK_TABS = {
    novels: { type: 'novel', label: 'นิยาย', icon: BookOpen, href: '/novel/', items: 'ตอน', active: 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300' },
    comics: { type: 'comic', label: 'การ์ตูน', icon: ImageIcon, href: '/comic/', items: 'ตอน', active: 'border-pink-600 text-pink-700 dark:border-pink-400 dark:text-pink-300' },
} as const;
// `short` is shown on phones so the three owner tabs fit across a 390px screen
const OWNER_TABS = {
    bookmarks: { label: 'บุ๊กมาร์ก', short: 'บุ๊กมาร์ก', icon: Bookmark },
    history: { label: 'ประวัติการอ่าน', short: 'ประวัติ', icon: History },
    wallet: { label: 'กระเป๋าเหรียญ', short: 'เหรียญ', icon: Coins },
} as const;
type WorkTab = keyof typeof WORK_TABS;
type OwnerTab = keyof typeof OWNER_TABS;
type TabKey = WorkTab | OwnerTab;
const OWNER_ACTIVE = 'border-gray-900 text-gray-900 dark:border-white dark:text-white';

// Gold, silver and bronze for the top three fans (same colours as /ranking)
const MEDALS = ['bg-amber-400 text-amber-950', 'bg-gray-300 text-gray-900', 'bg-orange-300 text-orange-950'];
const MEDAL_LABELS = ['เหรียญทอง', 'เหรียญเงิน', 'เหรียญทองแดง'];

type Props = { params: Promise<{ username: string }>; searchParams: Promise<{ tab?: string }> };

function decode(param: string) {
    try { return decodeURIComponent(param); } catch { return param; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const profile = await getPublicProfile(decode((await params).username));
    if (!profile) return { title: 'ไม่พบผู้ใช้ | LoveRead' };
    const name = profile.name || (profile.is_author ? 'นักเขียน' : 'ผู้อ่าน');
    return {
        title: `${name}${profile.username ? ` (@${profile.username})` : ''} | LoveRead`,
        description: profile.bio?.slice(0, 160) || (profile.is_author ? `ผลงานของ ${name} บน LoveRead` : `โปรไฟล์ของ ${name} บน LoveRead`),
    };
}

// Profile page for every (non-banned) user: banner, avatar, name/@username, bio and links. Authors also get their
// works and top fans plus follow/support. On your own profile you also get the private tabs (bookmarks, reading
// history, coin wallet), "edit profile" and "writer center"; nobody else sees those tabs (?tab= falls back).
export default async function ProfilePage({ params, searchParams }: Props) {
    const param = decode((await params).username);
    const { tab: rawTab } = await searchParams;
    const profile = await getPublicProfile(param);
    if (!profile) notFound();
    // Old links by id (or a differently-cased username) go to the canonical URL
    if (profile.username && param !== profile.username) {
        redirect(profileHref(profile) + (rawTab ? `?tab=${encodeURIComponent(rawTab)}` : ''));
    }

    const session = await auth();
    const viewerId = session?.user?.id ?? null;
    const isOwner = viewerId === profile.id;
    const isAuthor = profile.is_author;
    const [counts, fans, novels, comics, following] = await Promise.all([
        getFollowCounts(profile.id),
        isAuthor ? getTopFans(profile.id) : Promise.resolve([]),
        isAuthor ? getAuthorWorks(profile.id, 'novel') : Promise.resolve([]),
        isAuthor ? getAuthorWorks(profile.id, 'comic') : Promise.resolve([]),
        isAuthor ? isFollowing(viewerId, profile.id) : Promise.resolve(false),
    ]);
    const works: Record<WorkTab, AuthorWork[]> = { novels, comics };

    const tabs: TabKey[] = [...(isAuthor ? (['novels', 'comics'] as const) : []), ...(isOwner ? (['bookmarks', 'history', 'wallet'] as const) : [])];
    const defaultTab: TabKey | null = isAuthor ? (novels.length === 0 && comics.length > 0 ? 'comics' : 'novels') : tabs[0] ?? null;
    const tab: TabKey | null = tabs.includes(rawTab as TabKey) ? rawTab as TabKey : defaultTab;

    const name = profile.name || (isAuthor ? 'นักเขียน' : 'ผู้อ่าน');
    const socials = SOCIAL_PLATFORMS.filter((p) => profile.social_links[p.key]);
    const needsUsername = isOwner && isDefaultUsername(profile.id, profile.username);

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
            <div className="container mx-auto max-w-5xl sm:px-4 sm:pt-6">
                {/* Header */}
                <section className="bg-white dark:bg-gray-800 sm:rounded-2xl shadow-sm border-b sm:border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="aspect-[5/2] sm:aspect-[3/1] bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600">
                        <img src={profile.cover_image || DEFAULT_COVER} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="px-4 sm:px-6 pb-6">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div className="-mt-12 sm:-mt-16 w-24 h-24 sm:w-32 sm:h-32 rounded-full ring-4 ring-white dark:ring-gray-800 bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center shrink-0">
                                {profile.image
                                    ? <img src={profile.image} alt={name} className="w-full h-full object-cover" />
                                    : <User className="w-12 h-12 text-gray-500 dark:text-gray-400" />}
                            </div>
                            <div className="pt-3">
                                <ProfileActions
                                    authorId={profile.id}
                                    authorName={name}
                                    isOwner={isOwner}
                                    isAuthor={isAuthor}
                                    showWriterCenter={profile.role === 'AUTHOR' || profile.role === 'ADMIN'}
                                    loggedIn={!!viewerId}
                                    initiallyFollowing={following}
                                />
                            </div>
                        </div>

                        <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white break-words">{name}</h1>
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-500 dark:text-gray-400">
                            {profile.username && <span>@{profile.username}</span>}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isAuthor
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
                                {isAuthor ? 'นักเขียน' : 'ผู้อ่าน'}
                            </span>
                            <span className="inline-flex items-center gap-1 text-sm">
                                <CalendarDays className="w-4 h-4" /> เข้าร่วมเมื่อ {new Date(profile.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })}
                            </span>
                        </p>

                        {needsUsername && (
                            <div role="status" className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 p-3 sm:p-4">
                                <Sparkles className="hidden sm:block w-6 h-6 shrink-0 text-amber-700 dark:text-amber-400" />
                                <p className="flex-1 text-sm text-amber-950 dark:text-amber-100">
                                    <strong>ตั้งชื่อผู้ใช้ของคุณเอง</strong> ตอนนี้ยังเป็นชื่ออัตโนมัติ @{profile.username} ตั้งชื่อที่จำง่ายเพื่อให้เพื่อนค้นหาและแชร์โปรไฟล์ได้
                                </p>
                                <Link href="/profile/edit#username" className="self-start sm:self-auto shrink-0 px-4 py-2 rounded-full bg-amber-400 text-amber-950 text-sm font-semibold hover:bg-amber-500">
                                    ตั้งชื่อผู้ใช้
                                </Link>
                            </div>
                        )}

                        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
                            {isAuthor && <span><strong className="text-gray-900 dark:text-white">{counts.followers.toLocaleString()}</strong> ผู้ติดตาม</span>}
                            <span><strong className="text-gray-900 dark:text-white">{counts.following.toLocaleString()}</strong> กำลังติดตาม</span>
                            {isAuthor && <span><strong className="text-gray-900 dark:text-white">{(novels.length + comics.length).toLocaleString()}</strong> ผลงาน</span>}
                        </p>

                        {socials.length > 0 && (
                            <ul className="mt-3 flex flex-wrap gap-2" aria-label="ลิงก์โซเชียล">
                                {socials.map(({ key, label }) => {
                                    const Icon = SOCIAL_ICONS[key];
                                    return (
                                        <li key={key}>
                                            <a
                                                href={profile.social_links[key]}
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

                        {profile.bio && (
                            <p className="mt-4 text-gray-700 dark:text-gray-300 whitespace-pre-line break-words leading-relaxed">{profile.bio}</p>
                        )}
                    </div>
                </section>

                <div className={`mt-6 px-4 sm:px-0 grid gap-6 items-start ${isAuthor ? 'lg:grid-cols-[minmax(0,1fr)_300px]' : ''}`}>
                    {tab ? (
                        <section aria-labelledby="tabs-title" className="min-w-0 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <h2 id="tabs-title" className="sr-only">{isAuthor ? 'ผลงาน' : 'ของฉัน'}</h2>
                            {/* Scrolls sideways on phones when there are 5 tabs */}
                            <nav className="flex overflow-x-auto [scrollbar-width:none] border-b border-gray-200 dark:border-gray-700" aria-label="แท็บโปรไฟล์">
                                {tabs.map((key) => {
                                    const t = key in WORK_TABS ? WORK_TABS[key as WorkTab] : OWNER_TABS[key as OwnerTab];
                                    const Icon = t.icon;
                                    const active = key === tab;
                                    const activeClass = key in WORK_TABS ? WORK_TABS[key as WorkTab].active : OWNER_ACTIVE;
                                    return (
                                        <Link
                                            key={key}
                                            href={`?tab=${key}`}
                                            scroll={false}
                                            aria-current={active ? 'page' : undefined}
                                            className={`flex-1 shrink-0 min-w-fit flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition ${active ? activeClass : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
                                        >
                                            <Icon className="w-4 h-4" />
                                            {'short' in t && t.short !== t.label
                                                ? <><span className="sm:hidden">{t.short}</span><span className="hidden sm:inline">{t.label}</span></>
                                                : t.label}
                                            {key in WORK_TABS && (
                                                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-200">{works[key as WorkTab].length}</span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </nav>

                            {tab === 'bookmarks' && <BookmarksTab />}
                            {tab === 'history' && <HistoryTab />}
                            {tab === 'wallet' && <WalletTab />}
                            {(tab === 'novels' || tab === 'comics') && <WorksList works={works[tab]} tab={tab} />}
                        </section>
                    ) : (
                        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-10 text-center">
                            <BookOpen className="w-10 h-10 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">{name} เป็นนักอ่าน ยังไม่มีผลงานที่เผยแพร่</p>
                        </section>
                    )}

                    {isAuthor && <TopFans fans={fans} name={name} />}
                </div>
            </div>
        </main>
    );
}

// Published novels or comics; stories without a cover get the generated cover used on the home page
function WorksList({ works, tab }: { works: AuthorWork[]; tab: WorkTab }) {
    const t = WORK_TABS[tab];
    if (works.length === 0) return <p className="p-10 text-center text-gray-500 dark:text-gray-400">ยังไม่มี{t.label}ที่เผยแพร่</p>;
    return (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {works.map((work) => (
                <li key={work.id} className="flex gap-4 p-4">
                    <Link href={t.href + work.id} tabIndex={-1} aria-hidden="true" className="group relative shrink-0 w-20 sm:w-24 aspect-[2/3] rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                        <StoryCover id={work.id} title={work.title} src={work.cover_image} type={t.type} mature={work.is_mature} compact />
                        {work.is_completed && (
                            <span className="absolute top-1 left-1 bg-emerald-700 text-white text-[11px] font-medium px-1.5 py-0.5 rounded">จบแล้ว</span>
                        )}
                    </Link>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-gray-900 dark:text-white break-words">
                            <Link href={t.href + work.id} className="hover:underline">{work.title}</Link>
                            {work.is_mature && <span className="ml-2 align-middle px-1.5 py-0.5 rounded bg-red-700 text-white text-[11px] font-bold">18+</span>}
                            {work.is_completed && <span className="sr-only"> (จบแล้ว)</span>}
                        </h3>
                        <CategoryTags categories={work.categories} type={t.type} className="mt-1.5" />
                        {work.description && (
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2 break-words">{work.description}</p>
                        )}
                        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {work.items.toLocaleString()} {t.items}</span>
                            <span>👁️ {work.views.toLocaleString()} วิว</span>
                            <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {work.comments.toLocaleString()} คอมเมนต์</span>
                        </p>
                    </div>
                </li>
            ))}
        </ul>
    );
}

function TopFans({ fans, name }: { fans: { id: string; name: string | null; image: string | null }[]; name: string }) {
    return (
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
    );
}
