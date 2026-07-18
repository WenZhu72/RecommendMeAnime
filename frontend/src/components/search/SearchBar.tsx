"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { SearchIcon } from "@/components/ui/Icons";
import { Input } from "@/components/ui/Input";
import { buildBrowseSearchLocation } from "@/lib/browse-path";
import { cn } from "@/lib/utils";

type SearchBarProps = { initialQuery?: string; className?: string };
type SearchFormProps = { initialQuery: string; className?: string };

export function SearchBar({ initialQuery = "", className }: SearchBarProps) {
  return <SearchForm key={initialQuery} initialQuery={initialQuery} className={className} />;
}

function SearchForm({ initialQuery, className }: SearchFormProps) {
  const router = useRouter();
  const inputId = useId();
  const [query, setQuery] = useState(initialQuery);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(buildBrowseSearchLocation(query));
  }

  return (
    <form onSubmit={onSubmit} className={className} role="search">
      <label className="sr-only" htmlFor={inputId}>Search anime by title</label>
      <div className="flex gap-2 rounded-[1rem] border border-line bg-surface/75 p-1.5 shadow-card backdrop-blur-sm transition-colors focus-within:border-brand/45">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-ink-faint" />
          <Input
            id={inputId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Naruto, One Piece, Frieren..."
            className="border-transparent bg-transparent pl-10 shadow-none hover:border-transparent focus-visible:border-transparent focus-visible:bg-transparent focus-visible:ring-0"
          />
        </div>
        <Button type="submit" className={cn("px-4 sm:px-5")}>Search</Button>
      </div>
    </form>
  );
}
