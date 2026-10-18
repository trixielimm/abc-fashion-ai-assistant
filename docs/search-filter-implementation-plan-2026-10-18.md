# Search filters and live product counts

Implementation plan prepared on 18 October 2026 (Australia/Sydney). This is a
plan; application behaviour and the database have not been changed.

The companion [UI plan](search-filter-ui-plan-2026-10-18.md) specifies the
editorial styling, responsive layout, filter controls and interaction states.

## Intended experience

Customers can combine the search term with gender, categories, sizes, colours,
price and recorded product features. Each option shows the number of matching
products. Selecting or removing a filter updates the product grid, total and
option counts together without a full page reload.

Use a desktop filter sidebar and a mobile filter drawer. Keep the most useful
groups visible first: gender, category, size, colour, price and features. Put
the remaining attributes in collapsible groups. Show selected-filter chips,
individual removal and Clear filters, which retains the search term. The mobile
drawer updates immediately and has a “View N products” button to close it.

## What exists today

The search page in `app/search/page.tsx` loads the catalogue, applies text
matching, offers a single category filter and paginates at 24 products. The
text matcher is in `lib/search/catalogueSearch.ts`. Its eligibility checks
exclude unavailable or out-of-stock products and invalid identities/prices.

A read-only audit of the public database at 12:44 pm Sydney time on 18 October
confirmed:

- 316 visible, in-stock products: Women 183, Men 75 and Unisex 58.
- Categories: Clothing 180, Shoes 58, Bags 38 and Accessories 40.
- 16 subcategories, 61 product types, 17 colours, 16 materials, 7 fits,
  9 styles, 10 occasions, 5 seasons, 5 brand lines, 16 available size labels
  and 124 tags. Every product has values in these groups.
- Prices range from A$15 to A$280.
- All 316 products have stored prototype specifications that pass the existing
  identity and specification validators. There are zero supplier-verified
  feature rows.
- Recorded positive features across the whole catalogue: pockets 154,
  lining 116, adjustable straps 56, zip closure 78 and machine washable 70.

These are observations of the current prototype dataset, not constants to put
in the interface. Evidence is saved in
`docs/test-evidence/search-filter-data-audit-2026-10-18.json`.

## 1. Define the filter catalogue

Use a typed definition registry for supported fields, labels, control types,
units and category applicability. Derive option values and counts from the
current eligible database products; do not hardcode the available genders,
colours, categories or feature counts.

- **Taxonomy:** gender, category, subcategory and product type.
- **Product attributes:** colour, size, material, fit, style, occasion, season,
  brand line and tags. Use searchable option lists for product types and tags.
- **Price:** minimum and maximum in AUD, bounded by current catalogue values.
- **Boolean features:** pockets, lining, adjustable straps, zip closure and
  machine washable. Start with “Has pockets” style checkboxes.
- **Other specification attributes:** fastening/closure and recorded use cases.
- **Category measurements:** clothing sample garment length; shoe heel height
  and sole material; bag capacity, compartments, width/height/depth and strap
  drop. Also expose recorded hardware finish where applicable. Numeric controls
  show units and observed ranges. Garment length must say it is a sample
  measurement that varies by size.

Expose every populated supported attribute, while hiding inapplicable groups
unless they contain an active selection. Product descriptions, construction
and care instructions remain readable product information; any extension of
text search to these fields must use the same validated specification data.
Internal IDs, embeddings, timestamps, source references and cross-sell rules
are not customer filter options.

Normalize option whitespace and case while preserving a display label. Keep
meaningfully different values separate: Leather and Faux Leather must never
collapse. Hardware finish currently contains case variations that need this
normalization. Preserve category relationships and natural size ordering.
Size matches must use in-stock sizes; distinguish clothing and shoe size
contexts so the label “8” is understandable.

Reuse `comparableFeatures()` from `lib/search/productBenefits.ts` for shared
features: a verified fact takes precedence, including a verified false value,
and a validated stored prototype specification supplies the fallback. Use
`getProductSpecification()` for the additional specification fields. Keep the
existing prototype disclosure. Never infer pockets from an image or description.
Missing/null means unknown or inapplicable, and does not match a required
feature. If negative feature filters are added, unknown must not mean “No”.

## 2. Establish matching and counting rules

Apply text search and all active filters before pagination. Retain the current
text relevance order and 24-product page size.

- Different groups combine with **AND**: Women + Clothing + Blue + size 10.
- Multiple values inside an ordinary group combine with **OR**: Blue or Navy;
  size 10 or 12. Gender is an exact value; customers can select Women and
  Unisex together explicitly.
- Required features combine with **AND**: pockets and lining must both be true.
- Count distinct products, not inventory units, feature rows or size variants.
  A product with stock in three sizes still counts once in the total.
- The result total applies every active filter.
- For an ordinary facet, calculate each option count using the search term and
  every other active group, excluding that facet's current selection. A colour
  count therefore means “products of this colour matching the other filters”,
  not the projected total after toggling it. Values in multi-valued facets can
  overlap, so their counts need not add to the total.
- For a feature checkbox, count products satisfying it plus every other active
  requirement. Treat each feature as its own predicate when counting.
- Derive the option vocabulary from the eligible catalogue. Disable zero-count
  unselected options; keep selected options removable even when their count
  becomes zero. Retain active constraints on an empty result and offer clear
  removal actions instead of silently relaxing them.

A real example from this audit, with no text term: Women gives 183 products;
adding Clothing gives 120; requiring pockets gives 74; setting a maximum of
A$150 gives 42. The implemented engine should reproduce these numbers against
the same data snapshot, with future changes reflected automatically.

## 3. Build one search service for results and facets

For the current 316-product catalogue, start with a pure server-side filter and
facet engine. There is no need for a new search provider or database migration
for the first version.

Use a search-specific server loader to read the public `product_catalog`,
reviewed feature facts and prototype specifications with complete pagination.
Reuse the existing validators and feature precedence without loading unrelated
cross-sell rules. Keep bounded timeouts and fail explicitly if a retrieval cap
would truncate the dataset. Do not use `loadPreferenceValues()` as the count
source: its reference vocabulary is intentionally independent of saleable stock.

Return one response containing the applied filter state, product page, total,
page information, facet options/counts, measurement bounds, feature-data status
and retrieval timestamp. Compute results and counts from the same loaded
dataset so they stay consistent. Only return the customer-facing fields needed
by the interface, not full specifications or evidence metadata.

Both the initial server-rendered page and a new `GET /api/search` handler call
this service. Validate and bound query parameters, repeated values, price and
measurement ranges, and page numbers. Restrict field names to the registry;
never interpolate arbitrary client input into database queries. Retain existing
public catalogue access policies and use the publishable-key client.

Benchmark the completed path. If catalogue growth or measured latency makes
full reads expensive, move the same matching and aggregation contract to a
Postgres RPC with appropriate indexes, database pagination and count-parity
tests. Preserve feature validation, source precedence and public access rules.

## 4. Connect URL state and live updates

Store the complete filter state in the URL. Support repeated parameters for
multi-select values and preserve existing `q`, `category` and `page` links.
Reset page to 1 when the term or a filter changes; retain every filter during
pagination and product-page return navigation.

Server rendering reads the awaited page `searchParams`. After hydration, the
client requests the shared API and synchronizes the URL using the native History
API supported by the installed Next.js documentation. Discrete selections add
history entries; debounced input edits replace the current entry. URL changes,
including Back/Forward, drive the same request path. Avoid fetching through both
an API call and a server navigation for a single interaction.

- Checkboxes update immediately. Debounce text and range edits by approximately
  250 ms and validate ranges before requesting.
- Cancel superseded requests and reject late responses. Only the latest filter
  state may replace the displayed snapshot.
- Update the grid, total and facet counts as one response. Keep controls usable,
  preserve focus and scroll, and announce result-count changes accessibly.
- Read fresh data on filter changes, tab focus and every 30 seconds while the
  page is visible. Pause background polling when hidden and coalesce refreshes
  with active searches. Use an uncached response for this path.
- Background refresh keeps the current page if valid, otherwise clamps it to
  the final available page. Refresh failures retain the last successful results
  with a retry/stale indicator; initial failures show an unavailable state.
  A feature-data failure must not be displayed as a genuine zero count.

This provides immediate updates when customers filter and automatic database
refresh within about 30 seconds while idle. Instant database push updates can
later use Supabase Realtime invalidation on the underlying tables if needed;
the view itself is not a change-event source.

## 5. Implementation sequence and verification

1. Add the filter definitions, URL parser/serializer and normalized product
   projection under `lib/search/`. Add the pure matching/counting engine and
   meaningful tests for the rules above.
2. Add the search-specific data loader and `app/api/search/route.ts`; wire the
   initial `app/search/page.tsx` response through the same service. Verify full
   retrieval, access policies, source precedence and explicit error states.
3. Add the desktop/sidebar and mobile/drawer components under
   `components/search/`. Connect active chips, counts, URL state, pagination,
   request cancellation and background refresh. Adapt the search-specific
   loading/navigation behaviour in `components/commerce/SearchPageLink.tsx`
   so filter interactions do not incur its current artificial 600 ms delay.
4. Verify OR/AND combinations, facet counts before pagination, duplicate-size
   counting, null/false distinction, stale specifications, verified overrides,
   numeric boundaries, zero results, shareable URLs, Back/Forward, rapid edits
   and catalogue/stock changes. Test product removal and feature-data failure.
5. Check desktop and mobile interaction, keyboard access and announced totals.
   Run the relevant existing regression suites, TypeScript, lint and a
   production build, and record live count parity against a fresh database audit.

The first complete release includes all populated supported attributes, live
counts and the refresh behaviour above. Database RPCs and push subscriptions
are scaling/freshness upgrades, not prerequisites for this catalogue size.
