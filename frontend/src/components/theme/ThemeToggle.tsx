"use client";

import { useSyncExternalStore } from "react";

import { MoonIcon, SunIcon } from "@/components/ui/Icons";

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "recommend-me-anime-theme";
const THEME_CHANGE_EVENT = "recommendmeanime:theme-change";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "dark" ? "#080a12" : "#f7f7f9",
  );
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
}

function getThemeSnapshot(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, () => "dark");

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    applyTheme(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  const nextTheme = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      className="inline-flex size-10 items-center justify-center rounded-control border border-line bg-surface/70 text-ink-muted transition-[color,background-color,border-color] duration-200 hover:border-line-strong hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
    >
      {theme === "light" ? <MoonIcon className="size-4.5" /> : <SunIcon className="size-4.5" />}
    </button>
  );
}
