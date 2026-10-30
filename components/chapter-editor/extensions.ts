import { Extension, Mark } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorState, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view';
import { ALIGNMENTS, HIGHLIGHT_COLORS, MAX_INDENT, TEXT_COLORS } from '@/lib/chapterFormat';

// The formatting Tiptap doesn't ship the way this site needs it. Everything is stored as data-* attributes with
// whitelisted values instead of inline styles, so colours can change with the theme and lib/chapterContent.ts can
// strip every style attribute. A value outside the list isn't parsed, which also cleans it out of pasted content.

type Align = (typeof ALIGNMENTS)[number];

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        chapterFormat: {
            setTextColor: (color: string) => ReturnType;
            unsetTextColor: () => ReturnType;
            setChapterHighlight: (color: string) => ReturnType;
            unsetChapterHighlight: () => ReturnType;
            setAlign: (align: Align | null) => ReturnType;
            changeIndent: (delta: 1 | -1) => ReturnType;
        };
    }
}

const isOneOf = (list: readonly { key: string }[], value: string | null) => list.some((item) => item.key === value);

export const TextColor = Mark.create({
    name: 'textColor',
    addAttributes() {
        return {
            color: {
                default: null,
                parseHTML: (el) => el.getAttribute('data-color'),
                renderHTML: (attrs) => ({ 'data-color': attrs.color }),
            },
        };
    },
    parseHTML() {
        return [{ tag: 'span[data-color]', getAttrs: (el) => (isOneOf(TEXT_COLORS, el.getAttribute('data-color')) ? null : false) }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['span', HTMLAttributes, 0];
    },
    addCommands() {
        return {
            setTextColor: (color) => ({ commands }) => commands.setMark(this.name, { color }),
            unsetTextColor: () => ({ commands }) => commands.unsetMark(this.name),
        };
    },
});

export const ChapterHighlight = Mark.create({
    name: 'chapterHighlight',
    addAttributes() {
        return {
            color: {
                default: null,
                parseHTML: (el) => el.getAttribute('data-highlight'),
                renderHTML: (attrs) => ({ 'data-highlight': attrs.color }),
            },
        };
    },
    parseHTML() {
        return [{ tag: 'mark[data-highlight]', getAttrs: (el) => (isOneOf(HIGHLIGHT_COLORS, el.getAttribute('data-highlight')) ? null : false) }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['mark', HTMLAttributes, 0];
    },
    addCommands() {
        return {
            setChapterHighlight: (color) => ({ commands }) => commands.setMark(this.name, { color }),
            unsetChapterHighlight: () => ({ commands }) => commands.unsetMark(this.name),
        };
    },
});

export const ParagraphFormat = Extension.create({
    name: 'paragraphFormat',
    addGlobalAttributes() {
        return [{
            types: ['paragraph'],
            attributes: {
                align: {
                    default: null,
                    parseHTML: (el) => {
                        const value = el.getAttribute('data-align');
                        return (ALIGNMENTS as readonly (string | null)[]).includes(value) ? value : null;
                    },
                    renderHTML: (attrs) => (attrs.align ? { 'data-align': attrs.align } : {}),
                },
                indent: {
                    default: 0,
                    parseHTML: (el) => {
                        const value = Number(el.getAttribute('data-indent'));
                        return Number.isInteger(value) && value >= 1 && value <= MAX_INDENT ? value : 0;
                    },
                    renderHTML: (attrs) => (attrs.indent ? { 'data-indent': String(attrs.indent) } : {}),
                },
            },
        }];
    },
    addCommands() {
        return {
            setAlign: (align) => ({ commands }) => commands.updateAttributes('paragraph', { align }),
            changeIndent: (delta) => ({ state, tr, dispatch }) => {
                const { from, to } = state.selection;
                state.doc.nodesBetween(from, to, (node, pos) => {
                    if (node.type.name !== 'paragraph') return true;
                    tr.setNodeAttribute(pos, 'indent', Math.min(MAX_INDENT, Math.max(0, node.attrs.indent + delta)));
                    return false;
                });
                dispatch?.(tr);
                return true;
            },
        };
    },
});

// ---------- find and replace ----------

type Match = { from: number; to: number };
type SearchState = { query: string; matches: Match[]; current: number; decorations: DecorationSet };

const searchKey = new PluginKey<SearchState>('chapterSearch');

// Searches block by block (text can span bold/colour marks). A hard break counts as one position, so an offset in
// the block's text is also an offset in the document.
function findMatches(doc: ProseMirrorNode, query: string) {
    const matches: Match[] = [];
    if (!query) return matches;
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
    doc.descendants((node, pos) => {
        if (!node.isTextblock) return true;
        const text = node.textBetween(0, node.content.size, undefined, '\n');
        for (const m of text.matchAll(pattern)) {
            matches.push({ from: pos + 1 + m.index, to: pos + 1 + m.index + m[0].length });
        }
        return false;
    });
    return matches;
}

function buildSearch(doc: ProseMirrorNode, query: string, wanted: number): SearchState {
    const matches = findMatches(doc, query);
    const current = Math.min(wanted, Math.max(0, matches.length - 1));
    const decorations = DecorationSet.create(doc, matches.map((m, i) =>
        Decoration.inline(m.from, m.to, { class: i === current ? 'chapter-search-match chapter-search-current' : 'chapter-search-match' })));
    return { query, matches, current, decorations };
}

export const FindReplace = Extension.create({
    name: 'findReplace',
    addProseMirrorPlugins() {
        return [new Plugin<SearchState>({
            key: searchKey,
            state: {
                init: (_config, state) => buildSearch(state.doc, '', 0),
                apply(tr, value) {
                    const meta = tr.getMeta(searchKey) as { query?: string; current?: number } | undefined;
                    if (!meta && !tr.docChanged) return value;
                    return buildSearch(tr.doc, meta?.query ?? value.query, meta?.current ?? value.current);
                },
            },
            props: { decorations: (state) => searchKey.getState(state)?.decorations },
        })];
    },
});

export function searchInfo(state: EditorState) {
    const search = searchKey.getState(state);
    return { total: search?.matches.length ?? 0, current: search?.matches.length ? search.current + 1 : 0 };
}

export function setSearchQuery(view: EditorView, query: string) {
    view.dispatch(view.state.tr.setMeta(searchKey, { query, current: 0 }));
}

// Move to the next/previous match. Focus stays in the find box, so Enter can be pressed repeatedly.
export function stepMatch(view: EditorView, delta: 1 | -1) {
    const search = searchKey.getState(view.state);
    if (!search?.matches.length) return;
    const current = (search.current + delta + search.matches.length) % search.matches.length;
    const match = search.matches[current];
    view.dispatch(view.state.tr
        .setMeta(searchKey, { current })
        .setSelection(TextSelection.create(view.state.doc, match.from, match.to))
        .scrollIntoView());
}

export function replaceCurrent(view: EditorView, text: string) {
    const search = searchKey.getState(view.state);
    const match = search?.matches[search.current];
    if (match) view.dispatch(view.state.tr.insertText(text, match.from, match.to));
}

export function replaceAll(view: EditorView, text: string) {
    const search = searchKey.getState(view.state);
    if (!search?.matches.length) return 0;
    const { tr } = view.state;
    // Last to first, so earlier positions stay valid
    for (const match of [...search.matches].reverse()) tr.insertText(text, match.from, match.to);
    view.dispatch(tr);
    return search.matches.length;
}

// ---------- paste ----------

// Word and web pages: the schema already drops every style, class and unknown tag, this removes what would survive
// as junk text (Word's fake list bullets, <o:p>&nbsp;</o:p> filler, comments) before it is parsed.
export function cleanPastedHtml(html: string) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('style, script, meta, link, title, img, svg, video, audio, iframe, object').forEach((el) => el.remove());
    doc.querySelectorAll('[style*="mso-list:Ignore" i], [style*="mso-list: Ignore" i]').forEach((el) => el.remove());
    doc.querySelectorAll('*').forEach((el) => {
        if (el.tagName.toLowerCase() === 'o:p') el.remove();
    });
    doc.querySelectorAll('p').forEach((p) => {
        if (!p.textContent?.replace(/ /g, ' ').trim() && !p.querySelector('br')) p.textContent = '';
    });
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT);
    const comments: Node[] = [];
    while (walker.nextNode()) comments.push(walker.currentNode);
    comments.forEach((node) => node.parentNode?.removeChild(node));
    return doc.body.innerHTML;
}
