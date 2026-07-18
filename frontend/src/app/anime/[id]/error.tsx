"use client";

import { useEffect } from "react";

import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

export default function AnimeDetailsError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <Container className="py-20 sm:py-28">
      <section className="mx-auto max-w-xl rounded-panel border border-line bg-surface/65 px-6 py-12 text-center shadow-panel sm:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-danger">Anime service unavailable</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-ink">This anime cannot be loaded right now.</h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">The service may be waking up or temporarily unavailable. Please try again shortly.</p>
        <Button className="mt-7" onClick={reset}>Try again</Button>
      </section>
    </Container>
  );
}
