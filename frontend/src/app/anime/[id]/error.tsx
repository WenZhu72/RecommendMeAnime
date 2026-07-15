"use client";

import { useEffect } from "react";

import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

export default function AnimeDetailsError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => { console.error(error); }, [error]);

  return <Container className="py-20"><section className="mx-auto max-w-lg text-center"><h1 className="text-2xl font-bold text-white">This anime cannot be loaded right now</h1><p className="mt-3 text-slate-400">The anime service is temporarily unavailable. Please try again shortly.</p><Button className="mt-6" onClick={reset}>Try again</Button></section></Container>;
}
