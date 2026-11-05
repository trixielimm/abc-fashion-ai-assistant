import { getSearchResults } from "@/lib/search/searchService";
import { InvalidSearchFilters, parseFilters } from "@/lib/search/filterState";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const filters = parseFilters(new URL(request.url).searchParams);
    return Response.json(await getSearchResults(filters, request.signal), { headers });
  } catch (error) {
    if (error instanceof InvalidSearchFilters) return Response.json({ error: error.message }, { status: 400, headers });
    console.error("Search unavailable:", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "Couldn’t update results. Please try again." }, { status: 503, headers });
  }
}
