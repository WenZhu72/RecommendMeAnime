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
  colorScheme: "dark",
  themeColor: "#080a12",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
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
