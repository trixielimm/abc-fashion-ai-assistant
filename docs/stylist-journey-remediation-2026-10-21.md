# Stylist journey fixes and verification

Implemented and verified on 21 October 2026, following the [failure fix plan](stylist-journey-failure-fix-plan-2026-10-21.md).

## What changed

- **Budget memory:** “cheaper” cannot erase a saved cap. Combined totals support “for all new pieces together” and “is the total.” Trailing caps such as “A$200 max please” and “150 AUD maximum” are grounded even when omitted by the model.
- **Selected versus owned pieces:** selected catalogue purchases consume the combined budget at their current recorded price; owned pieces remain styling anchors with zero new purchase cost. A request for shoes does not rebuild or charge for a second dress.
- **Clarification recovery:** valid size corrections leave the stale pending action and resume the saved search. Combined-budget questions save the components and amount, accept “Yes,” and support an explicit per-item correction.
- **Compound comparisons:** the search applies the requested colour and cap before comparing its results with the named original. A genuinely ambiguous original still requires clarification and resumes the saved search afterwards.
- **Policy answers:** named-product delivery/returns questions use the product reference and grounded policy topics instead of failing the general-policy schema.
- **Global rules and context:** “for all searches” stays shared; conflicting local colours produce a typed conflict. Work skirts and beach-wedding briefs retain their occasion. Optional browsing wording does not erase the earlier garment, collection or budget.
- **Additional regressions found during reruns:** reaffirming firm limits after no-match stays understood; provisional browsing retains unknown requirements and labels them on every card; cheaper searches accept all five displayed references.

## UI improvements

- A persistent, expandable **Your saved search** summary shows the current item, size, colour and price limits, with a separate shared-rules indicator and unverified details.
- Invalid-size responses offer **listed size buttons**, filtered to the requested category, with a fit/stock limitation beside them.
- Shared colour conflicts offer **Keep Black rule** and **Remove shared colour rule** controls.
- Interpretation failures offer **Edit my last message**.
- Combined-budget questions offer enabled **Yes, combined total** and **Budget is per item** buttons while the clarification is pending.

The existing responsive styling, product cards and cart controls remain in use.

## Verification results

- **Offline regression:** 44/44 scripts passed, including 16 new remediation checks and strengthened independent family/comparison checks. [Final output](test-evidence/stylist-remediation-2026-10-21/offline-complete.txt).
- **Typecheck and lint:** passed. [Typecheck](test-evidence/stylist-remediation-2026-10-21/typecheck-complete.txt), [lint](test-evidence/stylist-remediation-2026-10-21/lint-complete.txt).
- **Production build:** passed using the supported webpack builder. The default Turbopack builder encountered an environment port-binding restriction after the sandboxed attempt could not fetch Google Fonts. [Successful final build](test-evidence/stylist-remediation-2026-10-21/build-complete.txt).
- **Everyday HTTP suite:** **8 AUTO_PASS, 0 FAIL, 0 ERROR, 2 BLOCKED_CATALOGUE**. The previous everyday run had 7 passes and one code failure. [Summary](test-evidence/stylist-journeys/2026-10-21-remediation-everyday-verified/summary.json).
- **Prerelease HTTP suite:** **41 AUTO_PASS, 0 FAIL, 0 ERROR, 9 BLOCKED_CATALOGUE**. The previous run had 34 passes and nine code failures. [Summary](test-evidence/stylist-journeys/2026-10-21-remediation-prerelease-verified/summary.json).
- **Isolated live-model acceptance:** 18 journey definitions across all three opening wordings were checked. The broad 54-trial run passed 53 and exposed the “150 AUD maximum” omission in J45 wording 2. After that fix, all three J45 wordings passed. All three J23 wordings also passed after the ambiguity-resumption guard. The latest result for each of the 54 journey/wording combinations is a pass. This combines targeted reruns across source revisions; it is not a single unchanged-code benchmark. [Broad run](test-evidence/stylist-remediation-2026-10-21/diagnosis-acceptance-verified.json), [J45 rerun](test-evidence/stylist-remediation-2026-10-21/diagnosis-budget-suffix-complete.json), [J23 rerun](test-evidence/stylist-remediation-2026-10-21/diagnosis-comparison-complete.json).

The isolated acceptance data is loaded only by the diagnostic script. These tests made real model calls against synthetic catalogue fixtures and did not change the shared catalogue. They cover the follow-ups that real-stock blockers prevent from executing, including the injection probe.

The broad HTTP run started before the final comparison-ambiguity and AUD-suffix guards. Those guards have dedicated offline checks and focused live reruns. Original per-run source hashes are preserved; the [consolidated results](test-evidence/stylist-remediation-2026-10-21/results-summary.json) record the final hashes and the three changed files. The final full offline suite, typecheck, lint and webpack build include those guards.

## Remaining catalogue blockers

Prerelease blockers are **J02, J07, J14, J16, J21, J23, J28, J44 and J45**. Everyday blockers are **J02 and J16**.

The new read-only audit found 318 visible products, 316 saleable products, and zero eligible rows for the blocked blue/black dress and silver-necklace requirements. The formal silver shoe size-7 prerequisite is also absent. It found two eligible black women's shoes in size 7 under A$150, supporting the repaired J18 flow. [Audit and product IDs](test-evidence/stylist-remediation-2026-10-21/catalogue-audit.json).

J23 now preserves Blue and A$150, and J44 saves shared Black; both are stock-blocked in the shared catalogue rather than failing their original state assertions. These outcomes should remain blocked until suitable real catalogue data is available. Constraints were not relaxed to make the tests pass.

## Browser smoke checks

Checked the actual local app at a narrow viewport:

- Invalid size 999 displayed listed-size recovery controls; a size-button correction returned products. An explicit correction to 7 retained Black and A$150 and returned size-7 shoes.
- New chat cleared the earlier search and clarification state.
- The combined-budget button completed the owned-dress/shoes/bag flow. The suggested combination cost A$155, and the displayed combinations stayed within A$200.
- Shared Black plus local Blue displayed a conflict and both resolution controls. Removing only the shared colour rule retained Blue and A$200; the remaining no-match was consistent with the stock audit.

[Size result](test-evidence/stylist-remediation-2026-10-21/browser-size7.png) · [Budget confirmation](test-evidence/stylist-remediation-2026-10-21/browser-budget-confirmation.png) · [Budget results](test-evidence/stylist-remediation-2026-10-21/browser-budget-results.png) · [Shared conflict](test-evidence/stylist-remediation-2026-10-21/browser-shared-conflict.png) · [Resolved shared rule](test-evidence/stylist-remediation-2026-10-21/browser-shared-rule-resolved.png).

Human reviews in the journey reports remain PENDING. These checks do not certify visual compatibility for every outfit or real provider/database outage behavior. HTTP runs use the live catalogue and do not independently attest the server's model label; the in-process acceptance report records its configured model and catalogue/source hashes.
