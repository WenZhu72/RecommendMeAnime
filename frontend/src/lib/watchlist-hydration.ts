/**
 * React uses the server snapshot for both SSR and the browser's hydration
 * render, then reads the browser snapshot immediately after hydration. This
 * consumer-local store is intentionally immutable: it exists only to provide
 * that safe transition for client state owned by a provider above streamed
 * Suspense boundaries.
 */
export function subscribeToBrowserHydration(): () => void {
  return () => undefined;
}

export function getBrowserHydrationSnapshot(): true {
  return true;
}

export function getServerHydrationSnapshot(): false {
  return false;
}

const EMPTY_ITEMS: never[] = [];

export function selectHydrationSafeWatchlistState<T>(
  items: T[],
  providerHydrated: boolean,
  consumerHydrated: boolean,
): { items: T[]; isHydrated: boolean } {
  const isHydrated = providerHydrated && consumerHydrated;
  return {
    items: isHydrated ? items : EMPTY_ITEMS,
    isHydrated,
  };
}
