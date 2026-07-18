"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { useBrowseNavigation } from "@/components/browse/BrowseNavigation";
import { Button } from "@/components/ui/Button";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/ui/Icons";
import type { AnimePageInfo } from "@/types/anime";

type PaginationProps = {
  pageInfo: AnimePageInfo;
  scrollTargetId?: string;
};

const SCROLL_REQUEST_KEY = "recommendmeanime-pagination-scroll-target";

export function Pagination({ pageInfo, scrollTargetId = "browse-results" }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isPending, navigate } = useBrowseNavigation();
  const requestedPage = useRef<number | null>(null);
  const hasPreviousPage = pageInfo.currentPage > 1;

  useEffect(() => {
    requestedPage.current = null;
    const requestedTarget = window.sessionStorage.getItem(SCROLL_REQUEST_KEY);
    if (requestedTarget !== scrollTargetId) return;

    window.sessionStorage.removeItem(SCROLL_REQUEST_KEY);
    window.requestAnimationFrame(() => {
      document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [pageInfo.currentPage, scrollTargetId]);

  function goToPage(page: number) {
    if (isPending || requestedPage.current !== null || page < 1 || page > pageInfo.lastPage) return;

    requestedPage.current = page;
    const parameters = new URLSearchParams(searchParams.toString());
    if (page === 1) parameters.delete("page");
    else parameters.set("page", String(page));

    window.sessionStorage.setItem(SCROLL_REQUEST_KEY, scrollTargetId);
    navigate(`${pathname}${parameters.size ? `?${parameters.toString()}` : ""}`);
  }

  return (
    <nav
      className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-line pt-5 sm:flex-row"
      aria-label="Anime results pages"
      aria-busy={isPending}
    >
      <p className="text-sm text-ink-muted" aria-live="polite">
        {isPending
          ? "Loading another page..."
          : `Page ${pageInfo.currentPage} of ${Math.max(pageInfo.lastPage, 1)}`}
        {pageInfo.total > 0 && !isPending && (
          <span className="text-ink-faint"> / {pageInfo.total.toLocaleString()} titles</span>
        )}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          disabled={!hasPreviousPage || isPending}
          onClick={() => goToPage(pageInfo.currentPage - 1)}
          aria-label="Go to previous page"
        >
          <ArrowLeftIcon className="size-4.5" />
        </Button>
        <span className="min-w-20 text-center text-sm font-semibold text-ink">
          {pageInfo.currentPage} / {Math.max(pageInfo.lastPage, 1)}
        </span>
        <Button
          variant="outline"
          size="icon"
          disabled={!pageInfo.hasNextPage || isPending}
          onClick={() => goToPage(pageInfo.currentPage + 1)}
          aria-label="Go to next page"
        >
          <ArrowRightIcon className="size-4.5" />
        </Button>
      </div>
    </nav>
  );
}
