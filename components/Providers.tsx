"use client";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ConfirmProvider } from "./ConfirmDialog";
import { ToastProvider } from "./Toast";

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                <ConfirmProvider>
                    <ToastProvider>
                        {children}
                    </ToastProvider>
                </ConfirmProvider>
            </ThemeProvider>
        </SessionProvider>
    );
}
