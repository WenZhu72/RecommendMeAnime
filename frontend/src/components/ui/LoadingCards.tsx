export function LoadingCards({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label="Loading anime titles" aria-busy="true">
      {Array.from({ length: count }, (_, index) => <div key={index} className="aspect-[2/3] animate-pulse rounded-xl bg-slate-800" />)}
    </div>
  );
}
