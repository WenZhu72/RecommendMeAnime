export function HeroCarouselSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[35rem]"
      role="status"
      aria-label="Loading recommendations"
    >
      <span className="sr-only">Loading recommendations</span>
      <div className="mb-4 h-3 w-44 animate-pulse-soft rounded-full bg-ink/10" aria-hidden="true" />
      <div
        className="mx-auto aspect-[2/3] w-[min(70vw,19rem)] animate-pulse-soft rounded-[1.6rem] border border-line bg-surface-raised shadow-panel"
        aria-hidden="true"
      />
    </div>
  );
}
