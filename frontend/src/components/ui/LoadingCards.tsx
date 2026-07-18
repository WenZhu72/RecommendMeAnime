export function LoadingCards({ count = 10 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-4 xl:grid-cols-5"
      aria-label="Loading anime titles"
      aria-busy="true"
      role="status"
    >
      <span className="sr-only">Loading anime titles</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-card border border-line/70 bg-surface/60">
          <div className="aspect-[2/3] animate-pulse-soft bg-surface-raised" />
          <div className="space-y-3 p-3.5">
            <div className="h-4 w-4/5 animate-pulse-soft rounded bg-surface-raised" />
            <div className="h-3 w-3/5 animate-pulse-soft rounded bg-surface-raised" />
          </div>
        </div>
      ))}
    </div>
  );
}
