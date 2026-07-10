"use client";

import { useState } from "react";

import { searchAnime } from "@/lib/api";
import { Anime } from "@/types/anime";
import { AnimeCard } from "./AnimeCard";

export function AnimeSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!query.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const animeResults = await searchAnime(query);
      setResults(animeResults);
    } catch {
      setError("Something went wrong while searching. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mt-10">
      <form onSubmit={handleSearch} className="mx-auto flex max-w-2xl gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for Naruto, One Piece, Bleach..."
          className="flex-1 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />

        <button
          type="submit"
          className="rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-500"
        >
          Search
        </button>
      </form>

      {isLoading && (
        <p className="mt-6 text-center text-slate-300">Searching...</p>
      )}

      {error && <p className="mt-6 text-center text-red-400">{error}</p>}

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {results.map((anime) => (
          <AnimeCard key={anime.id} anime={anime} />
        ))}
      </div>
    </section>
  );
}