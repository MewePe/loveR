"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";

type ConfirmOptions = {
    confirmText?: string;
    cancelText?: string;
    danger?: boolean; // red confirm button for destructive actions
};

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// In-page replacement for window.confirm(): `if (!(await confirm('...'))) return;`
export function useConfirm(): ConfirmFn {
    const fn = useContext(ConfirmContext);
    if (!fn) throw new Error("useConfirm must be used inside <ConfirmProvider>");
    return fn;
}

type PendingConfirm = { message: string; options: ConfirmOptions; resolve: (ok: boolean) => void };

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [pending, setPending] = useState<PendingConfirm | null>(null);
    const confirmButton = useRef<HTMLButtonElement>(null);

    const confirm = useCallback<ConfirmFn>((message, options = {}) => {
        return new Promise<boolean>((resolve) => setPending({ message, options, resolve }));
    }, []);

    const close = useCallback((ok: boolean) => {
        setPending((current) => {
            current?.resolve(ok);
            return null;
        });
    }, []);

    useEffect(() => {
        if (!pending) return;
        confirmButton.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [pending, close]);

    const danger = pending?.options.danger;

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {pending && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => close(false)}>
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="confirm-message"
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3 mb-6">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${danger ? "bg-red-100 dark:bg-red-900/30" : "bg-indigo-100 dark:bg-indigo-900/30"}`}>
                                {danger ? <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" /> : <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
                            </div>
                            <p id="confirm-message" className="text-gray-800 dark:text-gray-100 pt-2 whitespace-pre-line">{pending.message}</p>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => close(false)}
                                className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                {pending.options.cancelText || "ยกเลิก"}
                            </button>
                            <button
                                ref={confirmButton}
                                onClick={() => close(true)}
                                className={`px-4 py-2 rounded-lg text-white font-medium ${danger ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
                            >
                                {pending.options.confirmText || (danger ? "ลบ" : "ยืนยัน")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}
