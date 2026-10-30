import { sanitizeChapterHtml } from '@/lib/chapterContent';

// The chapter text on the reader page. HTML is only ever rendered right after passing the server-side sanitizer
// (lib/chapterContent.ts), because it is author input that would otherwise run in readers' browsers (for example
// buying chapters with their coins). Old chapters are PLAIN and stay plain text.
export default function ChapterBody({ content, format }: { content: string | null; format: unknown }) {
    if (format === 'HTML') {
        return (
            <div
                className="reading-content reader-text chapter-rich text-gray-800 dark:text-gray-100"
                dangerouslySetInnerHTML={{ __html: sanitizeChapterHtml(content ?? '') }}
            />
        );
    }
    return <div className="reading-content reader-text whitespace-pre-line text-gray-800 dark:text-gray-100">{content || ''}</div>;
}
