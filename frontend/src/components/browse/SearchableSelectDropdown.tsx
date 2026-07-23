"use client";

import { useEffect, useMemo, useState } from "react";
import type { HTMLAttributes } from "react";

import {
  BrowseDropdownPanel,
  BrowseDropdownTrigger,
  browseDropdownOptionClasses,
  browseDropdownSelectedOptionClasses,
  useBrowseDropdown,
} from "@/components/browse/FilterDropdown";
import { SearchIcon } from "@/components/ui/Icons";
import { Input } from "@/components/ui/Input";

type SearchableSelectDropdownCommonProps = {
  ariaLabel?: string;
  disabled?: boolean;
  emptyMessage: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  label: string;
  normalizeQuery?: (query: string) => string;
  options: readonly string[];
  pluralLabel: string;
  searchAriaLabel: string;
  searchPlaceholder: string;
};

type SearchableSelectDropdownProps = SearchableSelectDropdownCommonProps & (
  | {
      selectionMode: "multiple";
      selected: string[];
      onChange: (values: string[]) => void;
    }
  | {
      selectionMode: "single";
      selected: string;
      onChange: (value: string) => void;
    }
);

export function SearchableSelectDropdown(props: SearchableSelectDropdownProps) {
  const {
    ariaLabel,
    disabled = false,
    emptyMessage,
    inputMode,
    label,
    normalizeQuery = (value) => value,
    options,
    pluralLabel,
    searchAriaLabel,
    searchPlaceholder,
  } = props;
  const {
    closeDropdown,
    open,
    openDropdown,
    panelId,
    rootRef,
    triggerId,
    triggerRef,
  } = useBrowseDropdown();
  const selectedValues = props.selectionMode === "multiple"
    ? props.selected
    : props.selected ? [props.selected] : [];
  const selectedKey = JSON.stringify(selectedValues);
  const [query, setQuery] = useState("");
  const [draftState, setDraftState] = useState(() => ({
    selectedKey,
    values: selectedValues,
  }));
  if (draftState.selectedKey !== selectedKey) {
    setDraftState({ selectedKey, values: selectedValues });
  }
  const draft = draftState.values;

  useEffect(() => {
    if (open) {
      rootRef.current
        ?.querySelector<HTMLInputElement>("[data-searchable-select-search]")
        ?.focus();
    }
  }, [open, rootRef]);

  useEffect(() => {
    if (disabled && open) closeDropdown();
  }, [closeDropdown, disabled, open]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return options.filter((option) => option.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  const displayedValues = props.selectionMode === "multiple" && open ? draft : selectedValues;
  const triggerLabel = props.selectionMode === "single"
    ? props.selected || label
    : displayedValues.length ? `${label} (${displayedValues.length})` : label;

  function selectOption(option: string) {
    if (props.selectionMode === "single") {
      closeDropdown(true);
      props.onChange(option);
      return;
    }

    const nextValues = draft.includes(option)
      ? draft.filter((value) => value !== option)
      : [...draft, option];

    setDraftState({ selectedKey, values: nextValues });
    props.onChange(nextValues);
  }

  function clearOptions() {
    if (props.selectionMode === "single") {
      closeDropdown(true);
      props.onChange("");
      return;
    }

    setDraftState({ selectedKey, values: [] });
    props.onChange([]);
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <BrowseDropdownTrigger
        ref={triggerRef}
        id={triggerId}
        active={selectedValues.length > 0}
        open={open}
        disabled={disabled}
        aria-label={ariaLabel ?? triggerLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        onClick={() => {
          if (open) {
            closeDropdown();
          } else {
            setQuery("");
            setDraftState({ selectedKey, values: selectedValues });
            openDropdown();
          }
        }}
      >
        {triggerLabel}
      </BrowseDropdownTrigger>

      <BrowseDropdownPanel
        id={panelId}
        role="dialog"
        aria-labelledby={`${panelId}-title`}
        open={open}
        rootRef={rootRef}
        className="w-[min(22rem,calc(100vw-2.5rem))] p-3"
      >
        <h2 id={`${panelId}-title`} className="sr-only">
          Choose {pluralLabel}
        </h2>

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            data-searchable-select-search
            type="text"
            inputMode={inputMode}
            value={query}
            onChange={(event) => setQuery(normalizeQuery(event.target.value))}
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
            className="min-h-10 pl-9"
          />
        </div>

        <div className="mt-2 max-h-64 overflow-y-auto overscroll-contain pr-1">
          {filteredOptions.length ? filteredOptions.map((option) => {
            const checked = (props.selectionMode === "multiple" ? draft : selectedValues).includes(option);

            return (
              <label
                key={option}
                className={`${browseDropdownOptionClasses} ${checked ? browseDropdownSelectedOptionClasses : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => selectOption(option)}
                  className="size-4 rounded border-line-strong accent-brand"
                />
                <span>{option}</span>
              </label>
            );
          }) : (
            <p className="px-2.5 py-6 text-center text-sm text-ink-faint">
              {emptyMessage}
            </p>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-3">
          <button
            type="button"
            onClick={clearOptions}
            disabled={!displayedValues.length}
            className="rounded-md px-2 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:opacity-45"
          >
            Clear {pluralLabel}
          </button>
          <span className="text-xs text-ink-faint" aria-live="polite">
            {props.selectionMode === "single"
              ? props.selected || `All ${pluralLabel}`
              : draft.length ? `${draft.length} selected` : `All ${pluralLabel}`}
          </span>
        </div>
      </BrowseDropdownPanel>
    </div>
  );
}
