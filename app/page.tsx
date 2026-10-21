import Link from 'next/link';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

async function getNovels() {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT n.*, u.name as author_name, c.name as category_name 
    FROM novels n
    LEFT JOIN users u ON n.author_id = u.id
    LEFT JOIN categories c ON n.category_id = c.id
    WHERE n.status = 'PUBLISHED'
    ORDER BY n.views DESC
    LIMIT 6
  `);
  return rows;
}

async function getComics() {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT c.*, u.name as author_name, cat.name as category_name 
    FROM comics c
    LEFT JOIN users u ON c.author_id = u.id
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.status = 'PUBLISHED'
    ORDER BY c.views DESC
    LIMIT 6
  `);
  return rows;
}

export default async function Home() {
  const novels = await getNovels();
  const comics = await getComics();

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

      {/* Popular Novels */}
      <section className="py-16 container mx-auto px-4">
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white">📚 นิยายยอดนิยม</h2>
          <Link href="/search?type=novel" className="text-indigo-600 font-medium hover:underline">ดูทั้งหมด</Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {novels.length > 0 ? novels.map((novel) => (
            <Link href={`/novel/${novel.id}`} key={novel.id} className="group">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700 h-full flex flex-col">
                <div className="aspect-[2/3] bg-gradient-to-br from-indigo-500 to-purple-600 relative overflow-hidden">
                  {novel.cover_image ? (
                    <img src={novel.cover_image} alt={novel.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-white/50 text-4xl">📖</div>
                  )}
                  <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                    {novel.category_name || 'Novel'}
                  </div>
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 transition line-clamp-1 text-sm">{novel.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{novel.author_name || 'Unknown'}</p>
                  <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
                    <span>👁️ {(novel.views || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </Link>
          )) : (
            <div className="col-span-6 text-center py-12 text-gray-500 dark:text-gray-400">ยังไม่มีนิยาย</div>
          )}
        </div>
      </section>

      {/* Popular Comics */}
      <section className="py-16 container mx-auto px-4 bg-gray-100 dark:bg-gray-800/50 rounded-3xl">
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white">🎨 การ์ตูนยอดนิยม</h2>
          <Link href="/search?type=comic" className="text-pink-600 font-medium hover:underline">ดูทั้งหมด</Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {comics.length > 0 ? comics.map((comic) => (
            <Link href={`/comic/${comic.id}`} key={comic.id} className="group">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700 h-full flex flex-col">
                <div className="aspect-[2/3] bg-gradient-to-br from-pink-500 to-rose-600 relative overflow-hidden">
                  {comic.cover_image ? (
                    <img src={comic.cover_image} alt={comic.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-white/50 text-4xl">🎨</div>
                  )}
                  <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                    {comic.category_name || 'Comic'}
                  </div>
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-pink-600 transition line-clamp-1 text-sm">{comic.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{comic.author_name || 'Unknown'}</p>
                  <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
                    <span>👁️ {(comic.views || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </Link>
          )) : (
            <div className="col-span-6 text-center py-12 text-gray-500 dark:text-gray-400">ยังไม่มีการ์ตูน</div>
          )}
        </div>
      </section>
    </main>
  );
}

