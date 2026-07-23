"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useOptimistic,
  useTransition,
  type ReactNode,
} from "react";

import {
  buildBrowseAnimePathFromLocation,
  buildBrowseParametersFromHref,
  buildBrowseRequestKeyFromHref,
  shouldNavigateBrowse,
  shouldShowBrowseFallback,
} from "@/lib/browse-path";

type BrowseNavigationContextValue = {
  getNavigationParameters: () => URLSearchParams;
  isPending: boolean;
  navigate: (href: string) => void;
  navigationParameters: URLSearchParams;
  targetRequestKey: string | null;
};

const BrowseNavigationContext = createContext<BrowseNavigationContextValue | null>(null);

export function BrowseNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [transitionPending, startTransition] = useTransition();
  const committedQuery = searchParams.toString();
  const [navigationQuery, setNavigationQuery] = useOptimistic(committedQuery);
  const currentRequestKey = useMemo(
    () => buildBrowseAnimePathFromLocation(committedQuery),
    [committedQuery],
  );
  const navigationParameters = useMemo(
    () => new URLSearchParams(navigationQuery),
    [navigationQuery],
  );
  const navigationRequestKey = useMemo(
    () => buildBrowseAnimePathFromLocation(navigationQuery),
    [navigationQuery],
  );
  const targetRequestKey = navigationRequestKey === currentRequestKey
    ? null
    : navigationRequestKey;
  const getNavigationParameters = useCallback(
    () => new URLSearchParams(navigationQuery),
    [navigationQuery],
  );

  const navigate = useCallback((href: string) => {
    const nextRequestKey = buildBrowseRequestKeyFromHref(href);
    if (!shouldNavigateBrowse(currentRequestKey, targetRequestKey, nextRequestKey)) return;

    const nextQuery = buildBrowseParametersFromHref(href).toString();
    startTransition(() => {
      setNavigationQuery(nextQuery);
      router.push(href, { scroll: false });
    });
  }, [currentRequestKey, router, setNavigationQuery, targetRequestKey]);

  const isPending = transitionPending || targetRequestKey !== null;
  const value = useMemo(
    () => ({ getNavigationParameters, isPending, navigate, navigationParameters, targetRequestKey }),
    [getNavigationParameters, isPending, navigate, navigationParameters, targetRequestKey],
  );
  return <BrowseNavigationContext.Provider value={value}>{children}</BrowseNavigationContext.Provider>;
}

export function BrowseResultsBoundary({
  children,
  fallback,
  responseKey,
}: {
  children: ReactNode;
  fallback: ReactNode;
  responseKey: string;
}) {
  const { isPending, targetRequestKey } = useBrowseNavigation();
  const searchParams = useSearchParams();
  const currentRequestKey = buildBrowseAnimePathFromLocation(searchParams);
  const showFallback = shouldShowBrowseFallback({
    transitionPending: isPending,
    currentRequestKey,
    targetRequestKey,
    responseKey,
  });

  return (
    <div aria-busy={showFallback}>
      {showFallback ? fallback : children}
    </div>
  );
}

export function useBrowseNavigation(): BrowseNavigationContextValue {
  const context = useContext(BrowseNavigationContext);
  if (!context) throw new Error("Browse navigation components must be inside BrowseNavigationProvider");
  return context;
}
