# Stylist commerce implementation

17 October 2026. Implements the first release defined in section 10 of
[the approved plan](ai-stylist-styling-upsell-plan-2026-10-17.md).

**Prototype follow-up:** the owner clarified that this is a fictional catalogue.
All 316 products now have OpenAI-authored synthetic specs in a separate table.
See [the populated prototype report](prototype-product-specifications-2026-10-17.md)
for current status. The supplier-evidence requirements below still apply to
real verified claims; they do not block the explicitly synthetic prototype mode.

## What changed

The active customer chat now retains selected and already-owned outfit pieces,
uses them when ranking additions, and compares replacements using documented
benefits. Recommendations remain optional. Keeping a piece does not add it to
the cart.

- **Cross-selling:** an explicit request for shoes searches Shoes even when a
  dress's default pairing rule points to Bags. General add-on requests can use
  multiple approved category rules and skip occupied roles. Candidates are
  ranked against the referenced product and other kept pieces using occasion,
  style, season and palette evidence. Stock is a tie-breaker after compatibility.
- **Value comparisons:** relevant reviewed features can establish a benefit
  without requiring a new occasion/style label. Higher-priced replacements show
  the extra cost; same-price and cheaper improvements are alternatives. Known
  losses and missing comparison data appear as trade-offs. A price increase alone
  does not qualify. Both original and replacement need reviewed facts to claim
  that a feature improves.
- **Conversation:** selected pieces survive new results and product/policy
  questions. Customers can keep, own, remove or reject a card; rejected/cart IDs
  are excluded from subsequent recommendations. “No extras” hides proactive
  selling actions. Explicit later shopping requests remain possible.
- **Presentation:** cards have pairing evidence and value-comparison details,
  including original/current prices, feature differences, sources and trade-offs.
  “Why?” recomputes evidence from fresh catalogue records and retained anchor IDs.
- **Constraint handling:** eligibility and shared restrictions apply before the
  four-card cap, including restrictions introduced in the current turn. Required
  features fail closed when reviewed evidence is absent. Construction features
  cannot be stored as colours or style. Simple feature searches/removals and
  short replies to the assistant's benefit question have deterministic handling;
  compound requests still use the validated interpreter.
- **Instrumentation:** optional impressions, outfit selections, ownership,
  rejections and add-to-cart signals have a strict event contract. Events contain
  no message text, customer identity, prices or purchase claims. Collection is
  disabled by default.

The main implementation is in `lib/search/stylingCompatibility.ts`,
`lib/search/productBenefits.ts`, `lib/stylist/commerceCatalogue.ts`, the
conversation modules, `ConversationChat.tsx` and `ShoppingProductResults.tsx`.

## Database changes required

Prepared migration:
[20261017020000_stylist_verified_features_and_events.sql](../supabase/migrations/20261017020000_stylist_verified_features_and_events.sql).

**Applied to the hosted ABC Fashion project on 17 October 2026 at 02:58–02:59
UTC.** Only this migration was pending and applied. It created two additive
tables and their access policies without overwriting existing products,
prices, inventory, images or pairing rules, and inserted no product facts.

1. `public.stylist_product_features` stores a product's feature value, evidence
   reference/version, review status, reviewer and review time. Public reads expose
   only verified facts for available products and exclude the reviewer field.
   Anonymous customers cannot create or approve facts.
2. `public.stylist_recommendation_events` stores minimal interaction signals.
   Browser clients cannot read or insert rows directly. The optional server
   endpoint writes with a server-only service-role key. Every row is labelled an
   untrusted browser signal.

Hosted verification confirmed the migration-history entry, both tables, foreign
keys/check constraints, RLS policies and role privileges. Public API checks allow
the approved feature columns while denying reviewer details and event reads.
The app's catalogue enrichment now returns `feature_data_status: available`.
The catalogue still contains 316 rows; both new tables have zero rows. No seeds,
custom role scripts or vault settings were applied. Interaction collection was
not enabled.

Evidence: [migration application](test-evidence/stylist-migration-apply-2026-10-17.txt),
[database verification](test-evidence/stylist-migration-verify-2026-10-17.json),
[public API and app verification](test-evidence/stylist-migration-api-2026-10-17.json).

### Product information the merchant needs to provide

Supported initial facts:

- `lining`, `adjustable_strap`, `pockets`, `zip_closure`, `machine_washable`:
  actual boolean values, including reviewed `false` when absence is confirmed.
- `capacity_litres`: a positive number in litres.
- `use_cases`: one to twelve documented, nonempty use-case labels.

Each fact needs an existing product ID, a public-safe supplier/catalogue evidence
reference, a source version and review status. Publishing as `verified` also
requires `reviewed_by` and `verified_at`. Never use an access token or private
document link as the public evidence reference. The app validates value types
and ignores malformed/unverified records.

Start with a small set of real substitute products and verify the same feature
on both sides. For example, the comparator can establish adjustable-strap value
only when the original is reviewed as `false` and the replacement as `true`.
An unknown original cannot establish that improvement. The test fixtures are
synthetic and must not be imported as catalogue facts.

The follow-up source audit and preparation workflow are documented in
[product-feature curation](stylist-feature-curation.md). A 12-product starter
intake and an evidence-gated SQL preparation tool are ready. No supported
construction/functional facts were found in the available source material;
the prepared intake therefore contains unknown draft values, not approved claims.

Outfit selection and basic pairing work without these new tables. During live
testing before migration, the feature table reported `not_configured`;
feature-based requests therefore abstained rather than inventing facts. After
migration, the table is available but empty. Existing label-based contextual
comparisons remain available where justified. Reviewed product data is still
required to produce feature-based upsells.

### Configuration

- `STYLIST_COMMERCE_ENABLED=true` is the default. Set it to `false` to pause new
  cross-sell/value comparisons through the active conversation endpoint. This is
  a pause switch, not a switch back to a separately maintained legacy ranker.
- Leave `STYLIST_ANALYTICS_ENABLED=false` until the migration is applied and event
  collection is ready. To enable it, set it to `true` and configure
  `SUPABASE_SERVICE_ROLE_KEY` on the server only. Never prefix that key with
  `NEXT_PUBLIC_`.

Telemetry is best effort and never blocks cart actions. It has same-origin and
payload checks, duplicate event protection and a process-local rate limit.
Anonymous IDs can be forged; these events must not be treated as authoritative
purchases or a sufficient training dataset. Order/return attribution and shared
infrastructure rate limiting are later work.

## Verification

- All **26 offline suites passed**, including 30 commerce checks, 8 telemetry
  checks and 12 offline production-route checks. Synthetic fixtures verify
  actual feature-based upgrades, same/cheaper alternatives, missing evidence,
  trade-offs, budgets, stock and rejection/outfit persistence.
- Full ESLint, TypeScript and the Webpack production build passed. Webpack was
  used because the environment blocks the Turbopack worker binding path.
- The live development-server journey passed **15/15 requests**, using the
  configured model and real catalogue. This verifies integration, not expert
  styling quality or commercial uplift.
- The final built production server passed **15/15 live journey requests** and
  **11/11 production HTTP checks**, including request validation, same-origin
  handling, cancellation and retry behaviour.
- Browser verification confirmed keeping the navy dress, retaining it in the
  outfit summary, requesting shoes and displaying the pairing explanation.
  Catalogue photographs were unavailable in that browser session; placeholders
  did not enter compatibility scoring.

Evidence:
[offline regression](test-evidence/regression-2026-10-17T02-18-26-333Z.txt),
[development live journey](test-evidence/commerce-live-2026-10-17T02-15-43-209Z.json),
[final production live journey](test-evidence/commerce-live-2026-10-17T02-20-29-063Z.json),
[production HTTP checks](test-evidence/commerce-production-http-2026-10-17.txt),
[production build](test-evidence/commerce-production-build-2026-10-17.txt),
[browser screenshot](test-evidence/stylist-commerce-ui-2026-10-17.jpg).
Earlier failed live runs are retained as debugging evidence. They exposed the
short-benefit continuation and misplaced-feature interpretation issues addressed
in this change.

## Try it yourself

Use a new chat and send these in order:

1. “Show me dresses for a beach wedding under $150.”
2. “Keep the first dress for my outfit.”
3. “Find shoes to go with my dress.”
4. “Why would you suggest the first product with my outfit?”
5. “I already own a bag.”
6. “No extras.”

For feature/value behaviour, use another new chat:

1. “Show me dresses under $150.”
2. “Compare a replacement for the second dress with adjustable straps.”
3. “Pockets would be useful.”

The product reference and budget should remain in place. Without reviewed facts,
the answer should explain that a benefit could not be established. After real
facts are loaded, inspect the comparison's before/after values and extra cost.

Also try “Show me bags with pockets”, followed by “Remove my pockets requirement
and show me bags”. The first must require verified pockets; the second should
remove that requirement and return ordinary eligible bags.

## What still needs merchant validation or a later release

The compatibility baseline uses transparent heuristics, not a trained visual
stylist. Its initial weights are: explicit occasion +8/−6; otherwise each
anchor's occasion +6/−4; style +4/−1; season +1/−2; related palette +2 or neutral
+1. Missing evidence is not a confirmed match. These weights and the palette
families need merchant review and a held-out expert-labelled outfit benchmark
before claiming improved taste or recommendation accuracy.

Reviewed facts/curated outfits, expert benchmark collection, source-conflict
review, richer measurements/construction evidence, final shortlist diversity,
whole-outfit budget solving, learned/visual ranking, authoritative sales/return
attribution and controlled commercial experiments remain later stages of the
plan. Whole-outfit total requests still require clarification rather than being
misrepresented as a per-item budget. Outfit memory currently lives within the
chat session, not a persisted customer wardrobe.
