"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

type ToastKind = "success" | "error";
type ToastItem = { id: number; kind: ToastKind; message: string };
type ToastApi = { success: (message: string) => void; error: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

// Errors stay up a little longer since they usually need reading
const DURATION_MS: Record<ToastKind, number> = { success: 3500, error: 6000 };

// In-page replacement for window.alert(): `toast.success('บันทึกแล้ว')` / `toast.error(data.error)`.
// Toasts don't block, so code after the call runs straight away (unlike alert()).
export function useToast(): ToastApi {
    const api = useContext(ToastContext);
    if (!api) throw new Error("useToast must be used inside <ToastProvider>");
    return api;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const nextId = useRef(0);

    const dismiss = useCallback((id: number) => {
        setToasts((current) => current.filter((t) => t.id !== id));
    }, []);

    const show = useCallback((kind: ToastKind, message: string) => {
        const id = nextId.current++;
        // Keep at most 3 on screen; the oldest goes first
        setToasts((current) => [...current.slice(-2), { id, kind, message }]);
        setTimeout(() => dismiss(id), DURATION_MS[kind]);
    }, [dismiss]);

    const api = useMemo<ToastApi>(() => ({
        success: (message) => show("success", message),
        error: (message) => show("error", message),
    }), [show]);

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className="fixed z-[110] top-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-96 flex flex-col gap-2 pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        role={toast.kind === "error" ? "alert" : "status"}
                        className={`pointer-events-auto flex items-start gap-3 rounded-xl shadow-lg border p-4 bg-white dark:bg-gray-800 ${toast.kind === "error"
                            ? "border-red-200 dark:border-red-900/50"
                            : "border-green-200 dark:border-green-900/50"
                            }`}
                    >
                        {toast.kind === "error"
                            ? <XCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            : <CheckCircle className="w-5 h-5 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />}
                        <p className="flex-1 text-sm text-gray-800 dark:text-gray-100 whitespace-pre-line">{toast.message}</p>
                        <button
                            onClick={() => dismiss(toast.id)}
                            className="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            aria-label="ปิด"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
