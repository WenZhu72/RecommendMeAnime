"use client";

import { useEffect, useState } from "react";

import {
  BrowseDropdownPanel,
  BrowseDropdownTrigger,
  browseDropdownOptionClasses,
  browseDropdownSelectedOptionClasses,
  useBrowseDropdown,
} from "@/components/browse/FilterDropdown";
import { SearchIcon } from "@/components/ui/Icons";
import { Input } from "@/components/ui/Input";
import { ANIME_GENRES } from "@/config/catalogue";

type GenreDropdownProps = {
  selected: string[];
  onChange: (genres: string[]) => void;
  disabled?: boolean;
};

export function GenreDropdown({ selected, onChange, disabled = false }: GenreDropdownProps) {
  const {
    closeDropdown,
    open,
    openDropdown,
    panelId,
    rootRef,
    triggerId,
    triggerRef,
  } = useBrowseDropdown();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(selected);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLInputElement>("[data-genre-search]")?.focus();
  }, [open, rootRef]);

  useEffect(() => {
    if (disabled && open) closeDropdown();
  }, [closeDropdown, disabled, open]);

  const filtered = ANIME_GENRES.filter((genre) => genre.toLowerCase().includes(query.trim().toLowerCase()));
  const visibleSelection = open ? draft : selected;
  const label = visibleSelection.length ? `Genre (${visibleSelection.length})` : "Genre";

  function toggleGenre(genre: string) {
    const nextGenres = draft.includes(genre)
      ? draft.filter((item) => item !== genre)
      : [...draft, genre];
    setDraft(nextGenres);
    onChange(nextGenres);
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <BrowseDropdownTrigger
        ref={triggerRef}
        id={triggerId}
        active={selected.length > 0}
        open={open}
        disabled={disabled}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        onClick={() => {
          if (open) {
            closeDropdown();
          } else {
            setQuery("");
            setDraft(selected);
            openDropdown();
          }
        }}
      >
        {label}
      </BrowseDropdownTrigger>

      <BrowseDropdownPanel
        id={panelId}
        role="dialog"
        aria-labelledby={`${panelId}-title`}
        open={open}
        rootRef={rootRef}
        className="w-[min(22rem,calc(100vw-2.5rem))] p-3"
      >
        <h2 id={`${panelId}-title`} className="sr-only">Choose genres</h2>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            data-genre-search
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
                className={`${browseDropdownOptionClasses} ${checked ? browseDropdownSelectedOptionClasses : ""}`}
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
            onClick={() => {
              setDraft([]);
              onChange([]);
            }}
            disabled={!draft.length}
            className="rounded-md px-2 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:opacity-45"
          >
            Clear genres
          </button>
          <span className="text-xs text-ink-faint" aria-live="polite">
            {draft.length ? `${draft.length} selected` : "All genres"}
          </span>
        </div>
      </BrowseDropdownPanel>
    </div>
  );
}
