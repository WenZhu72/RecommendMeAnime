import Link from "next/link";
import { Container } from "@/components/layout/Container";

export default function NotFound() { return <Container className="py-20"><section className="mx-auto max-w-lg text-center"><p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">404</p><h1 className="mt-2 text-3xl font-bold text-white">Anime not found</h1><p className="mt-3 text-slate-400">The title may have been removed or the link is not valid.</p><Link href="/browse" className="mt-6 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">Browse anime</Link></section></Container>; }
