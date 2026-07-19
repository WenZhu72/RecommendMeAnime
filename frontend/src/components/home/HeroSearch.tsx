"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { SearchIcon } from "@/components/ui/Icons";
import { buildBrowseSearchLocation } from "@/lib/browse-path";
import { cn } from "@/lib/utils";

type HeroSearchProps = {
  className?: string;
};

export function HeroSearch({ className }: HeroSearchProps) {
  const router = useRouter();
  const inputId = useId();
  const [query, setQuery] = useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(buildBrowseSearchLocation(query));
  }

  return (
    <form onSubmit={onSubmit} className={className} role="search">
      <label className="sr-only" htmlFor={inputId}>Search anime by title</label>
      <div
        className={cn(
          "group flex min-h-15 items-center rounded-[1.125rem] border border-line/80 bg-surface/65 p-1.5",
          "shadow-[0_20px_55px_-28px_rgb(0_0_0_/_0.9)] backdrop-blur-xl",
          "transition-[transform,border-color,background-color,box-shadow] duration-300 ease-product",
          "hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface/80 hover:shadow-[0_24px_65px_-28px_rgb(0_0_0_/_0.95)]",
          "focus-within:-translate-y-0.5 focus-within:border-brand/55 focus-within:bg-surface/90",
          "focus-within:shadow-[0_0_0_3px_rgb(139_92_246_/_0.12),0_24px_65px_-28px_rgb(0_0_0_/_0.95)]",
        )}
      >
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-faint transition-colors group-focus-within:text-brand-soft" />
          <input
            id={inputId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search any anime"
            autoComplete="off"
            className="h-12 w-full rounded-xl bg-transparent pl-11 pr-3 text-sm text-ink outline-none placeholder:text-ink-faint sm:text-[0.9375rem]"
          />
        </div>
        <button
          type="submit"
          className={cn(
            "inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-on-brand",
            "shadow-[0_12px_30px_-15px_rgb(139_92_246_/_0.85)] transition-[transform,background-color,box-shadow] duration-200 ease-product",
            "hover:-translate-y-0.5 hover:bg-brand-strong hover:shadow-[0_16px_36px_-15px_rgb(139_92_246_/_0.95)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          )}
        >
          Search
        </button>
      </div>
    </form>
  );
}
