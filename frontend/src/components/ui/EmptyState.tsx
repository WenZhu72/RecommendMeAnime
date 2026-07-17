import { ButtonLink } from "@/components/ui/Button";

type EmptyStateProps = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export function EmptyState({ title, description, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <section className="rounded-panel border border-dashed border-line-strong bg-surface/45 px-6 py-14 text-center shadow-card sm:py-16">
      <div className="mx-auto flex size-11 items-center justify-center rounded-full border border-brand/20 bg-brand/10 text-lg text-brand-soft">
        <span aria-hidden="true">&#10022;</span>
      </div>
      <h2 className="mt-5 text-lg font-semibold tracking-tight text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-ink-muted">{description}</p>
      {actionHref && actionLabel && (
        <ButtonLink href={actionHref} className="mt-6">
          {actionLabel}
        </ButtonLink>
      )}
    </section>
  );
}
