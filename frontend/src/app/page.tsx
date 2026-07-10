import { AnimeSearch } from "@/components/search/AnimeSearch";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-purple-400">
            RecommendMeAnime
          </p>

          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Find anime recommendations that actually make sense.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
            Search anime now. Later, we’ll explain why each recommendation fits
            your taste using ratings, genres, reviews, and viewing patterns.
          </p>
        </div>

        <AnimeSearch />
      </section>
    </main>
  );
}