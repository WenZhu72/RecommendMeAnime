"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type SearchBarProps = { initialQuery?: string; className?: string };
type SearchFormProps = { initialQuery: string; className?: string };

export function SearchBar({ initialQuery = "", className }: SearchBarProps) {
  return <SearchForm key={initialQuery} initialQuery={initialQuery} className={className} />;
}

function SearchForm({ initialQuery, className }: SearchFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  function onSubmit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const search = query.trim(); router.push(search ? `/search?q=${encodeURIComponent(search)}` : "/search"); }
  return <form onSubmit={onSubmit} className={className} role="search"><label className="sr-only" htmlFor="anime-search">Search anime by title</label><div className="flex flex-col gap-2 sm:flex-row"><Input id="anime-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Naruto, One Piece, Frieren..." className="min-w-0 flex-1" /><Button type="submit">Search</Button></div></form>;
}
