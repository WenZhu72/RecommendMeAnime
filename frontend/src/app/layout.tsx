import type { Metadata, Viewport } from "next";

import { Footer } from "@/components/layout/Footer";
import { NavBar } from "@/components/layout/NavBar";
import { WatchlistProvider } from "@/hooks/useWatchlist";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RecommendMeAnime", template: "%s | RecommendMeAnime" },
  description:
    "Discover anime through the AniList catalogue, thoughtful filters, and personal recommendations.",
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: "#080a12",
};

const themeBootstrap = `
(() => {
  try {
    const saved = localStorage.getItem("recommend-me-anime-theme");
    const theme = saved === "light" || saved === "dark"
      ? saved
      : (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  } catch (_) {}
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
      data-theme="dark"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="flex min-h-full flex-col bg-canvas text-ink">
        <WatchlistProvider>
          <NavBar />
          <main className="flex-1">{children}</main>
          <Footer />
        </WatchlistProvider>
      </body>
    </html>
  );
}
