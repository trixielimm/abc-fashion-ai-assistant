# Search filters implemented

Implemented on 18 October 2026 (Australia/Sydney), following the
[behaviour plan](search-filter-implementation-plan-2026-10-18.md) and
[editorial UI plan](search-filter-ui-plan-2026-10-18.md).

The search page now has a 240 px desktop filter rail and an accessible native
modal drawer below 1024 px. Both use the same selection and group state. The
existing serif typography, white and warm-neutral surfaces, thin rules and
product imagery are retained. Primary filters are gender, category, size,
colour, price and features, with the remaining populated attributes and
category-specific measurements available under More details.

All option values, counts and range bounds come from the current public
catalogue. A search-specific loader reads the catalogue, reviewed facts and
stored prototype specifications without loading cross-sell rules. It respects
public access policies, validates specifications and preserves verified-fact
precedence. No migrations or database writes are required. Prototype data
remains identified by the existing store disclosure.

The new `/api/search` route and initial server rendering use the same pure
filter engine. Products, totals and facets share one loaded snapshot. Filters
combine with AND across groups and OR within ordinary facets; required features
combine with AND. Counts are distinct products before pagination, and ordinary
facet counts exclude their own current selection. Only stocked size options
match. Unknown values and zero-result combinations retain their constraints.
Zip closure and Fastening: Zip share a selection, and choosing another explicit
fastening replaces the required zip restriction.

Selections persist in URLs, including pagination and Back/Forward navigation.
The client debounces text/ranges, cancels superseded requests and ignores late
responses. Changes update the grid and counts together without the previous
search overlay/delay. Data refreshes on focus and every 30 seconds while visible.
Refresh failures retain the last successful snapshot with a retry message;
feature-source failures are not presented as genuine zero counts. Invalid URLs
and input ranges have explicit recovery states.

## Validation

- All 34 offline regression suites passed, including 17 new search-filter
  checks. The new suite is registered in the existing regression runner.
- 31 live API/page checks passed against the configured database through the
  local app. Every populated categorical facet was checked against its reported
  count, along with pagination, invalid parameters and fresh retrieval times.
- The actual narrowing journey returned 316 products, then Women 183,
  Clothing 120, pockets 74 and a maximum of A$150 giving 42.
- Browser checks verified those selections, range validation and preserved
  input focus, Escape/return focus, chip removal (74), Back restoration (42),
  product-page return (all four filters and 42 products), and rapid search edits
  where the final term wins.
- Responsive checks covered 390, 768, 1024 and 1440 px. The drawer is used below
  1024 px; the rail appears at 1024 px. No horizontal overflow was observed at
  the checked breakpoints. The modal covers the bottom navigation and keeps
  its result action visible.
- TypeScript, repository ESLint, whitespace checks and the Webpack production
  build passed.

Evidence:
[offline regression](test-evidence/regression-2026-10-18T02-09-27-084Z.txt),
[live API checks](test-evidence/search-filters-live-2026-10-18.json),
[desktop preview](test-evidence/search-filters-desktop-2026-10-18.png),
[mobile preview](test-evidence/search-filters-mobile-2026-10-18.png).

The catalogue still uses the prototype's bounded 5,000-row retrieval strategy.
A database aggregation RPC can replace this loader if catalogue size or measured
latency requires it. No hosting deployment was performed.
