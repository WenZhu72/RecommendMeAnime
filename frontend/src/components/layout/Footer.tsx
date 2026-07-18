import Link from "next/link";

import { ExternalLinkIcon } from "@/components/ui/Icons";
import { Container } from "./Container";

const footerLinks = [
  { href: "/browse", label: "Browse" },
  { href: "/recommend", label: "Recommendations" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/about", label: "About" },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line/80 bg-canvas-soft/55 sm:mt-24">
      <Container className="grid gap-8 py-10 sm:grid-cols-[1fr_auto] sm:items-end sm:py-12">
        <div>
          <Link
            href="/"
            className="inline-flex rounded-md text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
          >
            RecommendMeAnime
          </Link>
          <p className="mt-3 max-w-md text-sm leading-6 text-ink-muted">
            A focused way to explore the AniList catalogue and find something worth watching.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Footer navigation">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              className="rounded-sm text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
              href={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line pt-5 text-xs text-ink-faint sm:col-span-2 sm:flex sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} RecommendMeAnime</p>
          <a
            className="mt-2 inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft sm:mt-0"
            href="https://anilist.co"
            target="_blank"
            rel="noreferrer"
          >
            Anime data provided by AniList
            <ExternalLinkIcon className="size-3.5" />
          </a>
        </div>
      </Container>
    </footer>
  );
}
