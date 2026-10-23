import Link from 'next/link';
import StoryCard from '@/components/StoryCard';
import { auth } from '@/lib/auth';
import { getRecommendations, listStories } from '@/lib/ranking';

export default async function Home() {
  const session = await auth();
  const [novels, comics, recommended] = await Promise.all([
    listStories('novel', { sort: 'views', limit: 6 }),
    listStories('comic', { sort: 'views', limit: 6 }),
    session?.user?.id ? getRecommendations(session.user.id) : Promise.resolve([]),
  ]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <section className="relative bg-cover bg-center text-white py-24" style={{ backgroundImage: 'url(/hero-bg.jpg)' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/80 via-purple-900/70 to-pink-900/80"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-lg">ยินดีต้อนรับสู่ LoveRead</h1>
          <p className="text-xl mb-8 opacity-90 drop-shadow">ค้นพบโลกของนิยายและการ์ตูนที่ไม่มีวันจบ</p>
          <div className="space-x-4">
            <Link href="/search" className="bg-white text-indigo-600 px-8 py-3 rounded-full font-bold hover:bg-gray-100 transition shadow-lg">
              เริ่มอ่าน
            </Link>
            <Link href="/author" className="border-2 border-white text-white px-8 py-3 rounded-full font-bold hover:bg-white/10 transition backdrop-blur-sm">
              เริ่มเขียน
            </Link>
          </div>
        </div>
      </section>

      {/* Recommended for the logged-in user (hidden until they have read or bookmarked something) */}
      {recommended.length > 0 && (
        <section className="pt-16 container mx-auto px-4">
          <div className="flex justify-between items-end mb-8">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">✨ แนะนำสำหรับคุณ</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {recommended.map((story) => <StoryCard key={`${story.type}-${story.id}`} story={story} type={story.type} />)}
          </div>
        </section>
      )}

      {/* Popular Novels */}
      <section className="py-16 container mx-auto px-4">
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white">📚 นิยายยอดนิยม</h2>
          <Link href="/ranking?type=novel" className="text-indigo-600 font-medium hover:underline">ดูอันดับทั้งหมด</Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {novels.length > 0 ? novels.map((novel) => <StoryCard key={novel.id} story={novel} type="novel" />) : (
            <div className="col-span-6 text-center py-12 text-gray-500 dark:text-gray-400">ยังไม่มีนิยาย</div>
          )}
        </div>
      </section>

      {/* Popular Comics */}
      <section className="py-16 container mx-auto px-4 bg-gray-100 dark:bg-gray-800/50 rounded-3xl">
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white">🎨 การ์ตูนยอดนิยม</h2>
          <Link href="/ranking?type=comic" className="text-pink-600 font-medium hover:underline">ดูอันดับทั้งหมด</Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {comics.length > 0 ? comics.map((comic) => <StoryCard key={comic.id} story={comic} type="comic" />) : (
            <div className="col-span-6 text-center py-12 text-gray-500 dark:text-gray-400">ยังไม่มีการ์ตูน</div>
          )}
        </div>
      </section>
    </main>
  );
}

