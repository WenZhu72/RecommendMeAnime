import { Container } from "@/components/layout/Container";
import { LoadingCards } from "@/components/ui/LoadingCards";

export default function Loading() {
  return (
    <Container className="py-12 sm:py-16">
      <div className="mb-10 space-y-3" role="status">
        <span className="sr-only">Loading anime</span>
        <div className="h-3 w-28 animate-pulse-soft rounded bg-surface-raised" />
        <div className="h-10 w-full max-w-xl animate-pulse-soft rounded-lg bg-surface-raised" />
        <div className="h-4 w-full max-w-md animate-pulse-soft rounded bg-surface-raised" />
      </div>
      <LoadingCards />
    </Container>
  );
}
