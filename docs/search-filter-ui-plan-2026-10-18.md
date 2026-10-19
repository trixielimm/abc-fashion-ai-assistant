# Search filter UI plan

Prepared on 18 October 2026 (Australia/Sydney). This complements the
[filter implementation plan](search-filter-implementation-plan-2026-10-18.md).
It specifies the intended interface; no application UI has been implemented.

## Design direction

Make the controls feel like part of the existing fashion catalogue. Keep the
product imagery and “Search the collection” heading prominent, with a quiet,
readable filter area supporting them.

Reuse the visual language already defined in `app/globals.css`,
`app/layout.tsx`, `components/layout/Container.tsx` and the product controls:

- Cormorant Garamond for the page heading and the small “Refine” panel title.
  Inter for filter names, options, counts, inputs and actions.
- Existing `background`, `foreground`, `muted`, `border` and `surface` tokens.
  White is the main canvas; warm neutral surfaces distinguish small selected
  items. Black marks selected controls and the mobile primary action.
- Thin divider rules, square checkboxes and size tiles, restrained corners and
  generous space between groups. Use flat surfaces without decorative shadows.
- Keep the current Container width and horizontal gutters: 20 px on small
  screens, 32 px on tablets and 56 px on desktop.
- Small uppercase, tracked text is for short overlines only. Use 13–14 px
  sentence-case option labels, 12–13 px counts and at least 16 px text-entry
  inputs on touch devices. Main filter group headings are 14 px.
- Reuse the product accordion's plus/minus treatment and size selection's
  black/white states. Use a clear visible outline for focus.

## Page composition

Keep the current editorial introduction and underlined search field. Below
their divider, place the results title, total, active selections and catalogue.
The introduction scrolls normally so products have room on smaller screens.

On desktop, the first catalogue row contains “Refine” over the left rail and
the search term or “The collection” plus total over the product grid. On tablet
and mobile, replace the rail title with a visible “Filters” button and show the
total opposite it. Do not add a separate sorting control in this scope.

Active selections sit directly below this toolbar, aligned with the product
grid on desktop and spanning the content width on mobile. Each selection has
a readable label and a remove action; a final “Clear filters” text action
retains the search term. Render this row only when filters are selected.

## Desktop and tablet layout

- At widths of 1024 px and above, use a 240 px left rail, a 32 px gap and the
  remaining width for the product grid. Keep product cards comfortable: two
  columns at 1024–1199 px, three at 1200–1439 px and four from 1440 px.
- Below 1024 px, use the drawer interface. Keep two product columns below
  768 px and three at 768–1023 px, with the existing mobile gutters.
- The rail starts with a small serif “Refine” heading. Groups are separated by
  a single horizontal rule. Give each group header a 48 px minimum height;
  expanding it reveals options beneath with 8–12 px bottom breathing room.
- Keep the desktop rail in document flow for the first version. Avoid a tall
  fixed panel or a second scrolling region. The open groups and scroll position
  survive data refreshes and product pagination.
- Keep category selection in the rail; replace the current horizontal category
  chip navigation so there is one clear place to change each filter.

## Filter hierarchy

Always show the six primary group headers in this order: **Gender, Category,
Size, Colour, Price, Features**. Start Gender and Category expanded, with the
other groups collapsed. When a section has a selection, show a short summary
in its collapsed header, such as “10, 12” or “With pockets”. Multiple sections
can remain open, and users' open/closed choices are preserved.

Place a “More details” disclosure below the primary groups. It reveals Style,
Occasion, Material, Fit, Season, Collection (brand line), Product type and Tags,
plus relevant category measurements. All populated supported attributes remain
reachable without overwhelming the initial view. Keep a group containing an
active selection reachable even if it is no longer relevant to a new category.

Category shows the four current top-level options. A selected category reveals
its subcategories beneath it, slightly indented, with the label “Subcategory”.
Selected child filters remain visible and removable if a parent selection
changes. Never silently discard a constraint to produce more results.

## Control design

**Gender, category and text attributes.** Use full-width checkbox rows, with
the label on the left and a right-aligned product count. The entire row is a
44 px minimum hit target. For the current unfiltered snapshot, Gender reads
“Women 183”, “Men 75” and “Unisex 58”. Use an explicit checkmark, black fill
and stronger text for selection. Allow multiple choices.

**Size.** Use the same square tiles as the product page, with a label and small
count inside each tile and a 44 px minimum target. Allow multiple sizes. Split
ambiguous numeric labels into “Clothing sizes” and “Shoe sizes” when both
categories are present, alongside letter sizes and One Size where relevant.
Use the catalogue's size order and current stock.

**Colour.** Use named checkbox rows with a small representative swatch,
followed by the colour name and right-aligned count. Recognized colour values
can have mapped swatches; unmatched values remain selectable by name. Light
swatches need an outline. The label and checkmark communicate the selection
independently of colour. Keep selected row backgrounds neutral.

**Price.** Use two labelled inputs, “Min A$” and “Max A$”, on one line. Show
the current catalogue bounds as a small helper line when the group is open.
Start with inputs rather than a dual-handle slider to make exact budgets and
keyboard operation straightforward. Display an inline validation message if
the minimum exceeds the maximum; preserve the user's draft for correction.

**Features.** Use plain labels such as “With pockets”, “Lined”, “Adjustable
straps”, “Zip closure” and “Machine washable”, each with a count. Show a short
instruction when opened: “Selected features must all match.” Display applicable
features for the current category and retain any selected feature. Unknown
values never count as confirmed absence. A quick feature and a detailed control
for the same condition, such as Zip closure and Fastening: Zip, must share one
state rather than create duplicate independent constraints.

**Long lists.** Show up to six options, selected values first, followed by a
“Show all N” disclosure. For lists exceeding ten options, expanding also offers
a labelled “Find a material” / “Find a product type” input. Searching this list
narrows options only; it does not change the product search term. Keep ordering
stable while counts update, so rows do not move under the pointer or finger.

**Measurements.** Put ranges under their category-specific detail headings,
using the same two-input treatment as price. Include units in the labels:
heel height in cm, capacity in L and bag dimensions in cm. Garment length is
labelled “Sample garment length” with “Varies by size” helper text. Render no
empty or inapplicable measurement controls.

**Selected filters.** Use compact neutral chips with a thin border and short
labels, such as “Women”, “Clothing”, “With pockets” and “Up to A$150”. Each
chip is a single remove button with a 44 px minimum target and an accessible
name such as “Remove colour: Blue”. On mobile, wrap chips to two rows, then
offer “Show all N filters”. Always keep Clear filters available.

## Mobile drawer

Opening “Filters” shows a full-height panel, using the white background and
thin rules of the rest of the site. At tablet widths, it can appear as a
420 px right-side drawer. On phones it occupies the full viewport.

The drawer has three regions:

1. A fixed header: serif “Refine”, a compact selection count and a clearly
   labelled close button.
2. One scrolling body with the same group order, controls, counts and selected
   summaries as desktop. Do not create separate draft filters for mobile.
3. A fixed footer: “Clear filters” and a black “View 42 products” button,
   with space for the device safe area. While a response is pending, use
   “View results” and show “Updating results…” nearby. Closing remains usable.

Selections apply immediately and counts update while the drawer stays open.
“View N products” closes the panel; it does not submit a second request. Closing
with the X, Escape or the tablet backdrop also retains the current selections.
Return focus to the Filters opener and preserve the product grid's scroll
position. The drawer covers the mobile navigation and stylist launcher;
background controls cannot be activated while it is open.

On the catalogue page, show “Filters · 4” when four individual values or
required features are active; a filled price or measurement range counts as
one filter. The number is a selection count, never the product total.

## Counts, feedback and empty states

Use plain, right-aligned numbers with tabular digits and enough reserved space
to avoid shifting labels. Make all option counts secondary to their labels.
The top-level total reads “42 products”, with correct singular wording.

Keep the counting behaviour from the implementation plan. A colour count
reflects that colour plus the other groups; the grand total reflects every
active group. An optional “About these counts” disclosure can explain this in
plain language without putting database terminology in the shopping flow.

- **Updating:** keep the current products and counts visible, marked by a small
  “Updating results…” status next to the total. Update the grid, total and facet
  counts together when the latest response arrives. Keep controls interactive
  and avoid a page-covering loading overlay for routine filter changes.
- **Zero-count option:** leave it visible but muted and disabled unless already
  selected. Preserve readable contrast, include “0”, and allow selected
  zero-count options to be removed.
- **No matches:** retain the filters and show the serif heading “No pieces
  match these filters”, followed by “Try removing a filter or widening your
  price range.” Offer “Undo last filter” and “Clear filters”. Keep the search
  term unless the customer explicitly clears it.
- **Refresh failure:** retain the last successful snapshot and show a small
  inline “Couldn’t update results. Try again.” status. Initial loading failure
  retains the existing collection-unavailable treatment. Missing feature data
  uses “Temporarily unavailable” instead of a misleading zero count.
- **Background refresh:** update quietly. Do not reopen groups, move focus,
  reset the drawer, announce unchanged totals or re-sort option rows.

Use subtle 120–180 ms opacity/disclosure transitions, respecting reduced
motion. Avoid animating numbers through intermediate values or changing the
product grid layout during loading.

## Example journey

Using the database snapshot recorded in the implementation plan:

1. Arrive at the catalogue: the total is 316 products, Gender is expanded,
   and each gender has a count.
2. Choose Women: the total becomes 183 and a Women chip appears.
3. Choose Clothing: the total becomes 120; clothing subcategories and clothing
   size controls become easy to reach.
4. Open Features and select With pockets: the total becomes 74.
5. Set the maximum price to A$150: the total becomes 42. The four active
   chips summarize the selections; mobile shows “Filters · 4” and
   “View 42 products”.
6. Remove the price chip: the total returns to 74 against that same snapshot.

All example numbers come from the 18 October audit. The implemented interface
must calculate them from the current database.

## Implementation and visual acceptance

Build reusable filter groups, option rows, size controls, colour rows, ranges
and active chips in `components/search/`. Compose them into a desktop rail and
an accessible modal drawer using the shared search state. Keep matching and
counting in the service defined by the implementation plan.

Review at 390 px, 768 px, 1024 px and 1440 px, including a short viewport and
200% zoom. Confirm that the heading and product imagery retain visual priority;
labels and counts stay readable; long names and many selections wrap cleanly;
touch targets meet 44 px; the mobile footer stays above the safe area; focus
returns correctly; keyboard users can reach every control; and result changes
are announced politely without reading every option count. At zoomed or narrow
effective widths, switch to the drawer layout.

Verify shared desktop/mobile selections, preservation of open groups, exact
count updates, zero states, long-list search, rapid input and Back/Forward.
The existing stylist interface and mobile navigation must remain reachable
when the filter drawer closes.
