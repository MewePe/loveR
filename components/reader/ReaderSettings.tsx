"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { loopedFont, looplessFont } from "@/components/reader/fonts";
import {
    DEFAULT_READER_SETTINGS, FONTS, FONT_SIZES, LEADINGS, READER_SETTINGS_KEY, ReaderSettings, THEMES, WIDTHS,
    parseReaderSettings, readerCssVars,
} from "@/lib/readerSettings";

const SAVE_DELAY_MS = 600;

interface ReaderSettingsApi {
    settings: ReaderSettings;
    update: (patch: Partial<ReaderSettings>) => void;
    reset: () => void;
}
const ReaderSettingsContext = createContext<ReaderSettingsApi | null>(null);

function readLocal(): ReaderSettings | null {
    try {
        const raw = localStorage.getItem(READER_SETTINGS_KEY);
        return raw ? parseReaderSettings(raw) : null;
    } catch {
        return null;
    }
}

// Runs before the first paint (anonymous readers, or logged-in ones without saved settings) so the text doesn't
// jump from the default size to the saved one. React then takes the same values from localStorage.
function preloadScript() {
    const sizes = JSON.stringify(FONT_SIZES);
    const leadings = JSON.stringify(Object.fromEntries(Object.entries(LEADINGS).map(([k, v]) => [k, v.value])));
    const widths = JSON.stringify(Object.fromEntries(Object.entries(WIDTHS).map(([k, v]) => [k, v.value])));
    return `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(READER_SETTINGS_KEY)})||"null");if(!s)return;
var el=document.currentScript.parentElement,z=${sizes},l=${leadings},w=${widths};
if(z[s.size])el.style.setProperty("--reader-size",z[s.size]+"px");if(l[s.leading])el.style.setProperty("--reader-leading",l[s.leading]);
if(w[s.width])el.style.setProperty("--reader-width",w[s.width]);if(s.font==="loopless"||s.font==="looped")el.setAttribute("data-reader-font",s.font);
if(s.theme==="sepia")el.setAttribute("data-reader-theme","sepia");}catch(e){}})();`;
}

// Wraps the novel reader page. `initial` = the logged-in user's saved settings (null: use the browser's).
// "มืด" is the site's dark mode (next-themes): picking it switches the site theme, and the 🌙 button next to the
// panel switches the setting. White and sepia use the light site theme; sepia is styled in globals.css.
export function ReaderSettingsProvider({ initial, loggedIn, className = "", children }: {
    initial: ReaderSettings | null; loggedIn: boolean; className?: string; children: React.ReactNode;
}) {
    const [settings, setSettings] = useState<ReaderSettings>(initial ?? DEFAULT_READER_SETTINGS);
    const saved = useRef(!!initial); // the reader chose these (as opposed to the untouched defaults)
    const applying = useRef<string | null>(null); // site theme we just asked next-themes for
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { resolvedTheme, setTheme } = useTheme();

    const persist = useCallback((next: ReaderSettings) => {
        try { localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
        if (!loggedIn) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            fetch("/api/reader-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next), credentials: "include" })
                .catch((e) => console.error("Failed to save reader settings:", e));
        }, SAVE_DELAY_MS);
    }, [loggedIn]);

    const applySiteTheme = useCallback((theme: ReaderSettings["theme"]) => {
        const site = theme === "dark" ? "dark" : "light";
        applying.current = site;
        setTheme(site);
    }, [setTheme]);

    // Load once: the account's settings, else this browser's. Saved settings also set the site theme.
    useEffect(() => {
        const s = initial ?? readLocal();
        if (!s) return;
        saved.current = true;
        setSettings(s);
        if (initial) {
            try { localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(initial)); } catch { /* private mode */ }
        }
        applySiteTheme(s.theme);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
    }, []);

    // The 🌙 button (or another tab) changed the site theme: follow it
    useEffect(() => {
        if (!resolvedTheme) return;
        if (applying.current) {
            if (resolvedTheme !== applying.current) return; // still switching
            applying.current = null;
        }
        setSettings((s) => {
            const theme: ReaderSettings["theme"] = resolvedTheme === "dark" ? "dark" : s.theme === "dark" ? "white" : s.theme;
            if (theme === s.theme) return s;
            const next: ReaderSettings = { ...s, theme };
            if (saved.current) persist(next);
            return next;
        });
    }, [resolvedTheme, persist]);

    const update = useCallback((patch: Partial<ReaderSettings>) => {
        setSettings((s) => {
            const next = { ...s, ...patch };
            saved.current = true;
            persist(next);
            return next;
        });
        if (patch.theme) applySiteTheme(patch.theme);
    }, [persist, applySiteTheme]);

    const reset = useCallback(() => {
        saved.current = false;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        try { localStorage.removeItem(READER_SETTINGS_KEY); } catch { /* private mode */ }
        if (loggedIn) fetch("/api/reader-settings", { method: "DELETE", credentials: "include" }).catch((e) => console.error(e));
        // Back to the default look; the site theme is left as it is
        setSettings({ ...DEFAULT_READER_SETTINGS, theme: resolvedTheme === "dark" ? "dark" : "white" });
    }, [loggedIn, resolvedTheme]);

    return (
        <ReaderSettingsContext.Provider value={{ settings, update, reset }}>
            <div
                className={`reader-root ${loopedFont.variable} ${looplessFont.variable} ${className}`}
                data-reader-theme={settings.theme === "sepia" ? "sepia" : "default"}
                data-reader-font={settings.font}
                style={readerCssVars(settings)}
                suppressHydrationWarning
            >
                {!initial && <script dangerouslySetInnerHTML={{ __html: preloadScript() }} />}
                {children}
            </div>
        </ReaderSettingsContext.Provider>
    );
}

function useReaderSettings() {
    const api = useContext(ReaderSettingsContext);
    if (!api) throw new Error("useReaderSettings must be used inside <ReaderSettingsProvider>");
    return api;
}

function Segmented<K extends string>({ label, options, value, onChange, renderLabel }: {
    label: string; options: Record<K, { label: string }>; value: K; onChange: (k: K) => void;
    renderLabel?: (k: K, label: string) => React.ReactNode;
}) {
    return (
        <div role="radiogroup" aria-label={label} className="grid gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-900" style={{ gridTemplateColumns: `repeat(${Object.keys(options).length}, minmax(0, 1fr))` }}>
            {(Object.keys(options) as K[]).map((k) => (
                <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={value === k}
                    onClick={() => onChange(k)}
                    className={`py-2 px-2 rounded-lg text-sm font-medium transition-colors ${value === k ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"}`}
                >
                    {renderLabel ? renderLabel(k, options[k].label) : options[k].label}
                </button>
            ))}
        </div>
    );
}

const SWATCHES: Record<ReaderSettings["theme"], string> = {
    white: "bg-white border-gray-300 text-gray-900",
    sepia: "bg-[#f4ecd8] border-[#d9c9a3] text-[#433422]",
    dark: "bg-gray-900 border-gray-600 text-gray-100",
};

// The "Aa" button in the reader top bar and its settings panel (a card under the bar on md+, a bottom sheet on
// phones). Rendered into document.body: the bar's backdrop-blur would otherwise trap the fixed panel inside it.
// No dimming backdrop, so the text behind shows each change straight away; clicking outside or Esc closes it.
export function ReaderSettingsButton() {
    const { settings, update, reset } = useReaderSettings();
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const panel = useRef<HTMLDivElement>(null);

    const close = useCallback(() => {
        setOpen(false);
        trigger.current?.focus();
    }, []);

    useEffect(() => {
        if (!open) return;
        panel.current?.focus({ preventScroll: true });
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, close]);

    const section = "space-y-2";
    const heading = "text-sm font-medium text-gray-700 dark:text-gray-300";
    const isDefault = JSON.stringify({ ...settings, theme: "white" }) === JSON.stringify(DEFAULT_READER_SETTINGS) && settings.theme !== "sepia";

    return (
        <>
            <button
                ref={trigger}
                type="button"
                onClick={() => (open ? close() : setOpen(true))}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label="ตั้งค่าการอ่าน"
                title="ตั้งค่าการอ่าน"
                className={`p-1 font-sans font-semibold transition-colors ${open ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
            >
                Aa
            </button>
            {open && createPortal(
                <div className="fixed inset-0 z-[100] font-sans">
                    <div aria-hidden="true" onClick={close} className="absolute inset-0 bg-black/20 md:bg-transparent" />
                    <div
                        ref={panel}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="reader-settings-title"
                        tabIndex={-1}
                        className="absolute outline-none bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700
                            inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]
                            md:inset-x-auto md:bottom-auto md:right-4 md:top-[8.25rem] md:w-80 md:rounded-2xl md:pb-0"
                    >
                        <div className="md:hidden flex justify-center pt-2" aria-hidden="true"><span className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" /></div>
                        <div className="flex items-center justify-between px-5 pt-3 md:pt-4 pb-2">
                            <h2 id="reader-settings-title" className="text-lg font-bold text-gray-900 dark:text-white">ตั้งค่าการอ่าน</h2>
                            <button type="button" onClick={close} className="p-2 -m-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="ปิดการตั้งค่า" title="ปิด">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-5 pb-5 space-y-5">
                            <div className={section}>
                                <p className={heading} id="rs-size">ขนาดตัวอักษร</p>
                                <div className="flex items-center gap-2" role="group" aria-labelledby="rs-size">
                                    <button type="button" onClick={() => update({ size: settings.size - 1 })} disabled={settings.size === 0} aria-label="ลดขนาดตัวอักษร" title="ลดขนาด"
                                        className="flex-1 h-11 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 flex items-center justify-center gap-0.5 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
                                        <span className="text-sm font-semibold">A</span><Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <div className="w-20 text-center" aria-live="polite">
                                        <span className="block text-xl font-bold text-gray-900 dark:text-white tabular-nums">{FONT_SIZES[settings.size]}</span>
                                        <span className="block text-[11px] text-gray-500 dark:text-gray-400">ระดับ {settings.size + 1}/{FONT_SIZES.length}</span>
                                    </div>
                                    <button type="button" onClick={() => update({ size: settings.size + 1 })} disabled={settings.size === FONT_SIZES.length - 1} aria-label="เพิ่มขนาดตัวอักษร" title="เพิ่มขนาด"
                                        className="flex-1 h-11 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 flex items-center justify-center gap-0.5 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
                                        <span className="text-lg font-semibold">A</span><Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className={section}>
                                <p className={heading}>ระยะห่างบรรทัด</p>
                                <Segmented label="ระยะห่างบรรทัด" options={LEADINGS} value={settings.leading} onChange={(leading) => update({ leading })} />
                            </div>

                            <div className={section}>
                                <p className={heading}>แบบอักษร</p>
                                <Segmented
                                    label="แบบอักษร"
                                    options={FONTS}
                                    value={settings.font}
                                    onChange={(font) => update({ font })}
                                    renderLabel={(k, label) => (
                                        <span className={`block ${k === "looped" ? loopedFont.className : looplessFont.className}`}>
                                            <span className="block text-base leading-tight">กขค</span>
                                            <span className="block text-xs">{label}</span>
                                        </span>
                                    )}
                                />
                            </div>

                            <div className={section}>
                                <p className={heading}>สีพื้นหลัง</p>
                                <div role="radiogroup" aria-label="สีพื้นหลัง" className="grid grid-cols-3 gap-2">
                                    {(Object.keys(THEMES) as ReaderSettings["theme"][]).map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            role="radio"
                                            aria-checked={settings.theme === t}
                                            onClick={() => update({ theme: t })}
                                            className={`h-12 rounded-xl border-2 text-sm font-medium transition ${SWATCHES[t]} ${settings.theme === t ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-800" : ""}`}
                                        >
                                            {THEMES[t].label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Phones show the text full width anyway */}
                            <div className={`${section} hidden md:block`}>
                                <p className={heading}>ความกว้างของข้อความ</p>
                                <Segmented label="ความกว้างของข้อความ" options={WIDTHS} value={settings.width} onChange={(width) => update({ width })} />
                            </div>

                            <button
                                type="button"
                                onClick={reset}
                                disabled={isDefault}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <RotateCcw className="w-4 h-4" />รีเซ็ตเป็นค่าเริ่มต้น
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
