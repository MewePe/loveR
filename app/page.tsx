import Link from 'next/link';
import { BookMarked, ChevronRight, Clock, Crown, Eye, Flame, History, LayoutGrid, Sparkles, Trophy, Users, CheckCircle2 } from 'lucide-react';
import StoryCard, { compactNumber } from '@/components/StoryCard';
import StoryCover, { hueOf } from '@/components/StoryCover';
import HeroCarousel from '@/components/home/HeroCarousel';
import ScrollRow, { RowItem } from '@/components/home/ScrollRow';
import { categoryHref } from '@/components/CategoryTags';
import { auth } from '@/lib/auth';
import { getRecommendations, listStories } from '@/lib/ranking';
import { ContinueItem, LatestUpdate, TopAuthor, getCategoryList, getCompleted, getContinueReading, getFeatured, getLatestUpdates, getTopAuthors, getTopStories } from '@/lib/home';
import { profileHref } from '@/lib/username';
import { timeAgo } from '@/lib/timeAgo';

const MEDALS = ['text-amber-600 dark:text-amber-400', 'text-gray-500 dark:text-gray-300', 'text-orange-600 dark:text-orange-400'];

function SectionHeader({ id, icon: Icon, title, subtitle, href, linkText = 'ดูทั้งหมด', color }: {
  id: string; icon: typeof Flame; title: string; subtitle?: string; href?: string; linkText?: string; color: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div className="min-w-0">
        <h2 id={id} className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          <Icon className={`w-6 h-6 flex-shrink-0 ${color}`} aria-hidden="true" />{title}
        </h2>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="flex-shrink-0 inline-flex items-center gap-0.5 text-sm font-medium text-indigo-700 dark:text-indigo-400 hover:underline">
          {linkText}<ChevronRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

const itemHref = (type: 'novel' | 'comic', storyId: string, itemId: string | null) =>
  !itemId ? `/${type}/${storyId}` : type === 'novel' ? `/read/${itemId}` : `/comic/${storyId}/read/${itemId}`;

const wideCard = 'group flex gap-3 p-3 h-full rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition duration-300 motion-reduce:transition-none motion-reduce:hover:translate-y-0';

function ContinueCard({ item }: { item: ContinueItem }) {
  const progress = item.item_number && item.item_count ? Math.min(100, Math.round((item.item_number / item.item_count) * 100)) : 0;
  return (
    <Link href={itemHref(item.type, item.id, item.item_id)} className={wideCard}>
      <div className="relative w-16 aspect-[2/3] flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
        <StoryCover id={item.id} title={item.title} src={item.cover_image} type={item.type} mature={item.is_mature} compact />
      </div>
      <div className="min-w-0 flex-1 flex flex-col">
        <span className="font-bold text-sm text-gray-900 dark:text-white line-clamp-2 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">{item.title}</span>
        <span className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-1">
          {item.item_number != null ? `${item.item_label} ${item.item_number}${item.item_title ? `: ${item.item_title}` : ''}` : 'ไปที่หน้าเรื่อง'}
        </span>
        <div className="mt-auto pt-2">
          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="ความคืบหน้า">
            <div className="h-full bg-indigo-600 dark:bg-indigo-400 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 block">อ่านล่าสุด {timeAgo(item.read_at)}</span>
        </div>
      </div>
    </Link>
  );
}

function UpdateCard({ story }: { story: LatestUpdate }) {
  const latest = story.latest;
  return (
    <Link href={itemHref(story.type, story.id, latest?.id ?? null)} className={wideCard}>
      <div className="relative w-20 aspect-[2/3] flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
        <StoryCover id={story.id} title={story.title} src={story.cover_image} type={story.type} mature={story.is_mature} compact />
      </div>
      <div className="min-w-0 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`text-[11px] font-medium text-white px-2 py-0.5 rounded-full ${story.type === 'novel' ? 'bg-indigo-600' : 'bg-pink-700'}`}>{story.type === 'novel' ? 'นิยาย' : 'การ์ตูน'}</span>
          {story.is_mature && <span className="text-[11px] font-bold text-white px-2 py-0.5 rounded-full bg-red-700">18+</span>}
        </div>
        <span className="font-bold text-sm text-gray-900 dark:text-white line-clamp-2 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">{story.title}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{story.author_name ?? 'ไม่ระบุชื่อ'}</span>
        {latest && (
          <div className="mt-auto pt-2">
            <span className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 line-clamp-1">
              {latest.number != null ? `${latest.label} ${latest.number}` : 'ตอนใหม่'}: {latest.title}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400"><Clock className="w-3 h-3" aria-hidden="true" />{timeAgo(latest.created_at)}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function AuthorCard({ author, rank }: { author: TopAuthor; rank: number }) {
  const hue = hueOf(author.id);
  const name = author.name || 'นักเขียน';
  return (
    <Link href={profileHref(author)} className="group flex flex-col items-center text-center p-4 h-full rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg hover:-translate-y-1 transition duration-300 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="relative mb-3">
        <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-indigo-100 dark:ring-indigo-900/60 flex items-center justify-center text-white text-2xl font-bold"
          style={author.image ? undefined : { backgroundImage: `linear-gradient(135deg, hsl(${hue} 60% 38%), hsl(${(hue + 50) % 360} 65% 28%))` }}>
          {author.image ? <img src={author.image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" /> : name.trim().charAt(0).toUpperCase()}
        </div>
        {rank <= 3 && <Crown className={`absolute -top-2 -right-1 w-6 h-6 ${MEDALS[rank - 1]}`} aria-label={`อันดับ ${rank}`} />}
      </div>
      <span className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">{name}</span>
      {author.username && <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-full">@{author.username}</span>}
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
        <span>{author.works} เรื่อง</span>
        <span className="inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" aria-hidden="true" />{compactNumber(author.views)}</span>
        <span>{compactNumber(author.followers)} ผู้ติดตาม</span>
      </div>
    </Link>
  );
}

export default async function Home() {
  const session = await auth();
  const userId = session?.user?.id;
  const [featured, categories, continueReading, updates, novels, comics, top, recommended, completed, authors] = await Promise.all([
    getFeatured(5),
    getCategoryList(),
    userId ? getContinueReading(userId) : Promise.resolve([]),
    getLatestUpdates(12),
    listStories('novel', { sort: 'views', limit: 12 }),
    listStories('comic', { sort: 'views', limit: 12 }),
    getTopStories(10),
    userId ? getRecommendations(userId, 12) : Promise.resolve([]),
    getCompleted(12),
    getTopAuthors(12),
  ]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {featured.length > 0 ? (
        <HeroCarousel slides={featured.map((s) => ({
          type: s.type, id: s.id, title: s.title, description: s.description, cover_image: s.cover_image, author_name: s.author_name,
          views: s.views, rating_avg: s.rating_avg, item_count: s.item_count, is_completed: s.is_completed, first_item_id: s.first_item_id,
          categories: s.categories.map((c) => ({ id: c.id, name: c.name })),
        }))} />
      ) : (
        // A new site with nothing published yet
        <section className="bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900 text-white py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">ยินดีต้อนรับสู่ LoveRead</h1>
            <p className="text-lg mb-8 opacity-90">ค้นพบโลกของนิยายและการ์ตูนที่ไม่มีวันจบ</p>
            <Link href="/author" className="inline-block bg-white text-indigo-700 px-8 py-3 rounded-full font-bold hover:bg-indigo-50 transition">เริ่มเขียนเรื่องแรก</Link>
          </div>
        </section>
      )}
      <h1 className="sr-only">LoveRead อ่านนิยายและการ์ตูนออนไลน์</h1>

      {categories.length > 0 && (
        <nav aria-label="หมวดหมู่" className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-4">
            <ul className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-3 -mx-4 px-4">
              <li className="flex-shrink-0">
                <Link href="/search" className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition">
                  <LayoutGrid className="w-4 h-4" aria-hidden="true" />ทั้งหมด
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.id} className="flex-shrink-0">
                  <Link href={categoryHref(c.slug)} className="inline-block px-4 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-300 transition whitespace-nowrap">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}

      <div className="container mx-auto px-4 py-8 sm:py-10 space-y-10 sm:space-y-12">
        {continueReading.length > 0 && (
          <section aria-labelledby="sec-continue">
            <SectionHeader id="sec-continue" icon={History} title="อ่านต่อ" href="/history" linkText="ประวัติทั้งหมด" color="text-indigo-600 dark:text-indigo-400" />
            <ScrollRow label="อ่านต่อ">
              {continueReading.map((item) => <RowItem key={`${item.type}-${item.id}`} wide><ContinueCard item={item} /></RowItem>)}
            </ScrollRow>
          </section>
        )}

        {updates.length > 0 && (
          <section aria-labelledby="sec-updates">
            <SectionHeader id="sec-updates" icon={Clock} title="อัปเดตล่าสุด" subtitle="เรื่องที่เพิ่งลงตอนใหม่" href="/search" color="text-emerald-600 dark:text-emerald-400" />
            <ScrollRow label="อัปเดตล่าสุด">
              {updates.map((s) => <RowItem key={`${s.type}-${s.id}`} wide><UpdateCard story={s} /></RowItem>)}
            </ScrollRow>
          </section>
        )}

        {novels.length > 0 && (
          <section aria-labelledby="sec-novels">
            <SectionHeader id="sec-novels" icon={BookMarked} title="นิยายยอดนิยม" href="/ranking?type=novel" color="text-indigo-600 dark:text-indigo-400" />
            <ScrollRow label="นิยายยอดนิยม">
              {novels.map((s) => <RowItem key={s.id}><StoryCard story={s} type="novel" maxTags={2} /></RowItem>)}
            </ScrollRow>
          </section>
        )}

        {comics.length > 0 && (
          <section aria-labelledby="sec-comics">
            <SectionHeader id="sec-comics" icon={Flame} title="การ์ตูนยอดนิยม" href="/ranking?type=comic" color="text-pink-600 dark:text-pink-400" />
            <ScrollRow label="การ์ตูนยอดนิยม">
              {comics.map((s) => <RowItem key={s.id}><StoryCard story={s} type="comic" maxTags={2} /></RowItem>)}
            </ScrollRow>
          </section>
        )}

        {top.length > 0 && (
          <section aria-labelledby="sec-top" className="rounded-3xl bg-gradient-to-br from-indigo-50 via-white to-pink-50 dark:from-indigo-950/40 dark:via-gray-900 dark:to-pink-950/30 border border-indigo-100 dark:border-gray-800 px-4 sm:px-6 py-6">
            <SectionHeader id="sec-top" icon={Trophy} title="10 อันดับยอดนิยม" subtitle="นิยายและการ์ตูนที่มียอดวิวสูงสุด" href="/ranking" linkText="ดูอันดับทั้งหมด" color="text-amber-500 dark:text-amber-400" />
            <ScrollRow label="10 อันดับยอดนิยม">
              {top.map((s, i) => (
                <div key={`${s.type}-${s.id}`} role="listitem" className="snap-start flex-shrink-0 flex items-end">
                  <span aria-label={`อันดับ ${i + 1}`} className={`select-none font-black leading-none text-6xl sm:text-7xl mr-1 drop-shadow-sm ${MEDALS[i] ?? 'text-gray-500 dark:text-gray-400'}`}>{i + 1}</span>
                  <div className="w-32 sm:w-36 lg:w-40 self-stretch"><StoryCard story={s} type={s.type} maxTags={0} /></div>
                </div>
              ))}
            </ScrollRow>
          </section>
        )}

        {recommended.length > 0 && (
          <section aria-labelledby="sec-reco">
            <SectionHeader id="sec-reco" icon={Sparkles} title="แนะนำสำหรับคุณ" subtitle="จากหมวดที่คุณอ่านและบุ๊กมาร์กไว้" color="text-purple-600 dark:text-purple-400" />
            <ScrollRow label="แนะนำสำหรับคุณ">
              {recommended.map((s) => <RowItem key={`${s.type}-${s.id}`}><StoryCard story={s} type={s.type} maxTags={2} /></RowItem>)}
            </ScrollRow>
          </section>
        )}

        {completed.length > 0 && (
          <section aria-labelledby="sec-completed">
            <SectionHeader id="sec-completed" icon={CheckCircle2} title="เรื่องที่จบแล้ว" subtitle="อ่านรวดเดียวจนจบ" color="text-emerald-600 dark:text-emerald-400" />
            <ScrollRow label="เรื่องที่จบแล้ว">
              {completed.map((s) => <RowItem key={`${s.type}-${s.id}`}><StoryCard story={s} type={s.type} maxTags={2} /></RowItem>)}
            </ScrollRow>
          </section>
        )}

        {authors.length > 0 && (
          <section aria-labelledby="sec-authors">
            <SectionHeader id="sec-authors" icon={Users} title="นักเขียนยอดนิยม" color="text-pink-600 dark:text-pink-400" />
            <ScrollRow label="นักเขียนยอดนิยม">
              {authors.map((a, i) => <div key={a.id} role="listitem" className="snap-start flex-shrink-0 w-36 sm:w-40"><AuthorCard author={a} rank={i + 1} /></div>)}
            </ScrollRow>
          </section>
        )}
      </div>
    </main>
  );
}
