import pool from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RowDataPacket } from 'mysql2';
import BookmarkButton from '@/components/BookmarkButton';
import ReportButton from '@/components/ReportButton';
import RatingStars from '@/components/RatingStars';
import CommentSection from '@/components/CommentSection';
import PriceBadge from '@/components/PriceBadge';
import StoryCard from '@/components/StoryCard';
import { auth } from '@/lib/auth';
import { getPurchasedIds } from '@/lib/coins';
import { canViewContent, isOwnerOrAdmin } from '@/lib/visibility';
import { getSimilarStories } from '@/lib/ranking';
import { getCategoriesFor } from '@/lib/categories';
import CategoryTags from '@/components/CategoryTags';
import AuthorLink from '@/components/AuthorLink';

async function getNovel(id: string) {
    const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT n.*, u.name as author_name, u.username as author_username
    FROM novels n
    LEFT JOIN users u ON n.author_id = u.id
    WHERE n.id = ?
  `, [id]);
    return rows[0];
}

async function getChapters(novelId: string) {
    const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT id, title, chapter_order, price, created_at
    FROM chapters
    WHERE novel_id = ? 
    ORDER BY chapter_order ASC
  `, [novelId]);
    return rows;
}

export default async function NovelDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const novel = await getNovel(id);

    const session = await auth();
    if (!novel || !canViewContent(session?.user, novel)) notFound();

    const chapters = await getChapters(id);
    const isOwner = isOwnerOrAdmin(session?.user, novel.author_id);
    const similar = await getSimilarStories('novel', novel.id);
    const categories = (await getCategoriesFor('novel', [novel.id])).get(novel.id) ?? [];
    const purchased = await getPurchasedIds(session?.user?.id, 'chapter', chapters.filter(c => c.price > 0).map(c => c.id));

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
            {/* Header / Banner */}
            <div className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
                <div className="container mx-auto px-4 py-12">
                    <div className="flex flex-col md:flex-row gap-10">
                        {/* Cover Image */}
                        <div className="w-full md:w-72 flex-shrink-0">
                            <div className="aspect-[2/3] bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl overflow-hidden shadow-lg relative group">
                                {novel.cover_image ? (
                                    <img src={novel.cover_image} alt={novel.title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/50 text-6xl">📖</div>
                                )}
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex-grow">
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium">นิยาย</span>
                                {!!novel.is_completed && (
                                    <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-sm font-medium">จบแล้ว</span>
                                )}
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${novel.status === 'PUBLISHED' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'}`}>
                                    {novel.status === 'PUBLISHED' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}
                                </span>
                            </div>

                            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 break-words">{novel.title}</h1>
                            <p className="text-xl text-gray-600 dark:text-gray-300 mb-4">โดย <AuthorLink id={novel.author_id} username={novel.author_username} name={novel.author_name} className="font-semibold text-gray-900 dark:text-white" /></p>
                            <CategoryTags categories={categories} type="novel" size="md" className="mb-8" />

                            <RatingStars contentType="novel" contentId={id} />
                            <div className="flex flex-wrap gap-3 sm:gap-4 mb-10">
                                {chapters.length > 0 ? (
                                    <Link href={`/read/${chapters[0].id}`} className="whitespace-nowrap bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 transition shadow-lg hover:shadow-indigo-500/30">
                                        เริ่มอ่าน
                                    </Link>
                                ) : (
                                    <button disabled className="bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 px-8 py-3 rounded-lg font-bold cursor-not-allowed">
                                        ยังไม่มีบท
                                    </button>
                                )}
                                <BookmarkButton contentType="novel" contentId={id} accentColor="indigo" />
                                <ReportButton targetType="NOVEL" targetId={id} />
                            </div>

                            <div className="prose max-w-none text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl border border-gray-100 dark:border-gray-600">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">เรื่องย่อ</h3>
                                <p className="leading-relaxed">{novel.description || 'ไม่มีเรื่องย่อ'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chapters List */}
            <div className="container mx-auto px-4 py-12">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">ตอนทั้งหมด ({chapters.length})</h2>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
                        {chapters.map((chapter) => (
                            <Link
                                href={`/read/${chapter.id}`}
                                key={chapter.id}
                                className="flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition group"
                            >
                                <div className="flex items-center gap-6">
                                    <span className="text-gray-500 dark:text-gray-400 font-mono w-8 text-lg">#{chapter.chapter_order}</span>
                                    <span className="font-medium text-gray-700 dark:text-gray-200 text-lg group-hover:text-indigo-600 transition">
                                        {chapter.title}
                                    </span>
                                </div>
                                <span className="flex items-center gap-4 text-sm">
                                    <PriceBadge price={chapter.price} unlocked={isOwner || purchased.has(chapter.id)} />
                                    <span className="text-gray-500 dark:text-gray-400">{new Date(chapter.created_at).toLocaleDateString('th-TH')}</span>
                                </span>
                            </Link>
                        ))}
                        {chapters.length === 0 && (
                            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                                ยังไม่มีบท
                            </div>
                        )}
                    </div>

                    {similar.length > 0 && (
                        <div className="mt-12">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">เรื่องที่คล้ายกัน</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                                {similar.map((story) => <StoryCard key={story.id} story={story} type="novel" />)}
                            </div>
                        </div>
                    )}

                    <div className="mt-12">
                        <CommentSection contentType="novel" contentId={id} accentColor="indigo" />
                    </div>
                </div>
            </div>
        </div>
    );
}
