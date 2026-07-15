"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Container } from "./Container";

const links = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/recommend", label: "Recommendations" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/about", label: "About" },
];

export function NavBar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <Container className="flex min-h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="shrink-0 text-lg font-bold tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          onClick={() => setIsOpen(false)}
        >
          Recommend<span className="text-indigo-400">Me</span>Anime
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
                pathname === link.href
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white",
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/search"
            aria-label="Search anime"
            className="ml-2 rounded-md border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-indigo-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            Search
          </Link>
        </nav>

        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="mobile-navigation"
          onClick={() => setIsOpen((open) => !open)}
          className="rounded-md p-2 text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 md:hidden"
        >
          <span className="sr-only">{isOpen ? "Close navigation menu" : "Open navigation menu"}</span>
          <span aria-hidden="true" className="text-xl">{isOpen ? "×" : "☰"}</span>
        </button>
      </Container>

      {isOpen && (
        <nav id="mobile-navigation" className="border-t border-slate-800 bg-slate-950 md:hidden" aria-label="Mobile navigation">
          <Container className="flex flex-col py-3">
            {[...links, { href: "/search", label: "Search" }].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                {link.label}
              </Link>
            ))}
          </Container>
        </nav>
      )}
    </header>
  );
}
