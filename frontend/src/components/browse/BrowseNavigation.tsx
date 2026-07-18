"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
  type ReactNode,
} from "react";

import { buildBrowseAnimePathFromLocation } from "@/lib/browse-path";

type BrowseNavigationContextValue = {
  isPending: boolean;
  navigate: (href: string) => void;
};

const BrowseNavigationContext = createContext<BrowseNavigationContextValue | null>(null);

export function BrowseNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback((href: string) => {
    startTransition(() => router.push(href, { scroll: false }));
  }, [router]);

  const value = useMemo(() => ({ isPending, navigate }), [isPending, navigate]);
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
  const { isPending } = useBrowseNavigation();
  const searchParams = useSearchParams();
  const responseIsStale = buildBrowseAnimePathFromLocation(searchParams) !== responseKey;
  const showFallback = isPending || responseIsStale;

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
