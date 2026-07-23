import { AnimeCardSkeleton } from "@/components/search/AnimeCardSkeleton";
import { animeGridClasses } from "@/components/search/anime-card-layout";

export function AnimeGridSkeleton({
  count = 10,
  label = "Loading anime titles",
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div className={animeGridClasses} aria-label={label} aria-busy="true" role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <AnimeCardSkeleton key={index} index={index} />
      ))}
    </div>
  );
}
