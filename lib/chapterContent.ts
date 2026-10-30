import sanitizeHtml from 'sanitize-html';
import { Parser } from 'htmlparser2';
import { ALIGNMENTS, CONTENT_FORMATS, ContentFormat, HIGHLIGHT_COLORS, MAX_INDENT, TEXT_COLORS } from '@/lib/chapterFormat';

// Server side of the chapter editor. chapters.content_format says what chapters.content is: PLAIN (shown as text,
// never as HTML) or HTML (author input, so it is sanitized when saved AND again whenever it leaves the server).
// Only the tags the editor can make survive, and attributes only with whitelisted values, so no inline style,
// no class, no event handlers. Server-only: sanitize-html is too big for the client bundle.

export const LINK_REL = 'noopener noreferrer nofollow ugc';
const MAX_URL = 2000;

function isHttpUrl(value: string | undefined): value is string {
    if (!value || value.length > MAX_URL) return false;
    try {
        const { protocol } = new URL(value);
        return protocol === 'https:' || protocol === 'http:';
    } catch {
        return false;
    }
}

// Keeps only the listed attributes with a listed value (sanitize-html's own `values` option leaves an empty attribute)
function keepValues(allowed: Record<string, readonly string[]>): sanitizeHtml.Transformer {
    return (tagName, attribs) => ({
        tagName,
        attribs: Object.fromEntries(Object.entries(attribs).filter(([name, value]) => allowed[name]?.includes(value))),
    });
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: ['p', 'br', 'hr', 'strong', 'em', 'u', 's', 'span', 'mark', 'a', 'ol', 'ul', 'li'],
    allowedAttributes: {
        a: ['href', 'target', 'rel'],
        p: ['data-align', 'data-indent'],
        span: ['data-color'],
        mark: ['data-highlight'],
    },
    allowedSchemes: ['http', 'https'],
    allowProtocolRelative: false,
    transformTags: {
        p: keepValues({ 'data-align': ALIGNMENTS, 'data-indent': Array.from({ length: MAX_INDENT }, (_, i) => String(i + 1)) }),
        span: keepValues({ 'data-color': TEXT_COLORS.map((c) => c.key) }),
        mark: keepValues({ 'data-highlight': HIGHLIGHT_COLORS.map((c) => c.key) }),
        b: 'strong',
        i: 'em',
        del: 's',
        strike: 's',
        // Absolute http(s) links only; anything else keeps its text and loses the link
        a: (_tagName, attribs): sanitizeHtml.Tag => (isHttpUrl(attribs.href)
            ? { tagName: 'a', attribs: { href: attribs.href, target: '_blank', rel: LINK_REL } }
            : { tagName: 'span', attribs: {} }),
    },
};

export const sanitizeChapterHtml = (html: string) => sanitizeHtml(html, SANITIZE_OPTIONS);

// undefined = not given (the caller picks the default), null = invalid
export function parseContentFormat(value: unknown): ContentFormat | undefined | null {
    if (value === undefined) return undefined;
    return (CONTENT_FORMATS as readonly unknown[]).includes(value) ? value as ContentFormat : null;
}

// What to store or send for this format
export function cleanChapterContent(content: string, format: unknown) {
    return format === 'HTML' ? sanitizeChapterHtml(content) : content;
}

const BLOCK_TAGS = new Set(['p', 'li', 'hr', 'br']);

function htmlToText(html: string) {
    const out: string[] = [];
    const hrefs: (string | undefined)[] = [];
    const parser = new Parser({
        onopentag(name, attribs) {
            if (name === 'a') hrefs.push(attribs.href);
        },
        ontext(text) {
            out.push(text);
        },
        onclosetag(name) {
            if (name === 'a') {
                const href = hrefs.pop();
                if (href) out.push(` (${href})`);
            }
            if (BLOCK_TAGS.has(name)) out.push('\n');
        },
    });
    parser.write(html);
    parser.end();
    return out.join('').trim();
}

// The chapter as plain text, for the content check and the admin's excerpt. Sanitized first, so this is exactly the
// text a reader gets. Link addresses are kept: a link to a gambling site is something the check has to see.
export function chapterPlainText(content: string | null | undefined, format: unknown) {
    if (!content) return '';
    return format === 'HTML' ? htmlToText(sanitizeChapterHtml(content)) : content;
}

// Did the words change? Formatting alone doesn't need a new content check, and neither does an old plain-text
// chapter being saved from the editor for the first time.
export function sameChapterText(a: string, b: string) {
    const normalise = (text: string) => text.replace(/\s+/g, ' ').trim();
    return normalise(a) === normalise(b);
}
