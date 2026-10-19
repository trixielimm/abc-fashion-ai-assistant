# Independent investigation and full retest

19 October 2026 · Australia/Sydney

The [original recovery report](../conversation-recovery-fixes-2026-10-19/report.md) is supported within its stated scope: its 41 offline regression scripts pass again, its 14 recovery integration checks pass, and all 20 reported browser messages reproduce the described outcomes. Lint and a fresh Webpack production build, including TypeScript, also pass. **The full repository test set is not green:** 45 of 50 test scripts pass in their appropriate environments; five fail. The broader real-model acceptance suite records 103 passing and 11 failing scenario runs.

This investigation changes no application implementation, existing test assertions, product data, prices, photos or specifications. It adds this report, diagnostics and test evidence. No commit, deployment, cart addition or purchase was performed. Findings outside the original report's focused scenarios are not evidence that its changes introduced those defects.

## Provenance and execution

- All 144 application source hashes in the original final-build manifest match the current checkout. All 19 protected source files also match. See [source verification](source-verification.json).
- The existing production build is `FQZIyJthqvRvhqF_Pdtko` on port 3002. The fresh build is `mBaulyE7G8Gpj7Shbbeu9`, built from an isolated source copy and tested on port 3003. The original production build directory was preserved.
- The full real-model scenario run used the configured `gpt-5.6-luna`, 38 scenarios with the existing default of three repeats: 114 runs, 303 turns, 288 passing turn assertions and 15 failing turn assertions. It uses synthetic catalogue fixtures and the real domain pipeline, rather than HTTP/browser acceptance.
- Initial network-restricted attempts could not reach the model or localhost. Those attempts are preserved separately and excluded from application failure counts. Network-enabled reruns completed without blocked scenario runs.
- All 50 existing `scripts/test-*` scripts were invoked. Scripts that stop on their first assertion failure did not execute their subsequent checks; their failures are reported without claiming those remaining checks passed.
- The development-only recommendation API initially returned its expected production 404. Running its unchanged validation script against a development server passed all six checks. That environment mismatch is excluded from the five failing scripts.

## Results by suite

- **PASS — offline regression:** 41/41 scripts, including all 14 recovery integration checks. [Log](regression.log).
- **PASS — lint and production build:** ESLint clean; Webpack compilation, TypeScript and static generation succeeded. [Lint](lint.log), [build](build.log).
- **PASS — reported browser flows:** 20/20 messages, including four checks on the freshly rebuilt app. [Raw browser evidence](browser-evidence.json), [transcripts](transcripts.md), [individual outcomes](browser-results.json).
- **PASS — extraction:** blank-input validation and all six live extraction examples. [Log](extraction-network.log).
- **PASS — image reference tests:** storage boundaries, invalid references and expired URLs. [Log](product-images.log).
- **PASS — recommendation API validation:** 6/6 in development. [Log](recommendation-validation-development.log).
- **PASS — live search/filter tests:** 31 checks, including facet counts, paging, invalid inputs and rendered filter recovery. [Log](test-search-filters-live.mjs.log), [raw results](docs/test-evidence/search-filters-live-2026-10-18.json).
- **FAIL — real-model scenarios:** 103/114 runs pass; 11 runs fail across `S5-B`, `B5`, `CAT-E`, and `SET-A/B/C`. [Log](customer-scenarios-network.log), [full scenario evidence](../../test-evidence/customer-scenarios-2026-10-19T07-30-48-350Z/summary.json).
- **FAIL — live conversational answers:** 20/21 attempted requests pass, with one failing scenario. [Log](answers-live-network.log), [raw results](../../test-evidence/answers-live-2026-10-19T07-30-51-298Z.json).
- **FAIL — live commerce:** 14/15 requests pass; the delivery interjection fails. [Log](test-stylist-commerce-live.mjs.log), [raw results](../../test-evidence/commerce-live-2026-10-19T07-33-03-733Z.json).
- **FAIL — live outfit budget:** the first response returns valid grouped matches but fails the script's unconditional `optional_question` assertion. Later requests in that script are not run. [Log](test-outfit-budget-live.mjs.log), [raw results](../../test-evidence/outfit-budget-http-2026-10-19T07-32-55-861Z.json).
- **FAIL — prototype specifications:** the initial hard-coded catalogue-count assertion expects 316 and receives 318. Its later specification and conversation checks are not run. The read-only audit below identifies the extra records and missing specifications. [Log](test-prototype-specs-live.mjs.log), [catalogue audit](catalogue-audit.json).

## Application findings

### 1. An explicit blue requirement can disappear

In `S5-B`, two of three runs omit `blue` from the initial model plan for “I need a blue dress for a beach wedding in size 10, under $150.” The resulting state has an empty `preferred_colours` list. The subsequent request explicitly says to keep blue as a requirement, but the second plan also omits it. A black replacement (`VB-BLACK`) is then returned alongside `VB-ELIGIBLE`. The following “Would this still meet…” question becomes ambiguous because two replacements are displayed.

Replaying the recorded plans against the current code reproduces the result without another model call. The positive-colour fallback in `lib/stylist/conversationGrounding.ts:340` and `:341` uses over-escaped dynamic regex strings, so it does not rescue ordinary “blue dress” language when the model omits the colour. A direct probe of the actual source expression confirms that it does not match the test sentence. This code is outside the changed lines in the original report's targeted patch. [Replay evidence](diagnosis.json), [regex probe](colour-regex-probe.json), [diagnostic log](diagnosis.log).

### 2. Budget refinements can lose the saved jacket reference

Five of nine `SET-A/B/C` refinement runs fail for “Make the combined budget 600 aud, keep the same pieces and jacket.” Four return an ambiguous-reference clarification; one exhausts interpretation repair.

In the four ambiguous cases, the existing outfit request already records `anchor_product_ids: ["SET-JACKET"]`, but the model supplies `reference: { kind: "context" }`. Reference resolution asks the shopper to choose between the newly displayed bottoms and shirt. The retained anchor is appended later and does not clear the earlier clarification. The relevant resolution order is in `lib/stylist/conversationPlan.ts:486`. A diagnostic replay with only the reference changed to the existing jacket ID returns matches while retaining the budget and pieces. This isolates the reference handling problem without changing the application. [Replay and comparison](diagnosis.json).

### 3. Delivery questions can exhaust interpretation repair

The answer suite fails after dress browsing and a recommendation explanation, when “Can this arrive by Friday?” returns `needs_clarification` with an `interpretation_failed` issue instead of the supported delivery-policy answer. A focused rerun fails in the same place; the commerce suite independently fails on that prompt after an upsell conversation.

An in-process diagnostic reproduces both rejected interpretation attempts. The rule is “Policy questions do not select products or invent an occasion”, enforced in `lib/stylist/conversationPlan.ts:306`. The interpretation therefore contains forbidden policy-reference or purpose metadata; repair does not correct it. The application then safely preserves preferences, but fails to answer a supported question. [Focused rerun](answers-delivery-reproduction.log), [validation diagnostics](diagnosis.log).

A separate three-message browser recheck on the fresh build **does** answer the delivery question correctly. Its initial collection state/history differ from the scripted setup. This is a contextual/model-sensitive failure, not a claim that every delivery question fails. [Browser recheck](delivery-browser-recheck.png), [browser evidence](browser-evidence.json).

### 4. Dress-shirt identity is not always retained before collection selection

One of three `CAT-E` runs reaches the correct collection question for “I want a dress shirt for work under 200 aud” but stores `product_type: null`. The test expects a shirt type and fails. No wrong product is displayed at this stage; the missing identity is still a real discrepancy from the scenario's expected state. [Recorded run](../../test-evidence/customer-scenarios-2026-10-19T07-30-48-350Z/CAT-E-run-3.json).

## Test assumptions and catalogue coverage

- **Optional questions:** all three `B5` runs and the live outfit-budget script assume every grouped result has an `optional_question`. The current presenter only offers its generic occasion question for clothing with no recorded occasion; the tested outfits already specify Formal. The grouped products and combined-budget bounds are valid. Decide the intended conversational behavior, then align the assertion or presenter. These failures alone do not demonstrate broken budget accounting.
- **Flat-shoe representation:** two `B5` runs also expect `subcategory === "Flats"`, while the returned state uses `product_type === "Flats"` and returns only the intended flat-shoe fixture. This assertion is narrower than the supported family representation.
- **Specification coverage:** the current public catalogue contains 318 products and 316 prototype specification rows. `P1011` and `P1024` are outside the historical 316-product baseline and have no specification row. All compared names, descriptions, materials, stock, availability, prices and image-key hashes for the original 316 products match that baseline. Updating the count alone would hide the missing coverage; the specification test needs a deliberate policy for additional records. The audit performs reads only. [Audit](catalogue-audit.json).

## Recovery flows reproduced

1. No-size browsing returns four dresses under A$100. Setting size 12 displays that listed size. Size 999 is rejected. Removing it and restoring the budget/no-cream restriction returns Navy Maxi Dress A$95 and Grey Wrap Dress A$60.
2. The winery opening returns the A$265 dress/shoe set. Explicit cancellation and the complete dress-only restatement return Olive Maxi Dress A$155. The fresh-build implicit replacement also succeeds.
3. The saved dress receives the unverified grass-suitability blocker. Dropping that detail returns four flat-shoe alternatives. The selected-purchase display shows A$155 selected and A$125 left from A$280; shoe prices are A$60–A$120. [Selected purchase](selected-budget.png).
4. Marking the dress owned shows A$0 selected and A$280 left, and permits options above A$125. [Owned budget](owned-budget.png).
5. “Both, honestly…” plus weekend context immediately returns four inspiration products. The compound jacket refinement returns Grey Denim Jacket A$55.
6. Dad's office outfit totals A$175 within A$220. The shirt-only replacement returns three alternatives under A$100, discloses their occasion differences, and shows no formal-event picker. [Office replacement](office-replacement.png).

Two submissions during browser harness setup accidentally used the earlier tab rather than the fresh-build tab. Both are explicitly marked `excluded-wrong-tab` in raw evidence and excluded from the 20-message retest. The four fresh-build checks were then executed against the verified port-3003 tab. Historical product cards remain in the conversation transcript; dress-only assertions refer to the newest response.

## Assessment

The focused recovery report reproduces successfully. It should not be read as a full live acceptance pass. The broader run exposes colour omission and saved-anchor continuation defects, contextual delivery interpretation failures, a dress-shirt state omission, and test/catalogue assumptions requiring attention. The 103/114 result is this finite repeated fixture run, not a general model success rate or deployed-environment verification.

Temporary servers on ports 3000 and 3003 and the isolated build copy were cleaned up after verification. The pre-existing production server on port 3002 was left running. The recorded build IDs, hashes, screenshots, transcripts and logs preserve the evidence.
