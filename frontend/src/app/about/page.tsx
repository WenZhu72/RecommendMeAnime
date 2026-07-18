import type { Metadata } from "next";

import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "About",
  description: "Learn how RecommendMeAnime helps you choose what to watch.",
};

const principles = [
  {
    number: "01",
    title: "Explore",
    description: "Search and filter the AniList catalogue through a clean, backend-first browsing experience.",
  },
  {
    number: "02",
    title: "Refine",
    description: "Shape recommendations using the details that matter: genre, format, length, era, and score.",
  },
  {
    number: "03",
    title: "Remember",
    description: "Keep a lightweight watchlist on your device without creating an account or sharing personal data.",
  },
];

export default function AboutPage() {
  return (
    <Container className="py-11 sm:py-16">
      <PageHeader
        eyebrow="About the product"
        title="Anime discovery, designed to feel focused."
        description="RecommendMeAnime brings search, catalogue browsing, recommendations, and a local watchlist into one coherent experience."
      />

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {principles.map((principle) => (
          <section key={principle.number} className="rounded-panel border border-line bg-surface/65 p-6 shadow-card sm:p-7">
            <p className="text-xs font-semibold tracking-[0.16em] text-brand-soft">{principle.number}</p>
            <h2 className="mt-5 text-xl font-semibold tracking-[-0.025em] text-ink">{principle.title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{principle.description}</p>
          </section>
        ))}
      </div>

      <section className="feature-wash mt-12 grid gap-8 rounded-panel border border-line p-7 shadow-panel sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-soft">Built as a full-stack product</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-ink sm:text-3xl">Next.js in front. FastAPI at the boundary.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-muted sm:text-base">
            The browser never calls AniList directly. Requests pass through a typed FastAPI API that validates input, handles upstream failures, caches safe responses, and returns a stable contract to the frontend.
          </p>
        </div>
        <ButtonLink href="/recommend" size="lg">
          Find your next anime
          <ArrowRightIcon className="size-4" />
        </ButtonLink>
      </section>
    </Container>
  );
}
