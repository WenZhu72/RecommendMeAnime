"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { MenuIcon, SearchIcon, XIcon } from "@/components/ui/Icons";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  createNavScrollTracker,
  getNavScrollHiddenState,
  resetNavScrollTracker,
} from "@/lib/nav-scroll-logic";
import { cn } from "@/lib/utils";
import { Container } from "./Container";

const links = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/recommend", label: "Recommendations" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/about", label: "About" },
];

const TOP_LOCK_PX = 72;
const SCROLL_THRESHOLD_PX = 12;

function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavBar() {
  const pathname = usePathname();
  const lastInputWasPointer = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [hasKeyboardFocus, setHasKeyboardFocus] = useState(false);

  useEffect(() => {
    function markPointerInput() {
      lastInputWasPointer.current = true;
    }

    function markKeyboardInput() {
      lastInputWasPointer.current = false;
    }

    document.addEventListener("pointerdown", markPointerInput, { capture: true, passive: true });
    document.addEventListener("keydown", markKeyboardInput, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", markPointerInput, { capture: true });
      document.removeEventListener("keydown", markKeyboardInput, { capture: true });
    };
  }, []);

  useEffect(() => {
    const scrollTracker = createNavScrollTracker(window.scrollY);

    function onScroll() {
      const currentScroll = Math.max(window.scrollY, 0);

      if (currentScroll <= TOP_LOCK_PX || isOpen || hasKeyboardFocus) {
        setIsHidden(false);
        resetNavScrollTracker(scrollTracker, currentScroll);
        return;
      }

      const nextHiddenState = getNavScrollHiddenState(scrollTracker, currentScroll, SCROLL_THRESHOLD_PX);
      if (nextHiddenState !== null) setIsHidden(nextHiddenState);
    }

    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, [hasKeyboardFocus, isOpen]);

  function closeMenu() {
    setIsOpen(false);
    setIsHidden(false);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-line/80 bg-canvas/88 backdrop-blur-xl",
        "transition-transform duration-300 ease-product will-change-transform",
        isHidden && "-translate-y-full",
      )}
      onFocusCapture={(event) => {
        const isKeyboardFocus =
          !lastInputWasPointer.current && event.target instanceof Element && event.target.matches(":focus-visible");
        setHasKeyboardFocus(isKeyboardFocus);
        setIsHidden(false);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHasKeyboardFocus(false);
      }}
      onKeyDown={(event) => {
        setHasKeyboardFocus(true);
        setIsHidden(false);
        if (event.key === "Escape" && isOpen) closeMenu();
      }}
    >
      <Container className="flex min-h-nav items-center justify-between gap-4">
        <Link
          href="/"
          className="shrink-0 rounded-md text-[0.9375rem] font-semibold tracking-[-0.03em] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft sm:text-base"
          onClick={closeMenu}
        >
          Recommend<span className="text-brand-soft">Me</span>Anime
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary navigation">
          {links.map((link) => {
            const active = isActivePath(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft",
                  active
                    ? "bg-ink/[0.065] text-ink"
                    : "text-ink-muted hover:bg-ink/[0.04] hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/browse"
            aria-label="Search anime"
            onClick={closeMenu}
            className="inline-flex size-10 items-center justify-center rounded-control border border-line bg-surface/70 text-ink-muted transition-[color,background-color,border-color] duration-200 hover:border-line-strong hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
          >
            <SearchIcon className="size-4.5" />
          </Link>
          <ThemeToggle />
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls="mobile-navigation"
            onClick={() => {
              setIsOpen((open) => !open);
              setIsHidden(false);
            }}
            className="inline-flex size-10 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-ink/[0.05] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft lg:hidden"
          >
            <span className="sr-only">{isOpen ? "Close navigation menu" : "Open navigation menu"}</span>
            {isOpen ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
          </button>
        </div>
      </Container>

      <div
        id="mobile-navigation"
        className={cn(
          "grid overflow-hidden border-line bg-canvas/98 shadow-panel transition-[grid-template-rows,border-color] duration-300 ease-product lg:hidden",
          isOpen ? "grid-rows-[1fr] border-t" : "grid-rows-[0fr] border-transparent",
        )}
        aria-hidden={!isOpen}
      >
        <nav className="min-h-0 overflow-hidden" aria-label="Mobile navigation">
          <Container className="grid gap-1 py-3 sm:grid-cols-2">
            {links.map((link) => {
              const active = isActivePath(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  tabIndex={isOpen ? undefined : -1}
                  aria-current={active ? "page" : undefined}
                  onClick={closeMenu}
                  className={cn(
                    "rounded-control px-3.5 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft",
                    active ? "bg-brand/10 text-brand-soft" : "text-ink-muted hover:bg-ink/[0.05] hover:text-ink",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </Container>
        </nav>
      </div>
    </header>
  );
}
