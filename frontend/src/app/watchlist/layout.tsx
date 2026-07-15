import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Anime saved in this browser.",
};

export default function WatchlistLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
