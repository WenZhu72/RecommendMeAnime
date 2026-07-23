import { Container } from "@/components/layout/Container";
import { AnimeGridSkeleton } from "@/components/search/AnimeGridSkeleton";

export default function Loading() {
  return (
    <Container className="py-12 sm:py-16">
      <div className="mb-10 space-y-3" aria-hidden="true">
        <div className="h-3 w-28 animate-pulse-soft rounded bg-surface-raised" />
        <div className="h-10 w-full max-w-xl animate-pulse-soft rounded-lg bg-surface-raised" />
        <div className="h-4 w-full max-w-md animate-pulse-soft rounded bg-surface-raised" />
      </div>
      <AnimeGridSkeleton label="Loading anime" />
    </Container>
  );
}
