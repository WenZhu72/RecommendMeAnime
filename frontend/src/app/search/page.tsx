import { redirect } from "next/navigation";

import { buildBrowseSearchLocation } from "@/lib/browse-path";

export const dynamic = "force-dynamic";

type SearchPageProps = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  redirect(buildBrowseSearchLocation(q));
}
