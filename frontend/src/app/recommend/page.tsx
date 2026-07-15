import { Container } from "@/components/layout/Container";
import type { Metadata } from "next";
import { RecommendationForm } from "@/components/recommendation/RecommendationForm";

export const metadata: Metadata = { title: "Recommendations", description: "Choose viewing preferences to find anime that match them." };

export default function RecommendPage() {
  return <Container className="py-10 sm:py-14"><header className="mx-auto max-w-3xl"><p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">Recommendations</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Tell us what you want to watch</h1><p className="mt-3 text-slate-400">Choose the genres, formats, and release period that matter to you. We will use those preferences to find matching titles.</p></header><div className="mt-10"><RecommendationForm /></div></Container>;
}
