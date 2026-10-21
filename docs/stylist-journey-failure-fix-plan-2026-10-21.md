# Stylist journey evaluation and fix plan

Evaluated on 21 October 2026. Scope: the two saved runs below, the current conversation/search implementation, and targeted offline probes. This document proposes fixes; no application changes or new live model calls were made.

## Results and confidence

- [Everyday summary](test-evidence/stylist-journeys/2026-10-20T00-20-20-593Z-everyday/summary.json): **7 AUTO_PASS, 1 FAIL, 2 BLOCKED_CATALOGUE, 0 ERROR** across 10 journeys. J18 fails; J02 and J16 are blocked.
- [Prerelease summary](test-evidence/stylist-journeys/2026-10-20T00-25-15-829Z-prerelease/summary.json): **34 AUTO_PASS, 9 FAIL, 7 BLOCKED_CATALOGUE, 0 ERROR** across 50 journeys. The 34 passes comprise 29 live conversations and five controlled offline recovery cases.
- The everyday definitions are a subset of prerelease. These are 60 trials across 50 distinct journeys, not 60 distinct journeys. J18 fails in both runs at the same correction.
- Both runs used opening variant 1 once, the same recorded commit, pack hash and interpreter hash. The current interpreter hash still matches. Neither run records the actual server model or a catalogue snapshot reference.
- Prerelease attempted 89 of 101 planned live turns. **12 follow-up turns were never executed** because their journeys stopped earlier. In particular, J32 never reached “Yes,” J44 never reached conflict resolution, and J45 never sent the injection prompt. J14/J16/J21 also did not reach their intended edits. Everyday has one unexecuted follow-up.
- Every human review is PENDING. An AUTO_PASS establishes only the assertions exercised; it does not establish visual suitability or browser recovery.

## Failure evaluation

### J12 — “Cheaper” clears the saved A$200 cap

[Evidence](test-evidence/stylist-journeys/2026-10-20T00-25-15-829Z-prerelease/J12-v1-run1.json), turn 2: the skirt/Work identity survives, but `state.scopes.item.max_price` changes from 200 to null. Four alternatives are displayed and the reply says the original request is still saved.

**Confirmed validation gap:** an offline probe passed a `cheaper` candidate containing `max_price=null` with evidence “cheaper” through `checkConversationPlan`; it was accepted as ready for validation. The original rejected/generated plans are absent from the evidence, so this proves the gap rather than the precise original model output.

**Fix:** require explicit permission to clear a saved price limit, as already done for colour clearing. A relative “cheaper” request should preserve the persisted cap and apply a separate strict reference-price ceiling during search. Keep the skirt family and Work occasion; disclose occasion differences on alternatives.

**Touchpoints:** `lib/stylist/conversationPlan.ts`, `lib/stylist/conversationGrounding.ts`, `lib/stylist/conversationSearch.ts`, `lib/search/cheaperSearch.ts`.

**Acceptance:** cap remains 200 after “Show cheaper skirts, keeping work”; every displayed alternative is a skirt below the reference price and within the cap. Also cover an explicit lower cap, explicit budget removal, and an unrelated category change.

### J15 — travel total is lost and travel context becomes a blocker

[Evidence](test-evidence/stylist-journeys/2026-10-20T00-25-15-829Z-prerelease/J15-v1-run1.json), turn 1: `goal=travel_layers` and warm/cool guidance are saved, but the A$300 total is null. The reply blocks on an unverified “travel” requirement. The shirt-and-jacket turn is unexecuted.

**Confirmed:** `statedCombinedBudget` returns null for “A$300 for all new pieces together.” `updateShoppingBrief` relies on this helper.

**Fix:** extend the combined-budget parser with clause-bound evidence for “for all new pieces together,” “for both together,” and equivalent wordings. Retain travel layering as a goal/guidance; ordinary travel context should not create a certification blocker. Explicit weatherproofing, warmth or comfort requirements must still retain their verification limits.

**Touchpoints:** `lib/stylist/combinedShoppingRequest.ts`, `lib/stylist/shoppingBrief.ts`, `lib/stylist/conversationGrounding.ts`, `lib/stylist/discovery.ts`.

**Acceptance:** the first turn retains total 300 and both guidance phrases; the next turn produces two requested groups sharing that total. Cover all three openings and distinguish “A$300 each” from a combined total.

### J18 — a valid shoe-size correction falls into interpretation failure

[Prerelease evidence](test-evidence/stylist-journeys/2026-10-20T00-25-15-829Z-prerelease/J18-v1-run1.json) and [everyday evidence](test-evidence/stylist-journeys/2026-10-20T00-20-20-593Z-everyday/J18-v1-run1.json), turn 2: size remains 999 after “Change the shoe size to 7. Keep black and A$150.” Both return `interpretation_failed`.

**Confirmed distinction:** `explicitSizeEdit` already extracts 7 correctly. This is not a missing size-regex case. The recorded initial vocabulary includes 7; the number of eligible black shoes still needs catalogue verification. The precise plan-rejection rule is not saved.

**Fix:** capture the rejection first, then correct the model/validator disagreement. For a fully understood correction to an active invalid-size issue, consider a narrow deterministic path that applies the explicit edit and runs normal catalogue validation. Preserve black and A$150. Never convert an arbitrary failed interpretation into a partially guessed search.

**Touchpoints:** `lib/ai/interpretConversation.ts`, `lib/stylist/conversationPlan.ts`, `lib/stylist/conversationTurn.ts`, `lib/stylist/sizeEdit.ts`.

**Acceptance:** size becomes 7; the old invalid-size issue clears; black and 150 remain; eligible size-7 shoes appear on a pinned catalogue. Also cover another invalid correction, negation, size removal and a correction with an additional constraint.

### J23 — comparing future results blocks the explicit search edits

[Evidence](test-evidence/stylist-journeys/2026-10-20T00-25-15-829Z-prerelease/J23-v1-run1.json), turn 2: both blue and A$150 are lost from the applied state. They are present in `pending_answer.follow_up`, so the edits were understood but deferred.

**Confirmed:** the pending compare intent references Burgundy Maxi Dress plus generic `context`. Resolving this against the old five-item shortlist produces “More than one product could match.” The current answer-first branch blocks the shopping action. The requested second side is the new blue results, which do not exist yet.

**Fix:** represent this dependency explicitly: resolve the named existing product, run the validated blue/A$150 search, then compare the returned IDs with that reference using recorded facts. Keep genuine ambiguity checks for an unclear existing product and preserve J25’s deferred compound-request behavior.

**Touchpoints:** `lib/stylist/answerPlan.ts`, `lib/stylist/conversationAnswers.ts`, `lib/stylist/conversationTurn.ts`, `app/api/conversation-search/route.ts`.

**Acceptance:** state retains blue/150; returned cards satisfy both; the answer compares the new cards to the exact original product. Add a semantic assertion for the comparison—filter assertions alone cannot certify that it was answered.

### J29 — selected-purchase budget is never established

[Evidence](test-evidence/stylist-journeys/2026-10-20T00-25-15-829Z-prerelease/J29-v1-run1.json), turn 3: the A$120 Burgundy Maxi Dress is correctly saved as selected. The shoe request then returns `interpretation_failed`, with no `purchase_budget`.

**Confirmed additional defect:** the existing helper returns null for “A$400 is the total for the dress and new shoes together.” Fixing interpretation alone will not fix this arithmetic path.

**Fix:** share the budget-parser repair with J15; resolve the kept dress as an existing selected purchase and shoes as the new item. Feed the verified total into `preparePurchaseBudget`, refresh the selected dress’s price, and subtract it once. Do not request a second new dress or transfer its old per-item cap to shoes.

**Touchpoints:** `lib/stylist/combinedShoppingRequest.ts`, `lib/stylist/conversationGrounding.ts`, `lib/stylist/purchaseBudget.ts`, `lib/stylist/conversationSearch.ts`.

**Acceptance:** with the recorded dress price, limit=400, fixed=120 and remaining=280; every new shoe fits the remainder. Recalculate if price changes; owned pieces contribute zero; unavailable selected pieces require clarification.

### J32 — the combined-budget question is never reached

[Evidence](test-evidence/stylist-journeys/2026-10-20T00-25-15-829Z-prerelease/J32-v1-run1.json), turn 1: the opening returns `interpretation_failed`. The prescribed “Yes” is unexecuted, so these runs do not yet prove a confirmation loop.

**Fix:** repair interpretation of the external owned dress plus two new components. Persist a combined-budget confirmation with amount 200, shoes/bag components and the external anchor. Ask a yes/no proposition such as “Is A$200 the total for both the shoes and bag?” Resolve “Yes” against that saved proposition. An either/or question cannot reliably accept “Yes.”

**Touchpoints:** `lib/stylist/conversationPlan.ts`, `lib/stylist/conversationTurn.ts`, pending-state schemas in `lib/stylist/conversationProtocol.ts` as needed, `lib/ai/interpretConversation.ts`.

**Acceptance:** opening asks the intended budget question without cards; “Yes” yields two groups under 200, preserves the owned external dress at zero purchase cost, and does not ask again. Test “No, A$200 each” separately and strengthen the harness beyond its current keyword check.

### J39 and J42 — product-specific policy questions fail before answering

[J39 evidence](test-evidence/stylist-journeys/2026-10-20T00-25-15-829Z-prerelease/J39-v1-run1.json), turn 2: “Can Burgundy Maxi Dress arrive by Friday?” returns `interpretation_failed`; the next material question is unexecuted.

[J42 evidence](test-evidence/stylist-journeys/2026-10-20T00-25-15-829Z-prerelease/J42-v1-run1.json), turn 2: returns/postage for Black Shoulder Bag returns `interpretation_failed`; the PayPal question is unexecuted.

**Known:** grounded delivery, returns and payment answers already exist in `conversationAnswers.ts`. Exact rejection causes remain unknown. One contract boundary to inspect is that `kind=policy` forbids product references, while these questions name products and the journey expects the corresponding product ID.

**Fix:** capture rejection diagnostics and align interpretation with the supported product-question/policy-topic representation, or explicitly extend the contract if necessary. Preserve named-product grounding and shopping memory. Use the existing policy source: disclose delivery-date uncertainty, state the published returns window with eligibility/postage limits, and keep unverified payment methods unknown.

**Touchpoints:** `lib/ai/interpretConversation.ts`, `lib/stylist/conversationPlan.ts`, `lib/stylist/conversationAnswers.ts`, `lib/stylist/answerPlan.ts`.

**Acceptance:** both product-specific questions return `answered` with the correct product IDs and grounded limitations. J39’s material follow-up still resolves the dress; J42’s payment follow-up answers without inventing PayPal support.

### J44 — “for all searches” is incorrectly item-local

[Evidence](test-evidence/stylist-journeys/2026-10-20T00-25-15-829Z-prerelease/J44-v1-run1.json), turn 1: black is saved only on the item; shared colours remain empty. The later conflict and removal turns are unexecuted.

**Confirmed:** grounding an explicitly shared Black candidate with this exact opening demotes it to item scope. The `allItems` matcher omits “all searches”; other scope matchers use different phrase lists. Also, grounding trims to the later “Show me…” clause for some fields, losing earlier rule context.

**Fix:** use one consistent detector for explicit global scope, including all journey variants. Preserve the scope of each instruction across clauses. A shared black rule must survive a category change and require explicit resolution when a new item requests blue.

**Touchpoints:** `lib/stylist/conversationGrounding.ts`, `lib/stylist/conversationPlan.ts`, `lib/stylist/preferenceScope.ts`.

**Acceptance:** first turn saves shared Black; second reports `shared_conflict` with no cards; third removes only that rule and applies blue/200. The initial black-dress prerequisite must also be satisfied to execute the whole journey.

## Catalogue blockers and missing coverage

These seven prerelease outcomes are unresolved prerequisites, not confirmed search defects:

- **J02:** zero blue dresses for Beach Wedding under A$200 after refinement.
- **J07:** zero silver necklaces under A$100.
- **J14:** zero women’s blue dresses, size 10, under A$200; the switch to bags is untested.
- **J16:** zero women’s black dresses, size 10, under A$200; the blue edit is untested.
- **J21:** zero women’s black dresses under A$200; colour relaxation is untested.
- **J28:** no complete black size-10 dress / silver size-7 shoes Formal set under A$500. The response identifies the dress component as missing; audit both components and the total independently.
- **J45:** zero women’s black dresses under A$150; injection resistance is untested.

The saved [17 October catalogue audit](test-evidence/customer-catalogue-2026-10-17T04-01-13-359Z.json) also has zero eligible rows for the relevant black-dress, blue size-10 dress, silver-necklace and blue beach-dress queries. This supports an inventory explanation but is older than the runs and cannot establish their exact stock.

**Action:** take a read-only snapshot and independently count saleable rows after each requested filter: identity, collection, colour, size, occasion and price. Compare that oracle with search output. If eligible rows exist, fix retrieval/filtering; if not, supply suitable data in an isolated test catalogue. Preserve the original briefs and no-match evidence. Do not silently relax production filters or mark no-match as success. Add a preflight for stock-dependent cases, including J18, J23 and J44 after their code fixes.

**Touchpoints:** `scripts/audit-customer-scenario-catalogue.mjs`, `scripts/fixtures/stylist-journeys.mjs`, `scripts/lib/stylist-journey-harness.mjs`, `lib/search/preferenceSearch.ts`, `lib/search/outfitBudgetSearch.ts`.

## Implementation order

1. **Capture reproducible diagnostics and prerequisites.** Reproduce J18/J29/J32/J39/J42 with `STYLIST_DIAGNOSTICS_ENABLED=true` on the app server. Existing `plan_rejected` events report request ID, attempt, type, field and rule. Save those sanitized events beside fresh evidence; do not retain secrets or hidden model reasoning. Record the actual server model, feature flags, all changed-source hashes/dirty-tree state, and catalogue snapshot hash. Runner environment labels alone do not verify the server configuration.
2. **Protect customer constraints first.** Fix J12 budget clearing and J44 global-scope loss, with failing offline regressions before the implementation. These can change what the customer’s later searches are allowed to return.
3. **Repair combined-budget parsing and accounting.** Fix the shared helper for J15/J29 with positive, negated, per-item and unrelated-price cases. Then repair the travel flow, selected-purchase routing and J32 confirmation state. Keep accounting in integer cents.
4. **Repair interpretation and dependent answers.** Use the captured rules to fix J18/J39/J42; add J23’s search-then-comparison flow. Keep validation and the bounded repair limit; increasing retries or weakening evidence checks should not substitute for identifying the rejected contract.
5. **Complete coverage and verify release behavior.** Satisfy the isolated catalogue prerequisites, execute every skipped follow-up, add semantic/product-family assertions, and run the checks below. Do not rewrite the historical evidence as passed.

## Verification and completion criteria

Add targeted regressions to the existing plan-recovery, conversation-answer, recovery, grouped-budget and journey-harness suites. Test rejected candidates and state transitions as well as hand-authored successful plans. In particular, assert skirt/shirt/trouser families where only manual review currently covers them, and check all parts of compound and policy answers.

After implementation, run:

```sh
npm run test:journeys:check
npm test
npm run typecheck
npm run lint
npm run build

# App server running with recorded diagnostics/model and audited test catalogue:
npm run test:journeys:prerelease -- --filter J12,J15,J18,J23,J29,J32,J39,J42,J44 --variant all --repeat 3
npm run test:journeys:everyday
npm run test:journeys:prerelease -- --variant all --repeat 3
```

The targeted live command runs 81 conversations. The full repeated prerelease command runs 405 live conversations plus five controlled recovery cases and incurs model usage. These are proposed implementation checks; they were not run during this evaluation.

Completion requires all nine failed definitions passing across the targeted openings/repeats, no unresolved catalogue blockers in the audited acceptance environment, and every prescribed follow-up executed. Recheck the original seven blocked journeys after catalogue setup. Review the actual replies/cards for comparisons, policy limits, pairing claims and provisional disclosures. Perform browser checks for retry, cancellation, duplicate send and New chat; the five controlled fault passes do not replace those checks.

## Checks performed for this evaluation

- Read both summaries and the executed failed/blocked transcripts; checked the fixture definitions and execution/validation paths.
- Re-evaluated every explicit assertion on the nine failed prerelease journeys. This exposed J23’s additional missing A$150 edit beyond the first reported colour failure.
- Reproduced the J15/J29 budget-parser gaps, J44 shared-to-item demotion, J12 permissive budget clearing, and J23 ambiguous old-context resolution offline. Confirmed that J18’s size parser already recognizes 7.
- Ran `node --import tsx scripts/test-stylist-journey-harness.mjs`: **13 checks passed**.
- Ran `node --import tsx scripts/test-plan-recovery.mjs`: **10 checks passed**. These existing passes show that the known failing live wordings are not sufficiently covered by the current offline checks.
- No live catalogue query, new model run, application implementation change or browser acceptance test was performed.
