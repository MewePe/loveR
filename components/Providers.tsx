"use client";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ConfirmProvider } from "./ConfirmDialog";

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                <ConfirmProvider>
                    {children}
                </ConfirmProvider>
            </ThemeProvider>
        </SessionProvider>
    );
}
