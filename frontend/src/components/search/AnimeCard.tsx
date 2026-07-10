import { Anime } from "@/types/anime";

type AnimeCardProps = {
  anime: Anime;
};

export function AnimeCard({ anime }: AnimeCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg">
      {anime.coverImage && (
        <img
          src={anime.coverImage}
          alt={anime.title}
          className="mb-4 h-72 w-full rounded-xl object-cover"
        />
      )}

      <h3 className="text-lg font-semibold text-white">{anime.title}</h3>

      {anime.averageScore && (
        <p className="mt-1 text-sm text-slate-300">
          Score: {anime.averageScore}/100
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {anime.genres.slice(0, 3).map((genre) => (
          <span
            key={genre}
            className="rounded-full bg-purple-500/20 px-3 py-1 text-xs text-purple-200"
          >
            {genre}
          </span>
        ))}
      </div>
    </article>
  );
}