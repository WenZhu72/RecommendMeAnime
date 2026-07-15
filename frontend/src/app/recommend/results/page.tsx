import { Container } from "@/components/layout/Container";
import type { Metadata } from "next";
import { RecommendationResults } from "@/components/recommendation/RecommendationResults";

export const metadata: Metadata = { title: "Your recommendations", description: "Anime selected from your viewing preferences." };

export default function RecommendationResultsPage() {
  return <Container className="py-10 sm:py-14"><header><p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">Recommendations</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Titles that match your preferences</h1><p className="mt-3 text-slate-400">These results reflect the choices you made on the previous page.</p></header><div className="mt-8"><RecommendationResults /></div></Container>;
}
