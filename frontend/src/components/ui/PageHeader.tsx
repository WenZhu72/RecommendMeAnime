import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, className }: PageHeaderProps) {
  return (
    <header className={cn("max-w-3xl", className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-soft">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-ink-muted sm:text-lg">{description}</p>
    </header>
  );
}
