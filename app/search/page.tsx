import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { SearchExplorer } from "@/components/search/SearchExplorer";
import { getSearchResults } from "@/lib/search/searchService";
import { emptyFilters, InvalidSearchFilters, parseFilters, serializeFilters } from "@/lib/search/filterState";
import type { SearchSnapshot } from "@/lib/search/facetedSearch";

export const metadata: Metadata = {
  title: "Search | ABC Fashion",
  description: "Search the ABC Fashion collection for clothing, shoes, bags and accessories.",
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, entry);
  let state = emptyFilters(params.get("q")?.slice(0, 120));
  let initial: SearchSnapshot | null = null;
  let invalid = false;
  try {
    state = parseFilters(params);
    initial = await getSearchResults(state);
  } catch (error) {
    invalid = error instanceof InvalidSearchFilters;
    console.error("Search unavailable:", error instanceof Error ? error.name : "UnknownError");
  }
  return <div className="min-h-[70vh] bg-background pb-20 sm:pb-24">
    <Container className="pt-10 sm:pt-14 lg:pt-16">
      {invalid ? <div className="py-16 text-center">
        <h1 className="font-serif text-4xl">Check your filters</h1>
        <p className="mt-4 text-sm text-muted">This search link contains an invalid filter or range.</p>
        <Link className="mt-6 inline-flex min-h-11 items-center text-sm underline underline-offset-4" href={`/search?${new URLSearchParams({ q: state.q })}`}>Clear filters</Link>
      </div> : <SearchExplorer key={serializeFilters(state)} initialState={state} initial={initial} />}
    </Container>
  </div>;
}
