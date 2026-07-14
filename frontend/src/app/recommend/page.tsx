import { Container } from "@/components/layout/Container";
import { RecommendationForm } from "@/components/recommendation/RecommendationForm";

export default function RecommendPage() { return <Container className="py-10 sm:py-14"><header className="mx-auto max-w-3xl"><p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">Your taste</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Find anime for your mood</h1><p className="mt-3 text-slate-400">Answer a few questions and we’ll find a straightforward starting set of titles.</p></header><div className="mt-10"><RecommendationForm /></div></Container>; }
