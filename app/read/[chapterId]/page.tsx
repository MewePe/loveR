import pool from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RowDataPacket } from 'mysql2';

async function getChapter(id: string) {
    const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT c.*, n.title as novel_title 
    FROM chapters c 
    JOIN novels n ON c.novel_id = n.id 
    WHERE c.id = ?
  `, [id]);
    return rows[0];
}

async function getAdjacentChapters(novelId: string, currentOrder: number) {
    const [prev] = await pool.query<RowDataPacket[]>(`
    SELECT id FROM chapters WHERE novel_id = ? AND chapter_order < ? ORDER BY chapter_order DESC LIMIT 1
  `, [novelId, currentOrder]);

    const [next] = await pool.query<RowDataPacket[]>(`
    SELECT id FROM chapters WHERE novel_id = ? AND chapter_order > ? ORDER BY chapter_order ASC LIMIT 1
  `, [novelId, currentOrder]);

    return { prev: prev[0], next: next[0] };
}

export default async function ReadChapter({ params }: { params: { chapterId: string } }) {
    const chapter = await getChapter(params.chapterId);

    if (!chapter) notFound();

    const { prev, next } = await getAdjacentChapters(chapter.novel_id, chapter.chapter_order);

    return (
        <div className="min-h-screen bg-[#f9f9f9] text-gray-800 font-serif">
            {/* Top Navigation */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b shadow-sm px-4 py-3 flex items-center justify-between">
                <Link href={`/novel/${chapter.novel_id}`} className="text-sm font-medium text-gray-500 hover:text-indigo-600 truncate max-w-[200px] flex items-center gap-1">
                    &larr; <span className="hidden sm:inline">{chapter.novel_title}</span>
                </Link>
                <h1 className="text-sm md:text-base font-bold text-center truncate px-2">{chapter.title}</h1>
                <div className="w-[100px] flex justify-end gap-2 text-sm">
                    <button className="text-gray-400 hover:text-gray-600">Aa</button>
                    <button className="text-gray-400 hover:text-gray-600">🌙</button>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-6 py-12 md:py-20">
                <div
                    className="prose prose-lg md:prose-xl max-w-none leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: chapter.content }}
                />
            </div>

            {/* Bottom Navigation */}
            <div className="max-w-3xl mx-auto px-6 pb-20">
                <div className="flex items-center justify-between gap-4 border-t pt-8">
                    {prev ? (
                        <Link
                            href={`/read/${prev.id}`}
                            className="flex-1 bg-white border border-gray-300 text-gray-700 py-4 rounded-xl text-center font-medium hover:bg-gray-50 transition shadow-sm"
                        >
                            &larr; Previous
                        </Link>
                    ) : (
                        <button disabled className="flex-1 bg-gray-100 text-gray-400 py-4 rounded-xl text-center font-medium cursor-not-allowed">
                            Previous
                        </button>
                    )}

                    {next ? (
                        <Link
                            href={`/read/${next.id}`}
                            className="flex-1 bg-indigo-600 text-white py-4 rounded-xl text-center font-medium hover:bg-indigo-700 transition shadow-lg hover:shadow-indigo-500/30"
                        >
                            Next &rarr;
                        </Link>
                    ) : (
                        <button disabled className="flex-1 bg-gray-100 text-gray-400 py-4 rounded-xl text-center font-medium cursor-not-allowed">
                            Next
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
