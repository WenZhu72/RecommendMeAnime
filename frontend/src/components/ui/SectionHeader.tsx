import Link from "next/link";

type SectionHeaderProps = {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
};

export function SectionHeader({
  title,
  description,
  href,
  linkLabel = "View all",
}: SectionHeaderProps) {
  return (
    <div className="mb-6 flex items-end justify-between gap-5 sm:mb-7">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.025em] text-ink sm:text-2xl">{title}</h2>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-muted">{description}</p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-md text-sm font-semibold text-brand-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
        >
          {linkLabel}
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
            &rarr;
          </span>
        </Link>
      )}
    </div>
  );
}
