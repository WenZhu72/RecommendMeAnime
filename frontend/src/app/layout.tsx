import type { Metadata } from "next";

import { Footer } from "@/components/layout/Footer";
import { NavBar } from "@/components/layout/NavBar";
import { WatchlistProvider } from "@/hooks/useWatchlist";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RecommendMeAnime", template: "%s | RecommendMeAnime" },
  description: "Browse anime, search the AniList catalogue, and keep a watchlist in this browser.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="h-full antialiased"><body className="min-h-full bg-slate-950 text-slate-100"><WatchlistProvider><NavBar /><main className="flex-1">{children}</main><Footer /></WatchlistProvider></body></html>;
}
