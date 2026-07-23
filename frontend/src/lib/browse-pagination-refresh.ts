import type { AnimePageInfo } from "@/types/anime";

export const BROWSE_PAGINATION_REFRESH_RETRY_DELAY_MS = 1_500;
export const BROWSE_PAGINATION_REFRESH_MAX_ATTEMPTS = 3;

type BrowsePaginationRefreshOptions = {
  initialPageInfo: AnimePageInfo;
  requestKey: string;
  signal: AbortSignal;
  fetchPageInfo: (signal: AbortSignal) => Promise<AnimePageInfo>;
  isCurrentRequest: (requestKey: string) => boolean;
  wait?: (delayMs: number, signal: AbortSignal) => Promise<void>;
  delayMs?: number;
  maxAttempts?: number;
};

function waitForDelay(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, delayMs);
    const cancel = () => {
      window.clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener("abort", cancel, { once: true });
  });
}

/**
 * Perform a bounded follow-up for exact Browse metadata.
 *
 * A null result means the metadata stayed inexact, the request failed, or the
 * owning result set changed. Those cases intentionally leave the existing UI
 * untouched.
 */
export async function pollForExactBrowsePagination({
  initialPageInfo,
  requestKey,
  signal,
  fetchPageInfo,
  isCurrentRequest,
  wait = waitForDelay,
  delayMs = BROWSE_PAGINATION_REFRESH_RETRY_DELAY_MS,
  maxAttempts = BROWSE_PAGINATION_REFRESH_MAX_ATTEMPTS,
}: BrowsePaginationRefreshOptions): Promise<AnimePageInfo | null> {
  if (initialPageInfo.isExact) return initialPageInfo;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    // Check once as soon as the client hydrates. Only subsequent checks are
    // spaced out so the background backend probe has time to finish.
    if (attempt > 0) {
      try {
        await wait(delayMs, signal);
      } catch {
        return null;
      }
    }

    if (signal.aborted || !isCurrentRequest(requestKey)) return null;

    let refreshedPageInfo: AnimePageInfo;
    try {
      refreshedPageInfo = await fetchPageInfo(signal);
    } catch {
      // This mechanism follows up only successful inexact responses. Ordinary
      // request errors do not start another metadata-specific retry.
      return null;
    }

    if (signal.aborted || !isCurrentRequest(requestKey)) return null;
    if (refreshedPageInfo.isExact) return refreshedPageInfo;
  }

  return null;
}
