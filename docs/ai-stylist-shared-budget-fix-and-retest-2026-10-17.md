# AI Stylist: shared outfit budget fix and retest

Date: 17 October 2026. Changes are local and have not been deployed.

## Result

The request **“I want a dress and shoes for formal events, my budget for both of
them is 400 aud”** now produces a complete, available set within A$400.

The production HTTP and browser checks returned:

| Component | Actual catalogue ID | Price |
| --- | --- | ---: |
| Cream Slip Dress | P1021 | A$75.00 |
| Red Block Heels | P1085 | A$60.00 |
| Combined total | | **A$135.00** |
| Budget remaining | | **A$265.00** |

Both products have a recorded Formal occasion. These are catalogue results,
not the synthetic acceptance fixtures. Returning an affordable set does not
require spending the entire allowance.

## Cause and implementation

Previously, the interpreter explicitly marked a whole-outfit total as
unsupported. The unresolved requirement then blocked retrieval. The response
incorrectly suggested that the catalogue information was the obstacle.

The interpreter now represents 2–4 explicitly named components with one total
AUD budget. Each component has its own preferences, including colour, size,
category and any per-item price restrictions. Common outfit context stays
separate from global restrictions across future searches.

`lib/search/outfitBudgetSearch.ts` validates each component, filters actual
stock and required attributes, and searches complete combinations using integer
cents. It considers candidates beyond the usual four-card shortlist, preventing
a feasible cheaper item from disappearing before combination checking. It
returns one lowest-priced eligible set with a different product for each
component. A missing component or excessive combined price returns no match;
the search never silently omits a requested piece.

The conversation response includes a validated total, allowance and remainder.
The browser labels the cards as one complete set and uses each component's
preferences for size selection. Budget refinements retain the other components
and requirements. A new single-item search clears the combined request.

Two follow-up defects found during testing were also fixed:

- A budget restoration after no match could be incorrectly labelled as a
  continuation of a pending question. It now remains a normal refinement.
- “What material is the dress in this set?” could treat all displayed products
  as ambiguous context. It now resolves the unique dress in a mixed-item set.

## Final verification

| Check | Result | Evidence |
| --- | --- | --- |
| Expanded acceptance pack: 24 scenarios × 3 runs | **72 pass, 0 fail, 0 blocked, 0 feature gap** | [Summary](test-evidence/customer-scenarios-2026-10-17T05-58-21-970Z/summary.json) |
| Offline regressions | **30/30 suites pass**, including 17 new outfit-budget checks | [Log](test-evidence/outfit-budget-verified-regression.txt) |
| Production HTTP with real model and public catalogue | **5/5 pass**, all HTTP 200 | [Recorded replies](test-evidence/outfit-budget-http-2026-10-17T05-59-33-612Z.json) |
| Browser: exact customer request | Complete dress/shoe set, A$135 total, A$265 remaining | [Screenshot](test-evidence/outfit-budget-browser-2026-10-17.png), [accessibility text](test-evidence/outfit-budget-browser-2026-10-17.txt) |
| ESLint | Pass | [Log](test-evidence/outfit-budget-verified-lint.txt) |
| Production webpack build, including TypeScript | Pass | [Log](test-evidence/outfit-budget-verified-build.txt) |
| Diff whitespace check | Pass | `git diff --check` |

The final acceptance run executed 213 turns: 198 used the configured real model
(`gpt-5.6-luna`, low reasoning), and 15 used existing production shortcuts.
It ran from 05:58:21 to 06:01:31 UTC (16:58–17:01 Sydney time). Median complete
turn latency was 2,551 ms; p95 was 4,502 ms. These fixture-run timings exclude
HTTP and live database overhead.

The original 20 scenarios passed all 60 repeats. The four new shared-budget
scenarios passed all 12 repeats. They cover the exact customer request, lowering
and restoring its total, an outfit material question, individually affordable
items whose sum exceeds the allowance, separate dress/shoe colours and sizes,
and a three-piece outfit.

The production HTTP checks independently read the 316-row public catalogue and
verified returned product IDs, prices, availability, stock and Formal occasion.
They covered the original request, an A$1 no-match limit, restoration to A$400,
the dress material question, and a three-piece set (A$185 total). No automatic
cart changes occurred.

All new scenario transcripts are available in the
[readable transcript report](ai-stylist-shared-budget-retest-transcripts-2026-10-17.md).
Every raw input, plan, reply and state is retained in the acceptance evidence
directory. Earlier development runs are also retained: one intermediate
72-run test had a budget-continuation failure, which the final run resolves.
The first network attempt was blocked by the sandbox; the network-enabled
retest completed. Some invalid first model plans were rejected and corrected by
the existing bounded retry; the final acceptance results include those retries.

## Remaining boundaries and improvements

- The implemented request contains 2–4 named pieces and a maximum combined
  product-price budget. An unspecified “complete outfit” still needs the
  customer to name the pieces. This does not establish support for arbitrary
  outfit requests beyond those boundaries.
- Ranking currently returns one lowest-priced eligible complete set. A useful
  next improvement is to offer several complete sets and rank their recorded
  colour/style compatibility while preserving every item and the exact total.
- Formal occasion and other recorded requirements are checked, but human
  review is still needed for visual coordination, taste and real-world fit.
- Sample product photos showed the existing “Photo unavailable” placeholder
  in the browser. Photo availability was not repaired by this budget change.
- The acceptance fixture proves separate sizes and colours independent of
  current inventory. Live requests can still correctly return no match when
  the requested sizes or combinations are unavailable.

Source identity: [tested-source manifest](test-evidence/outfit-budget-source-manifest-2026-10-17.json),
combined SHA-256 `939ee373db65088f21f8fdfc2a267872445c82dec789e47173e098163d2778f8`.
Fixture SHA-256: `dd81adf1e124d95f72805c0b6a37d8fd6249b56cedd63fe8ee88b8c5b361fa27`.
