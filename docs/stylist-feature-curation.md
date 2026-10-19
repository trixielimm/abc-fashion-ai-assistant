# Product-feature curation and import

The next release dependency is real feature evidence. The 17 October source
audit inspected all 316 public catalogue descriptions/tags, the public database
field names, the repository and the configured product-assets bucket. It found
no supplier specifications, supplier product identifiers, official product URLs
or specification-sheet files. Descriptions repeat basic styling labels; they
do not establish pockets, lining, adjustability, care or capacity.

No new product facts have been published. The hosted feature table remains
empty. Existing application behaviour therefore continues to abstain when a
feature-based improvement cannot be established.

## Prepared starter batch

`stylist-product-feature-intake.json` contains six candidate comparison pairs:
three dress pairs and three bag pairs, comprising 12 actual catalogue products
and 60 feature fields. Each pair shares category, subcategory, product type and
gender. All items were available, in stock and at or below A$150 when selected.
Prices only help select comparison candidates; a higher price proves no benefit.

Every feature value starts as `null` and every review status as `draft`.
This is an editable review template, not data that should be inserted directly
into the database. Do not turn `null` into `false` to fill missing information.

## Source and review process

1. Match each local product ID to a real supplier SKU or manufacturer product.
   Generic names, similar-looking photographs and similar retailer listings
   cannot establish that identity. Record the exact SKU/document location in
   `source_reference` so another reviewer can find the specific product entry.
2. Prefer manufacturer specifications, approved supplier sheets or an official
   product page for that exact item. A care label or direct product inspection
   can support appropriate facts when documented by the merchant. Photographs
   cannot verify hidden construction, capacity or wash instructions.
3. Enter the actual typed `value`, `source_reference`, `source_version` and an
   exact `evidence_quote`. Use a stable, public-safe reference: source references
   appear in customer-facing comparisons. Keep credentials/private signed links
   out of the intake. Leave unknown or conflicting facts in draft.
4. Have an accountable reviewer confirm both the product mapping and the claim.
   Enter their `reviewed_by` identity, ISO `verified_at` timestamp and change
   `review_status` to `verified` only after approval. The preparation tool checks
   these fields; it does not perform or replace that factual review.
5. Review the same feature on both products. An unknown original cannot prove
   that a replacement adds a feature. For capacity, use litres. For use cases,
   provide documented labels; do not infer extra versatility from price, brand
   or generic occasion tags.

If the assortment is synthetic, keep simulated feature fixtures separate from
the customer catalogue. The existing offline commerce tests already demonstrate
feature-based upgrades with synthetic data; they are not a source of real facts.

## Validate and prepare an import

Run from the repository root:

```bash
node --import tsx scripts/prepare-stylist-feature-import.mjs docs/stylist-product-feature-intake.json
```

This reads a local file and prints approved/draft counts. It performs no network
requests or database writes. The starter batch correctly reports zero approved
facts and 60 draft fields.

Once real source review is complete, generate a new SQL file for inspection:

```bash
node --import tsx scripts/prepare-stylist-feature-import.mjs docs/stylist-product-feature-intake.json --out /tmp/reviewed-stylist-features.sql
```

The tool refuses to generate SQL for an empty approved batch. It rejects missing
evidence/reviewer metadata, invalid feature types, duplicate approved facts,
obvious demo references and common credential-bearing source URLs. Draft and
rejected fields are excluded. Preserve the approved intake as the evidence
record; the SQL contains an SHA-256 fingerprint of its approved rows.

The generated SQL runs in one transaction. It validates current product identity
against the intake, refuses conflicting existing facts and inserts new approved
facts. Exact retries are safe; existing facts are never silently overwritten.
The import modifies no prices, stock, products, images or access policies.

After reviewing the SQL and confirming its target project, apply through the
already authenticated CLI:

```bash
./node_modules/.bin/supabase db query --linked --project-ref ppmldlrtdkuzdnjieudw --file /tmp/reviewed-stylist-features.sql
```

Then verify the imported records through the public feature API and exercise the
stylist against the reviewed product IDs. Confirm the displayed original and
replacement facts, sources, extra cost, budget and trade-offs. A successfully
imported fact does not guarantee a useful upgrade: other requirements still
apply.

## Validation completed

Eight offline import checks passed, including unknown versus false, required
review metadata, draft exclusion, feature typing, source safeguards, duplicate
handling, transaction safeguards and SQL escaping. All 27 offline suites passed,
and lint passed for the changed scripts.

The generated import SQL was also parsed/planned against the hosted database
using `EXPLAIN` without `ANALYZE`, inside a rollback transaction. The public-table
insert was not executed. The check confirmed that the feature table still
contained zero records. This verifies SQL readiness, not the truth of any
product claim.

Evidence: [offline regression](test-evidence/regression-2026-10-17T03-04-52-243Z.txt)
and [SQL planning check](test-evidence/stylist-feature-import-sql-plan-2026-10-17.json).
