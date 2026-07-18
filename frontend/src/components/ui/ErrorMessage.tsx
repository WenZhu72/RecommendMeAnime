export function ErrorMessage({
  message = "Anime cannot be loaded right now. Please try again.",
}: {
  message?: string;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-card border border-danger/25 bg-danger/[0.07] px-5 py-4 text-sm leading-6 text-danger-ink"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-danger/15 text-xs font-bold text-danger"
      >
        !
      </span>
      {message}
    </div>
  );
}
