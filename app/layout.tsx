import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "SABLE — Your chemistry lab companion",
  description: "Bring your lab handout, hear a briefing, and talk through your questions with SABLE.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Nunito:wght@400;600;700&display=swap" />
  </head><body>{children}<Toaster richColors position="top-center" /></body></html>;
}
