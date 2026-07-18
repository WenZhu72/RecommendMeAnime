"use client";

import { useEffect, useId, useRef, useState } from "react";

import { ChevronDownIcon, SearchIcon } from "@/components/ui/Icons";
import { Input } from "@/components/ui/Input";
import { ANIME_GENRES } from "@/config/catalogue";
import { cn } from "@/lib/utils";

type GenreDropdownProps = {
  selected: string[];
  onApply: (genres: string[]) => void;
  disabled?: boolean;
};

export function GenreDropdown({ selected, onApply, disabled = false }: GenreDropdownProps) {
  const labelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(selected);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("mousedown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const filtered = ANIME_GENRES.filter((genre) => genre.toLowerCase().includes(query.trim().toLowerCase()));
  const label = selected.length ? `Genre (${selected.length})` : "Genre";

  function toggleGenre(genre: string) {
    setDraft((current) => current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre]);
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={`${labelId}-panel`}
        onClick={() => {
          setQuery("");
          setDraft(selected);
          setOpen((current) => !current);
        }}
        className={cn(
          "flex min-h-control w-full items-center justify-between gap-2 rounded-control border bg-canvas-soft/90 px-3.5 text-sm font-medium transition-[border-color,background-color,box-shadow] duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-55",
          open || selected.length
            ? "border-brand/45 text-ink"
            : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          id={`${labelId}-panel`}
          role="dialog"
          aria-labelledby={`${labelId}-title`}
          className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-[min(22rem,calc(100vw-2.5rem))] rounded-card border border-line bg-surface p-3 shadow-panel"
        >
          <h2 id={`${labelId}-title`} className="sr-only">Choose genres</h2>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a genre"
              aria-label="Search genres"
              className="min-h-10 pl-9"
            />
          </div>

          <div className="mt-2 max-h-64 overflow-y-auto overscroll-contain pr-1">
            {filtered.length ? filtered.map((genre) => {
              const checked = draft.includes(genre);
              return (
                <label
                  key={genre}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-ink-muted transition-colors hover:bg-ink/[0.045] hover:text-ink"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleGenre(genre)}
                    className="size-4 rounded border-line-strong accent-brand"
                  />
                  <span>{genre}</span>
                </label>
              );
            }) : (
              <p className="px-2.5 py-6 text-center text-sm text-ink-faint">No matching genres</p>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => setDraft([])}
              className="rounded-md px-2 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
              className="min-h-9 rounded-[0.625rem] bg-brand px-3.5 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
            >
              Apply genres
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
