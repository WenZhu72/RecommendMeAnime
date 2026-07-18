import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <Container className="py-20 sm:py-28">
      <section className="mx-auto max-w-xl rounded-panel border border-line bg-surface/65 px-6 py-12 text-center shadow-panel sm:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-soft">404 · Not found</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-ink">This title is out of frame.</h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">It may no longer be available in the AniList catalogue, or the link may be incorrect.</p>
        <ButtonLink href="/browse" className="mt-7">Browse anime</ButtonLink>
      </section>
    </Container>
  );
}
