"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useBrowseNavigation } from "@/components/browse/BrowseNavigation";
import { browseAnime, type BrowseOptions } from "@/lib/api/anime";
import { pollForExactBrowsePagination } from "@/lib/browse-pagination-refresh";
import { formatBrowsePagination } from "@/lib/pagination";
import type { AnimePageInfo } from "@/types/anime";

const BrowsePaginationMetadataContext = createContext<AnimePageInfo | null | undefined>(undefined);

type BrowsePaginationMetadataProviderProps = {
  browseOptions: BrowseOptions;
  children: ReactNode;
  initialPageInfo: AnimePageInfo | null;
  responseKey: string;
};

export function BrowsePaginationMetadataProvider({
  browseOptions,
  children,
  initialPageInfo,
  responseKey,
}: BrowsePaginationMetadataProviderProps) {
  const { targetRequestKey } = useBrowseNavigation();
  const [pageInfo, setPageInfo] = useState(initialPageInfo);

  useEffect(() => {
    if (
      !initialPageInfo
      || initialPageInfo.isExact
      || (targetRequestKey !== null && targetRequestKey !== responseKey)
    ) return;

    const controller = new AbortController();
    let isCurrent = true;

    void pollForExactBrowsePagination({
      initialPageInfo,
      requestKey: responseKey,
      signal: controller.signal,
      isCurrentRequest: (requestKey) => isCurrent && requestKey === responseKey,
      fetchPageInfo: async (signal) => (
        await browseAnime(browseOptions, { retry: false, signal })
      ).pageInfo,
    }).then((exactPageInfo) => {
      if (exactPageInfo && isCurrent && !controller.signal.aborted) {
        setPageInfo(exactPageInfo);
      }
    });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [browseOptions, initialPageInfo, responseKey, targetRequestKey]);

  return (
    <BrowsePaginationMetadataContext.Provider value={pageInfo}>
      {children}
    </BrowsePaginationMetadataContext.Provider>
  );
}

export function BrowseTitleCount() {
  const pageInfo = useBrowsePaginationMetadata();
  const titleCount = pageInfo ? formatBrowsePagination(pageInfo).titleCount : null;

  if (!titleCount) return null;
  return <p className="shrink-0 text-sm text-ink-faint">{titleCount}</p>;
}

export function useBrowsePaginationMetadata(): AnimePageInfo | null {
  const pageInfo = useContext(BrowsePaginationMetadataContext);
  if (pageInfo === undefined) {
    throw new Error("Browse pagination metadata must be inside BrowsePaginationMetadataProvider");
  }
  return pageInfo;
}
