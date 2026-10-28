import { Noto_Sans_Thai, Sarabun } from "next/font/google";

// Reader fonts that support Thai: Sarabun has looped letters ("มีหัว"), Noto Sans Thai is loopless ("ไม่มีหัว").
// Only the novel reader uses them; globals.css picks one through --font-reader-looped / --font-reader-loopless.
export const loopedFont = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "700"], display: "swap", variable: "--font-reader-looped" });
export const looplessFont = Noto_Sans_Thai({ subsets: ["thai", "latin"], display: "swap", variable: "--font-reader-loopless" });
