"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { useBrowseNavigation } from "@/components/browse/BrowseNavigation";
import { useBrowsePaginationMetadata } from "@/components/browse/BrowsePaginationMetadata";
import { Button } from "@/components/ui/Button";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/ui/Icons";
import { buildBrowsePageLocation } from "@/lib/browse-path";
import { formatBrowsePagination } from "@/lib/pagination";

type PaginationProps = {
  scrollTargetId?: string;
};

const SCROLL_REQUEST_KEY = "recommendmeanime-pagination-scroll-target";

export function Pagination({ scrollTargetId = "browse-results" }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isPending, navigate } = useBrowseNavigation();
  const pageInfo = useBrowsePaginationMetadata();
  const requestedPage = useRef<number | null>(null);

  useEffect(() => {
    requestedPage.current = null;
    const requestedTarget = window.sessionStorage.getItem(SCROLL_REQUEST_KEY);
    if (requestedTarget !== scrollTargetId) return;

    window.sessionStorage.removeItem(SCROLL_REQUEST_KEY);
    window.requestAnimationFrame(() => {
      document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [pageInfo?.currentPage, scrollTargetId]);

  if (!pageInfo) return null;
  const currentPageInfo = pageInfo;
  const hasPreviousPage = currentPageInfo.currentPage > 1;
  const display = formatBrowsePagination(currentPageInfo);

  function goToPage(page: number) {
    if (
      isPending
      || requestedPage.current !== null
      || page < 1
      || (page > currentPageInfo.currentPage && !currentPageInfo.hasNextPage)
    ) return;

    requestedPage.current = page;
    window.sessionStorage.setItem(SCROLL_REQUEST_KEY, scrollTargetId);
    navigate(buildBrowsePageLocation(pathname, searchParams, page));
  }

  return (
    <nav
      className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-line pt-5 sm:flex-row"
      aria-label="Anime results pages"
      aria-busy={isPending}
    >
      <p className="text-sm text-ink-muted" aria-live="polite">
        {isPending ? "Loading another page..." : display.pageSummary}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          disabled={!hasPreviousPage || isPending}
          onClick={() => goToPage(currentPageInfo.currentPage - 1)}
          aria-label="Go to previous page"
        >
          <ArrowLeftIcon className="size-4.5" />
        </Button>
        <span className="min-w-20 text-center text-sm font-semibold text-ink">
          {display.compactPage}
        </span>
        <Button
          variant="outline"
          size="icon"
          disabled={!currentPageInfo.hasNextPage || isPending}
          onClick={() => goToPage(currentPageInfo.currentPage + 1)}
          aria-label="Go to next page"
        >
          <ArrowRightIcon className="size-4.5" />
        </Button>
      </div>
    </nav>
  );
}
