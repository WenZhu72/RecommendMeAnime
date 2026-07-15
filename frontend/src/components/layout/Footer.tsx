import Link from "next/link";

import { Container } from "./Container";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-800 bg-slate-950">
      <Container className="flex flex-col gap-3 py-7 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>Find your next anime.</p>
        <div className="flex gap-4">
          <Link className="hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400" href="/about">About</Link>
          <a className="hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400" href="https://anilist.co" target="_blank" rel="noreferrer">Data provided by AniList</a>
        </div>
      </Container>
    </footer>
  );
}
