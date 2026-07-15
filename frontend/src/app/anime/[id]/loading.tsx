import { Container } from "@/components/layout/Container";

export default function AnimeDetailsLoading() {
  return <Container className="py-10 sm:py-14"><p className="mb-5 text-sm text-slate-400">Loading anime details...</p><div className="h-[30rem] animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" /></Container>;
}
