import type { Metadata } from "next";

import { Container } from "@/components/layout/Container";
import { RecommendationResults } from "@/components/recommendation/RecommendationResults";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Your recommendations",
  description: "Anime selected from your viewing preferences.",
};

export default function RecommendationResultsPage() {
  return (
    <Container className="py-11 sm:py-16">
      <PageHeader
        eyebrow="Your shortlist"
        title="Titles shaped around your preferences."
        description="Refresh the selection for another mix, or adjust your choices to change the direction."
      />
      <div className="mt-9 sm:mt-11"><RecommendationResults /></div>
    </Container>
  );
}
