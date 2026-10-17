import pool from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RowDataPacket } from 'mysql2';
import BookmarkButton from '@/components/BookmarkButton';
import ReportButton from '@/components/ReportButton';
import PriceBadge from '@/components/PriceBadge';
import { auth } from '@/lib/auth';
import { getPurchasedIds } from '@/lib/coins';
import { canViewContent, isOwnerOrAdmin } from '@/lib/visibility';

async function getComic(id: string) {
    const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT c.*, u.name as author_name, cat.name as category_name 
    FROM comics c
    LEFT JOIN users u ON c.author_id = u.id
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.id = ?
  `, [id]);
    return rows[0];
}

async function getEpisodes(comicId: string) {
    const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT e.*, (SELECT COUNT(*) FROM comic_pages WHERE episode_id = e.id) as page_count
    FROM comic_episodes e
    WHERE e.comic_id = ? 
    ORDER BY e.episode_order ASC
  `, [comicId]);
    return rows;
}

export default async function ComicDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const comic = await getComic(id);

    const session = await auth();
    if (!comic || !canViewContent(session?.user, comic)) notFound();

    const episodes = await getEpisodes(id);
    const isOwner = isOwnerOrAdmin(session?.user, comic.author_id);
    const purchased = await getPurchasedIds(session?.user?.id, 'episode', episodes.filter(e => e.price > 0).map(e => e.id));

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
            {/* Header / Banner */}
            <div className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
                <div className="container mx-auto px-4 py-12">
                    <div className="flex flex-col md:flex-row gap-10">
                        {/* Cover Image */}
                        <div className="w-full md:w-72 flex-shrink-0">
                            <div className="aspect-[2/3] bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl overflow-hidden shadow-lg relative group">
                                {comic.cover_image ? (
                                    <img src={comic.cover_image} alt={comic.title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/50 text-6xl">🎨</div>
                                )}
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex-grow">
                            <div className="flex flex-wrap gap-3 mb-4">
                                <span className="px-3 py-1 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300 text-sm font-medium">
                                    {comic.category_name || 'Comic'}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${comic.status === 'PUBLISHED' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'}`}>
                                    {comic.status === 'PUBLISHED' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}
                                </span>
                            </div>

                            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">{comic.title}</h1>
                            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">By <span className="font-semibold text-gray-900 dark:text-white">{comic.author_name || 'Unknown'}</span></p>

                            <div className="flex gap-4 mb-10">
                                {episodes.length > 0 ? (
                                    <Link href={`/comic/${id}/read/${episodes[0].id}`} className="bg-pink-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-pink-700 transition shadow-lg hover:shadow-pink-500/30">
                                        เริ่มอ่าน
                                    </Link>
                                ) : (
                                    <button disabled className="bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 px-8 py-3 rounded-lg font-bold cursor-not-allowed">
                                        ยังไม่มีตอน
                                    </button>
                                )}
                                <BookmarkButton contentType="comic" contentId={id} accentColor="pink" />
                                <ReportButton targetType="COMIC" targetId={id} />
                            </div>

                            <div className="prose max-w-none text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl border border-gray-100 dark:border-gray-600">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">เรื่องย่อ</h3>
                                <p className="leading-relaxed">{comic.description || 'ไม่มีเรื่องย่อ'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Episodes List */}
            <div className="container mx-auto px-4 py-12">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">ตอนทั้งหมด ({episodes.length})</h2>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
                        {episodes.map((episode) => (
                            <Link
                                href={`/comic/${id}/read/${episode.id}`}
                                key={episode.id}
                                className="flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition group"
                            >
                                <div className="flex items-center gap-6">
                                    <span className="text-gray-400 font-mono w-8 text-lg">#{episode.episode_order}</span>
                                    <div>
                                        <span className="font-medium text-gray-700 dark:text-gray-200 text-lg group-hover:text-pink-600 transition">
                                            {episode.title}
                                        </span>
                                        <p className="text-sm text-gray-400">{episode.page_count || 0} หน้า</p>
                                    </div>
                                </div>
                                <span className="flex items-center gap-4 text-sm">
                                    <PriceBadge price={episode.price} unlocked={isOwner || purchased.has(episode.id)} />
                                    <span className="text-gray-400">{new Date(episode.created_at).toLocaleDateString('th-TH')}</span>
                                </span>
                            </Link>
                        ))}
                        {episodes.length === 0 && (
                            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                                ยังไม่มีตอน
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
