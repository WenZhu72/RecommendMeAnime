import { Container } from "@/components/layout/Container";

export default function AnimeDetailsLoading() {
  return (
    <Container className="py-10 sm:py-14" aria-label="Loading anime details" aria-busy="true">
      <div className="h-4 w-28 animate-pulse-soft rounded bg-surface-raised" />
      <div className="mt-6 overflow-hidden rounded-panel border border-line bg-surface/70 shadow-panel">
        <div className="h-48 animate-pulse-soft bg-surface-raised sm:h-72" />
        <div className="grid gap-7 p-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:p-8 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <div className="aspect-[2/3] w-32 animate-pulse-soft rounded-card bg-surface-raised sm:w-40 lg:w-48" />
          <div className="space-y-4 pt-2">
            <div className="h-3 w-24 animate-pulse-soft rounded bg-surface-raised" />
            <div className="h-10 w-4/5 animate-pulse-soft rounded-lg bg-surface-raised" />
            <div className="h-4 w-2/5 animate-pulse-soft rounded bg-surface-raised" />
            <div className="h-28 w-full animate-pulse-soft rounded-lg bg-surface-raised" />
          </div>
        </div>
      </div>
    </Container>
  );
}
