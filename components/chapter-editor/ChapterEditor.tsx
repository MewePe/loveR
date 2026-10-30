"use client";
import { useEffect, useRef, useState } from 'react';
import { Editor, EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
    AlignCenter, AlignLeft, AlignRight, Baseline, Bold, ChevronDown, ChevronUp, Highlighter, IndentDecrease, IndentIncrease,
    Italic, Link2, List, ListOrdered, LucideIcon, Minus, Omega, Redo2, RemoveFormatting, Search, Strikethrough, Underline, Undo2, X,
} from 'lucide-react';
import { countCharacters, countWords, HIGHLIGHT_COLORS, MAX_INDENT, SPECIAL_CHARACTERS, TEXT_COLORS } from '@/lib/chapterFormat';
import {
    ChapterHighlight, cleanPastedHtml, FindReplace, ParagraphFormat, replaceAll, replaceCurrent, searchInfo, setSearchQuery, stepMatch, TextColor,
} from '@/components/chapter-editor/extensions';

type Panel = 'color' | 'highlight' | 'link' | 'find' | 'special' | null;

// Pressing a toolbar button must not take the selection away from the text
const keepSelection = (e: React.MouseEvent) => e.preventDefault();

function ToolButton({ icon: Icon, label, active, disabled, onClick }: { icon: LucideIcon; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            onMouseDown={keepSelection}
            onClick={onClick}
            className={`shrink-0 w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-lg transition disabled:opacity-40 ${active ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
            <Icon className="w-5 h-5" />
        </button>
    );
}

const Divider = () => <span aria-hidden className="shrink-0 w-px h-6 mx-0.5 bg-gray-200 dark:bg-gray-700" />;

const PANEL_INPUT = 'min-w-0 flex-1 px-3 py-2 text-base md:text-sm border rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none';
const PANEL_BUTTON = 'shrink-0 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition';

// The swatches use .chapter-rich so they show exactly the colour readers get in the current theme
function ColorPanel({ editor, kind }: { editor: Editor; kind: 'color' | 'highlight' }) {
    const isText = kind === 'color';
    const colors = isText ? TEXT_COLORS : HIGHLIGHT_COLORS;
    const apply = (key: string | null) => {
        const chain = editor.chain().focus();
        if (isText) (key ? chain.setTextColor(key) : chain.unsetTextColor()).run();
        else (key ? chain.setChapterHighlight(key) : chain.unsetChapterHighlight()).run();
    };
    return (
        <div className="chapter-rich flex flex-wrap items-center gap-1">
            {colors.map((color) => (
                <button
                    key={color.key}
                    type="button"
                    title={color.label}
                    aria-label={`${isText ? 'สีตัวอักษร' : 'สีไฮไลต์'}${color.label}`}
                    onMouseDown={keepSelection}
                    onClick={() => apply(color.key)}
                    className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                    {isText ? <span data-color={color.key}>ก</span> : <mark data-highlight={color.key} className="px-1">ก</mark>}
                </button>
            ))}
            <button type="button" onMouseDown={keepSelection} onClick={() => apply(null)} className={PANEL_BUTTON}>ไม่มีสี</button>
        </div>
    );
}

function LinkPanel({ editor, onDone }: { editor: Editor; onDone: () => void }) {
    const [url, setUrl] = useState<string>(editor.getAttributes('link').href ?? '');
    const [error, setError] = useState('');

    function apply() {
        const value = url.trim();
        if (!value) {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            onDone();
            return;
        }
        const href = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
        if (!/^https?:\/\/\S+$/i.test(href)) {
            setError('ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://');
            return;
        }
        if (editor.state.selection.empty && !editor.isActive('link')) {
            editor.chain().focus().insertContent({ type: 'text', text: value, marks: [{ type: 'link', attrs: { href } }] }).run();
        } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
        }
        onDone();
    }

    return (
        <div>
            <div className="flex items-center gap-2">
                <input
                    autoFocus
                    type="url"
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); setError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
                    placeholder="https://..."
                    aria-label="ที่อยู่ลิงก์"
                    className={PANEL_INPUT}
                />
                <button type="button" onClick={apply} className={PANEL_BUTTON}>ใส่ลิงก์</button>
            </div>
            {error && <p role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>}
            {!error && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">เว้นว่างแล้วกด ใส่ลิงก์ เพื่อเอาลิงก์ออก</p>}
        </div>
    );
}

function FindPanel({ editor }: { editor: Editor }) {
    const [query, setQuery] = useState('');
    const [replacement, setReplacement] = useState('');
    const info = useEditorState({ editor, selector: ({ editor: e }) => searchInfo(e.state) });

    // Clear the highlights when the panel closes
    useEffect(() => () => {
        if (!editor.isDestroyed) setSearchQuery(editor.view, '');
    }, [editor]);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-1">
                <input
                    autoFocus
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setSearchQuery(editor.view, e.target.value); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); stepMatch(editor.view, e.shiftKey ? -1 : 1); } }}
                    placeholder="ค้นหา"
                    aria-label="ค้นหา"
                    className={PANEL_INPUT}
                />
                <span aria-live="polite" className="shrink-0 min-w-12 text-center text-sm text-gray-500 dark:text-gray-400">{query ? `${info.current}/${info.total}` : ''}</span>
                <ToolButton icon={ChevronUp} label="ก่อนหน้า" disabled={!info.total} onClick={() => stepMatch(editor.view, -1)} />
                <ToolButton icon={ChevronDown} label="ถัดไป" disabled={!info.total} onClick={() => stepMatch(editor.view, 1)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <input
                    value={replacement}
                    onChange={(e) => setReplacement(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                    placeholder="แทนที่ด้วย"
                    aria-label="แทนที่ด้วย"
                    className={`${PANEL_INPUT} basis-40`}
                />
                <button type="button" disabled={!info.total} onClick={() => replaceCurrent(editor.view, replacement)} className={PANEL_BUTTON}>แทนที่</button>
                <button type="button" disabled={!info.total} onClick={() => replaceAll(editor.view, replacement)} className={PANEL_BUTTON}>แทนที่ทั้งหมด</button>
            </div>
        </div>
    );
}

function SpecialPanel({ editor }: { editor: Editor }) {
    return (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {SPECIAL_CHARACTERS.map((char) => (
                <button
                    key={char}
                    type="button"
                    aria-label={`แทรก ${char}`}
                    onMouseDown={keepSelection}
                    onClick={() => editor.chain().focus().insertContent(char).run()}
                    className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                    {char}
                </button>
            ))}
        </div>
    );
}

// Rich text box for chapter content. Remount it (new key) to load different content. onChange gets the HTML and
// whether the text is empty; the server sanitizes the HTML again, this only decides what the author can produce.
export default function ChapterEditor({ initialHtml, onChange, status }: {
    initialHtml: string;
    onChange: (html: string, empty: boolean) => void;
    status?: string; // shown next to the counts, e.g. when the draft was saved
}) {
    const [panel, setPanel] = useState<Panel>(null);
    const [counts, setCounts] = useState({ words: 0, characters: 0 });
    const [empty, setEmpty] = useState(!initialHtml);
    const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onChangeRef = useRef(onChange);
    useEffect(() => { onChangeRef.current = onChange; });

    const updateCounts = (e: Editor) => {
        const text = e.getText();
        setCounts({ words: countWords(text), characters: countCharacters(text) });
    };

    const editor = useEditor({
        immediatelyRender: false,
        content: initialHtml,
        extensions: [
            StarterKit.configure({
                heading: false,
                blockquote: false,
                code: false,
                codeBlock: false,
                link: { openOnClick: false, protocols: ['http', 'https'], defaultProtocol: 'https' },
            }),
            TextColor,
            ChapterHighlight,
            ParagraphFormat,
            FindReplace.extend({
                addKeyboardShortcuts: () => ({ 'Mod-f': () => { setPanel('find'); return true; } }),
            }),
        ],
        editorProps: {
            attributes: {
                'aria-label': 'เนื้อหา',
                class: 'chapter-rich min-h-[50vh] md:min-h-80 px-4 py-3 text-base leading-relaxed text-gray-900 dark:text-gray-100 outline-none',
            },
            transformPastedHTML: cleanPastedHtml,
        },
        onCreate: ({ editor: e }) => updateCounts(e),
        onUpdate: ({ editor: e }) => {
            onChangeRef.current(e.getHTML(), e.isEmpty);
            setEmpty(e.isEmpty);
            if (countTimer.current) clearTimeout(countTimer.current);
            countTimer.current = setTimeout(() => updateCounts(e), 300);
        },
    });

    useEffect(() => () => {
        if (countTimer.current) clearTimeout(countTimer.current);
    }, []);

    if (!editor) {
        return <div className="min-h-96 rounded-lg border bg-gray-50 dark:bg-gray-700/40 animate-pulse" />;
    }

    return (
        <div className="rounded-lg border border-gray-400 dark:border-gray-500 focus-within:ring-2 focus-within:ring-indigo-500">
            <Toolbar editor={editor} panel={panel} setPanel={setPanel} />

            <div className="relative bg-white dark:bg-gray-800">
                {empty && <p aria-hidden className="pointer-events-none absolute left-4 top-3 text-base text-gray-500 dark:text-gray-400">เขียนเนื้อหาบทที่นี่...</p>}
                <EditorContent editor={editor} />
            </div>

            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-b-lg border-t bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{counts.words.toLocaleString()} คำ · {counts.characters.toLocaleString()} ตัวอักษร</span>
                {status && <span role="status">{status}</span>}
            </div>
        </div>
    );
}

// Rendered only once the editor exists: useEditorState wouldn't notice it arriving after a null first render
function Toolbar({ editor, panel, setPanel }: { editor: Editor; panel: Panel; setPanel: React.Dispatch<React.SetStateAction<Panel>> }) {
    const active = useEditorState({
        editor,
        selector: ({ editor: e }) => ({
            undo: e.can().undo(),
            redo: e.can().redo(),
            bold: e.isActive('bold'),
            underline: e.isActive('underline'),
            italic: e.isActive('italic'),
            strike: e.isActive('strike'),
            color: e.isActive('textColor'),
            highlight: e.isActive('chapterHighlight'),
            center: e.isActive('paragraph', { align: 'center' }),
            right: e.isActive('paragraph', { align: 'right' }),
            ordered: e.isActive('orderedList'),
            bullet: e.isActive('bulletList'),
            link: e.isActive('link'),
            list: e.isActive('listItem'),
            indent: (e.getAttributes('paragraph').indent ?? 0) as number,
        }),
    });

    const toggle = (next: Panel) => setPanel((current) => (current === next ? null : next));
    const chain = () => editor.chain().focus();
    const indent = (delta: 1 | -1) => {
        if (active.list) (delta === 1 ? chain().sinkListItem('listItem') : chain().liftListItem('listItem')).run();
        else chain().changeIndent(delta).run();
    };

    return (
        <>
            {/* Sticks to the top of the modal; scrolls sideways on phones so the text keeps the screen */}
            <div className="sticky top-0 z-10 rounded-t-lg border-b bg-white dark:bg-gray-800">
                <div role="toolbar" aria-label="เครื่องมือจัดรูปแบบ" className="flex items-center gap-0.5 p-1 overflow-x-auto md:flex-wrap md:overflow-x-visible">
                    <ToolButton icon={Undo2} label="ย้อนกลับ" disabled={!active.undo} onClick={() => chain().undo().run()} />
                    <ToolButton icon={Redo2} label="ทำซ้ำ" disabled={!active.redo} onClick={() => chain().redo().run()} />
                    <Divider />
                    <ToolButton icon={Bold} label="ตัวหนา" active={active.bold} onClick={() => chain().toggleBold().run()} />
                    <ToolButton icon={Underline} label="ขีดเส้นใต้" active={active.underline} onClick={() => chain().toggleUnderline().run()} />
                    <ToolButton icon={Italic} label="ตัวเอียง" active={active.italic} onClick={() => chain().toggleItalic().run()} />
                    <ToolButton icon={Strikethrough} label="ขีดฆ่า" active={active.strike} onClick={() => chain().toggleStrike().run()} />
                    <ToolButton icon={Baseline} label="สีตัวอักษร" active={active.color || panel === 'color'} onClick={() => toggle('color')} />
                    <ToolButton icon={Highlighter} label="สีไฮไลต์" active={active.highlight || panel === 'highlight'} onClick={() => toggle('highlight')} />
                    <Divider />
                    <ToolButton icon={Minus} label="เส้นคั่น" onClick={() => chain().setHorizontalRule().run()} />
                    <ToolButton
                        icon={RemoveFormatting}
                        label="ล้างรูปแบบ"
                        onClick={() => chain().unsetAllMarks().clearNodes().updateAttributes('paragraph', { align: null, indent: 0 }).run()}
                    />
                    <Divider />
                    <ToolButton icon={AlignLeft} label="จัดชิดซ้าย" active={!active.center && !active.right} onClick={() => chain().setAlign(null).run()} />
                    <ToolButton icon={AlignCenter} label="จัดกึ่งกลาง" active={active.center} onClick={() => chain().setAlign('center').run()} />
                    <ToolButton icon={AlignRight} label="จัดชิดขวา" active={active.right} onClick={() => chain().setAlign('right').run()} />
                    <Divider />
                    <ToolButton icon={IndentDecrease} label="ลดย่อหน้า" disabled={!active.list && !active.indent} onClick={() => indent(-1)} />
                    <ToolButton icon={IndentIncrease} label="เพิ่มย่อหน้า" disabled={!active.list && active.indent >= MAX_INDENT} onClick={() => indent(1)} />
                    <ToolButton icon={ListOrdered} label="ลิสต์ตัวเลข" active={active.ordered} onClick={() => chain().toggleOrderedList().run()} />
                    <ToolButton icon={List} label="ลิสต์จุด" active={active.bullet} onClick={() => chain().toggleBulletList().run()} />
                    <Divider />
                    <ToolButton icon={Link2} label="ลิงก์" active={active.link || panel === 'link'} onClick={() => toggle('link')} />
                    <ToolButton icon={Search} label="ค้นหาและแทนที่" active={panel === 'find'} onClick={() => toggle('find')} />
                    <ToolButton icon={Omega} label="อักขระพิเศษ" active={panel === 'special'} onClick={() => toggle('special')} />
                </div>

                {/* A strip under the toolbar, not a popover: the toolbar scrolls sideways on phones and would clip one */}
                {panel && (
                    <div className="flex items-start gap-2 border-t p-2">
                        <div className="min-w-0 flex-1">
                            {(panel === 'color' || panel === 'highlight') && <ColorPanel key={panel} editor={editor} kind={panel} />}
                            {panel === 'link' && <LinkPanel editor={editor} onDone={() => setPanel(null)} />}
                            {panel === 'find' && <FindPanel editor={editor} />}
                            {panel === 'special' && <SpecialPanel editor={editor} />}
                        </div>
                        <ToolButton icon={X} label="ปิด" onClick={() => setPanel(null)} />
                    </div>
                )}
            </div>
        </>
    );
}
