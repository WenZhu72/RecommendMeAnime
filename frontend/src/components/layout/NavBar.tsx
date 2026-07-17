"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { MenuIcon, SearchIcon, SparklesIcon, XIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";
import { Container } from "./Container";

const links = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/recommend", label: "Recommendations" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/about", label: "About" },
];

function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavBar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/82 backdrop-blur-xl">
      <Container className="flex min-h-18 items-center justify-between gap-5">
        <Link
          href="/"
          className="group inline-flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
          onClick={() => setIsOpen(false)}
        >
          <span className="flex size-8 items-center justify-center rounded-[0.65rem] bg-brand text-white shadow-[0_9px_24px_-12px_rgb(139_92_246_/_1)] transition-transform duration-200 ease-product group-hover:rotate-3 group-hover:scale-105">
            <SparklesIcon className="size-4.5" />
          </span>
          <span className="text-[0.9375rem] font-semibold tracking-[-0.025em] text-ink sm:text-base">
            Recommend<span className="text-brand-soft">Me</span>Anime
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary navigation">
          {links.map((link) => {
            const active = isActivePath(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft",
                  active
                    ? "bg-white/[0.065] text-ink"
                    : "text-ink-muted hover:bg-white/[0.04] hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/search"
            aria-label="Search anime"
            aria-current={pathname === "/search" ? "page" : undefined}
            className="inline-flex size-10 items-center justify-center rounded-control border border-line bg-surface/70 text-ink-muted transition-all duration-200 hover:border-line-strong hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
          >
            <SearchIcon className="size-4.5" />
          </Link>
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls="mobile-navigation"
            onClick={() => setIsOpen((open) => !open)}
            className="inline-flex size-10 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-white/[0.05] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft lg:hidden"
          >
            <span className="sr-only">{isOpen ? "Close navigation menu" : "Open navigation menu"}</span>
            {isOpen ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
          </button>
        </div>
      </Container>

      {isOpen && (
        <nav
          id="mobile-navigation"
          className="border-t border-line bg-canvas/96 shadow-panel lg:hidden"
          aria-label="Mobile navigation"
        >
          <Container className="grid gap-1 py-3 sm:grid-cols-2">
            {links.map((link) => {
              const active = isActivePath(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "rounded-control px-3.5 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft",
                    active ? "bg-brand/10 text-brand-soft" : "text-ink-muted hover:bg-white/[0.05] hover:text-ink",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </Container>
        </nav>
      )}
    </header>
  );
}
