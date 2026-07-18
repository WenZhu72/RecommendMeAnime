import type { Metadata } from "next";

import { Container } from "@/components/layout/Container";
import { RecommendationForm } from "@/components/recommendation/RecommendationForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Recommendations",
  description: "Choose viewing preferences to find anime that match them.",
};

export default function RecommendPage() {
  return (
    <Container className="py-11 sm:py-16">
      <PageHeader
        eyebrow="Personal recommendations"
        title="Tell us how you like to watch."
        description="Three short steps shape a focused list using genres, formats, release periods, and AniList scores."
        className="mx-auto text-center"
      />
      <div className="mt-10 sm:mt-12"><RecommendationForm /></div>
    </Container>
  );
}
