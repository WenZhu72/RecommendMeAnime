export function ErrorMessage({ message = "Anime cannot be loaded right now. Please try again." }: { message?: string }) {
  return <div role="alert" className="rounded-xl border border-red-900/70 bg-red-950/30 px-5 py-4 text-sm text-red-200">{message}</div>;
}
