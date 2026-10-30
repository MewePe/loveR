// What a chapter's rich text may contain. No imports, so the editor (client) and the sanitizer (lib/chapterContent.ts)
// share one list. Colours are names, not values: the actual colours live in globals.css (.chapter-rich) so each one
// can be different per theme and stay readable. Font size and family are deliberately absent: they belong to the
// reader's Aa settings.

export const CONTENT_FORMATS = ['PLAIN', 'HTML'] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const TEXT_COLORS = [
    { key: 'red', label: 'แดง' },
    { key: 'orange', label: 'ส้ม' },
    { key: 'amber', label: 'เหลืองทอง' },
    { key: 'green', label: 'เขียว' },
    { key: 'blue', label: 'น้ำเงิน' },
    { key: 'purple', label: 'ม่วง' },
    { key: 'pink', label: 'ชมพู' },
    { key: 'gray', label: 'เทา' },
] as const;

export const HIGHLIGHT_COLORS = [
    { key: 'yellow', label: 'เหลือง' },
    { key: 'orange', label: 'ส้ม' },
    { key: 'green', label: 'เขียว' },
    { key: 'blue', label: 'ฟ้า' },
    { key: 'purple', label: 'ม่วง' },
    { key: 'pink', label: 'ชมพู' },
] as const;

// Left is the default, so only these are stored
export const ALIGNMENTS = ['center', 'right'] as const;
export const MAX_INDENT = 4;

export const SPECIAL_CHARACTERS = [
    '…', '—', '–', '“', '”', '‘', '’', '«', '»', '•', '·', '※',
    '★', '☆', '♥', '♡', '♪', '♫', '○', '●', '◆', '◇', '■', '□',
    '→', '←', '↑', '↓', '°', '±', '×', '÷', '≠', '≈', '©', '™',
    '๏', 'ฯ', 'ๆ', '๚', '๛', '฿',
] as const;

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// An old plain-text chapter as editor content: a blank line starts a paragraph, a single newline is a line break
export function plainToHtml(text: string) {
    return text
        .split(/\r?\n(?:[ \t]*\r?\n)+/)
        .map((block) => `<p>${escapeHtml(block).replace(/\r?\n/g, '<br>')}</p>`)
        .join('');
}

// Thai has no spaces between words, so splitting on whitespace would count a whole sentence as one word
export function countWords(text: string) {
    if (typeof Intl.Segmenter !== 'function') return text.split(/\s+/).filter(Boolean).length;
    let words = 0;
    for (const part of new Intl.Segmenter('th', { granularity: 'word' }).segment(text)) {
        if (part.isWordLike) words++;
    }
    return words;
}

export const countCharacters = (text: string) => [...text.replace(/\s/g, '')].length;
