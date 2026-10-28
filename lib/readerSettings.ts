// Novel reader display settings (the "Aa" panel on /read/[chapterId]). No imports, so the reader components and
// the API can share it. Stored as JSON in users.reader_settings for logged-in readers and in localStorage
// (READER_SETTINGS_KEY) otherwise. Every value is whitelisted here; anything else falls back to the default.

export const FONT_SIZES = [16, 18, 20, 22, 24, 26, 28] as const; // px; the panel shows the px number
export const LEADINGS = { tight: { label: 'แคบ', value: 1.6 }, normal: { label: 'ปกติ', value: 1.9 }, loose: { label: 'กว้าง', value: 2.3 } } as const;
export const FONTS = { looped: { label: 'มีหัว' }, loopless: { label: 'ไม่มีหัว' } } as const;
export const THEMES = { white: { label: 'ขาว' }, sepia: { label: 'ซีเปีย' }, dark: { label: 'มืด' } } as const;
export const WIDTHS = { narrow: { label: 'แคบ', value: '36rem' }, normal: { label: 'ปกติ', value: '48rem' }, wide: { label: 'กว้าง', value: '64rem' } } as const;

export interface ReaderSettings {
    size: number; // index into FONT_SIZES
    leading: keyof typeof LEADINGS;
    font: keyof typeof FONTS;
    theme: keyof typeof THEMES; // 'dark' is the site's dark mode (next-themes); white/sepia use the light site theme
    width: keyof typeof WIDTHS;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = { size: 2, leading: 'normal', font: 'looped', theme: 'white', width: 'normal' };
export const READER_SETTINGS_KEY = 'loveread:reader-settings';

const oneOf = <T extends object>(map: T, value: unknown): value is keyof T => typeof value === 'string' && Object.hasOwn(map, value);

// Any input (parsed JSON, a stored string, a request body) → valid settings. Unknown or bad fields get the default.
export function parseReaderSettings(input: unknown): ReaderSettings {
    let raw = input;
    if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch { raw = null; }
    }
    const o = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const d = DEFAULT_READER_SETTINGS;
    return {
        size: Number.isInteger(o.size) && (o.size as number) >= 0 && (o.size as number) < FONT_SIZES.length ? o.size as number : d.size,
        leading: oneOf(LEADINGS, o.leading) ? o.leading : d.leading,
        font: oneOf(FONTS, o.font) ? o.font : d.font,
        theme: oneOf(THEMES, o.theme) ? o.theme : d.theme,
        width: oneOf(WIDTHS, o.width) ? o.width : d.width,
    };
}

// True only when every field is present and valid (the API rejects anything else)
export function isValidReaderSettings(input: unknown): boolean {
    if (!input || typeof input !== 'object') return false;
    const parsed = parseReaderSettings(input);
    const o = input as Record<string, unknown>;
    return (Object.keys(parsed) as (keyof ReaderSettings)[]).every((k) => parsed[k] === o[k]) && Object.keys(o).length === 5;
}

// CSS custom properties read by the .reader-* rules in globals.css
export function readerCssVars(s: ReaderSettings) {
    return {
        '--reader-size': `${FONT_SIZES[s.size]}px`,
        '--reader-leading': String(LEADINGS[s.leading].value),
        '--reader-width': WIDTHS[s.width].value,
    } as Record<string, string>;
}
