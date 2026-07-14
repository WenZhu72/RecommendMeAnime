"use client";

import { useRouter, useSearchParams } from "next/navigation";

const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Thriller"];

export function BrowseFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedGenre = searchParams.get("genre") ?? "";
  function updateGenre(genre: string) { router.push(genre ? `/browse?genre=${encodeURIComponent(genre)}` : "/browse"); }
  return <div className="flex flex-wrap gap-2" aria-label="Browse by genre"><button type="button" onClick={() => updateGenre("")} className={`rounded-full px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${!selectedGenre ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>All</button>{GENRES.map((genre) => <button type="button" key={genre} onClick={() => updateGenre(genre)} className={`rounded-full px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${selectedGenre === genre ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>{genre}</button>)}</div>;
}
