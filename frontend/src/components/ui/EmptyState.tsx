import Link from "next/link";

type EmptyStateProps = { title: string; description: string; actionHref?: string; actionLabel?: string };

export function EmptyState({ title, description, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <section className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">{description}</p>
      {actionHref && actionLabel && <Link href={actionHref} className="mt-5 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">{actionLabel}</Link>}
    </section>
  );
}
