import { Container } from "@/components/layout/Container";
import { RecommendationResults } from "@/components/recommendation/RecommendationResults";

export default function RecommendationResultsPage() { return <Container className="py-10 sm:py-14"><header><p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">Your results</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Recommended for you</h1><p className="mt-3 text-slate-400">A set of anime selected from the preferences you just saved.</p></header><div className="mt-8"><RecommendationResults /></div></Container>; }
