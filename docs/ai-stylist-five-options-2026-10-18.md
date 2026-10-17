# Five options per product group — 18 October 2026

The recommendation cap is now five products per requested group. For a dress and shoes request, this allows up to five dresses and five pairs of shoes. Actual counts depend on available matching stock and the shared budget. Every combination choosing one item per group remains within that budget. Optional follow-up questions and memory of three understood prompts remain active.

The shared constant now controls search, grouped reply validation and result/context capacity (up to twenty cards across four groups). Fifth-item references work for product questions and pending clarifications. Client/API analytics validation accepts position five.

## Verification

| Check | Result |
| --- | --- |
| Offline regression | 31/31 suites passed, including 17 grouped discovery/memory checks |
| Controlled plentiful inventory | Exactly five products per group; fifth dress/shoe references and twenty-product context passed; a sixth option was rejected |
| Customer scenarios using recorded model plans and fresh execution | 75/75 passed; these are replays, not 75 fresh model calls |
| Live local HTTP, real model and catalogue | 6/6 passed: initial request, unclear intent, unaffordable total, restored budget, material question and three-piece request |
| ESLint | Passed |
| Production build | Passed using `npm run build -- --webpack`, including TypeScript |

The initial live probe returned four dresses and four shoe options and failed an overly strict expectation of exactly five. The test now permits one to five because available products and the combined budget can restrict the count. Exactly five is verified separately with controlled inventory.

The default Turbopack build could not finish in this environment: the first attempt could not fetch Google Fonts; the network-enabled retry hit a blocked internal port bind. The supported webpack builder completed successfully.

No shared database changes were applied. If optional stylist analytics is enabled, apply `supabase/migrations/20261018010000_stylist_five_choices.sql` before deployment so the database also accepts fifth-position events. The migration was added but was not executed against a database in this task.

Evidence: [regression](test-evidence/five-options-regression-2026-10-18.txt), [scenario replay](test-evidence/five-options-scenarios-2026-10-18.txt), [live HTTP](test-evidence/five-options-live-2026-10-18.txt), [lint](test-evidence/five-options-lint-2026-10-18.txt), [production build](test-evidence/five-options-build-webpack-2026-10-18.txt).
