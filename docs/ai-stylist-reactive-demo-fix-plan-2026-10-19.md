# AI stylist fix plan after the 20 reactive demos

Status: W0–W7 implemented and retested. See [the execution report](reports/reactive-stylist-fixes-2026-10-19/report.md) for changes, checks, fresh transcripts, and remaining limits. The plan below retains its original scope, based on [the live report](reports/reactive-stylist-live-demos-2026-10-19.md), [55 successful live turns](test-evidence/reactive-stylist-demos-2026-10-19.json), and code inspection. The baseline was 9 pass, 6 partial, and 5 fail.

## Intended outcome

Customers can answer a clarification in ordinary language, continue their original brief, ask about a named outfit, and refine results without losing requirements. Responses explain genuine catalogue gaps and distinguish provisional options from confirmed matches. A real no-match remains an acceptable result when the customer keeps firm limits.

Implement the shared conversation fixes first, then improve vocabulary and discovery, then complete the response and browser checks. Use deterministic code for prices, state transitions, and catalogue facts. Use the model to interpret the customer's request and select among supported operations.

## W0 — Preserve the baseline and make failures reproducible

Priority: preparation. Covers all 20 scenarios.

- Record the starting commit, current source fingerprints, configured model name, relevant feature flags, and the existing uncommitted diff. The current working tree already contains product-card and search changes; implementation must be reviewable against that starting point.
- Keep the original evidence immutable. Write new transcripts, assessments, and before/after comparisons to a separate retest directory.
- Turn the observed failures into small fixture cases with explicit invariants. Add the exact failed messages and a few meaningful paraphrases, including compound collection replies. These regression cases are separate from the final improvised live demos.
- Record prices and product IDs for the A$245 combination, the owned blazer journey, and the rejected Burgundy Maxi Dress so changes in live stock do not obscure a logic regression.

Completion check: each observed defect has an example that demonstrates the failure before implementation and a measurable expected result after it.

## W1 — Resolve clarification answers and route mixed requests correctly

Priority: P1. Scenarios S1, S11, S17, S18; also supports S3 and S13.

Observed cause: collection shortcuts accept a narrow whole-message grammar, while compound replies fall through to model interpretation. Task preparation can remember a collection answer, but subsequent answer routing or fallback can still leave the checkpoint active. A general availability or fit question can also enter the product-answer path when there is no referenced product.

Changes:

- Resolve an explicit answer to the active collection checkpoint as a separate state operation before interpreting the remaining clauses. Accept “Both collections are fine” and “Women's clothing, please” alongside the existing button values. Bind this resolution to the active checkpoint so “both” in an unrelated conversation does not change collection.
- Apply the confirmed collection once, consume its checkpoint, and preserve the shopping brief, combined budget, unverified requirements, and permission to browse provisionally.
- Interpret companion clauses without repeating the collection question. If a companion clause cannot be understood, retain the independently resolved answer and ask only about the unresolved part.
- Distinguish product availability from “are there any matches for my saved requirements?” The latter should rerun or explain the current constrained search rather than ask which product the customer means.
- Distinguish general fit guidance from a question about an identifiable product. A new explicit shopping request should supersede an obsolete product-reference question; a real unresolved reference should still be clarified.
- Support a shopping request plus a factual question in one turn without losing either part or turning question context into saved filters.

Likely files: `lib/stylist/collectionPreference.ts`, `taskState.ts`, `conversationTurn.ts`, `conversationPlan.ts`, `conversationGrounding.ts`, `answerPlan.ts`, and `lib/ai/interpretConversation.ts`.

Acceptance checks:

- S11's collection answer is accepted on its first occurrence, the next response either browses labelled provisional items or names a real remaining blocker, and the collection question does not repeat.
- S17 retains the concert/style brief after the collection answer even if the wording is more complex than a button label.
- S18 does not ask “Which item?” for a collection answer plus a general fit-information request.
- S1 answers availability using black, size 10, and A$150 without requiring a nonexistent product reference.
- Existing Unisex behavior, shared collection restrictions, cancellation, and stale recovery checks still hold.

Tests: extend the collection-first, conversation-recovery, plan-recovery, and conversation-answers suites with compound messages and state assertions.

## W2 — Answer questions about a named combination

Priority: P1. Scenarios S4 and S5.

Observed cause: answer kinds currently cover individual products, comparisons, policy, and the saved outfit. The comparison response subtracts the first two prices; it has no operation for summing a named set. Saved-outfit review deliberately ignores unselected search results, so it cannot review explicitly named candidate pieces.

Changes:

- Add a typed referenced-combination answer path for named or unambiguously referenced pieces. Let it request a purchase total, a combination review, or both. Keep the existing “my selected outfit” review tied to saved selections.
- Resolve only the named/referenced catalogue IDs and explicitly relevant owned anchors. Ambiguous names or grouped positions should produce one focused question; never sum an entire displayed group by accident.
- Refresh and verify product identities and current prices before calculating. Use integer cents, count each requested piece once unless the customer explicitly supplies quantities, and exclude already-owned items from the new purchase total.
- Show the line items, total, and remaining or excess budget when a relevant combined budget exists. State when missing prices prevent a complete total.
- Review the named candidates with recorded attributes and source-labelled limits, even if the customer has not saved them. Asking for an opinion or total must not select pieces, add them to the cart, or rewrite the shopping filters.
- Preserve response validation by giving the new path explicit invariants rather than relaxing the existing selected-outfit checks.

Likely files: `lib/stylist/answerPlan.ts`, `conversationAnswers.ts`, `outfitReview.ts`, `productReference.ts`, `conversationPlan.ts`, `conversationProtocol.ts`, `lib/ai/conversationModelPlan.ts`, `lib/ai/interpretConversation.ts`, and the conversation API's product-resolution branch.

Acceptance checks:

- S4 answers A$135 + A$60 + A$50 = **A$245**, leaving **A$155** from A$400. It does not replace the sum with a price comparison.
- A combined review-and-total question answers both parts.
- S5 reviews the Red Oxford Shirt and Beige Pleated Trousers with the owned navy blazer and gives **A$175** as the purchase cost when a total is requested.
- Duplicate references, changed prices, missing prices, unavailable records, and ambiguous references are handled explicitly.
- Existing selected-outfit reviews still use the saved outfit rather than arbitrary latest results.

Tests: add a focused referenced-combination suite and extend conversation-answer, selected-outfit-review, and protocol checks.

## W3 — Prevent reference details from becoming new preferences

Priority: P1. Scenario S16; protects S6, S15, and all factual answers.

Observed cause to verify during implementation: the S16 rejected product was excluded correctly, but its Maxi Dress type became a saved filter. Reference-derived identity and the customer's requested search identity can meet in the same preference-composition path; `conversationSearch.ts` also persists derived item identity when a field is empty.

Changes:

- Keep reference identity separate from search changes. Rejecting a named product should add its ID to the rejected list while retaining the existing search scope.
- Require an explicit customer change before saving a product type, colour, price, material, or style derived from a referenced item.
- Allow reference-derived identity only for operations that need it, such as an explicitly requested similar-item search, without overwriting unrelated saved requirements.

Likely files: `lib/stylist/conversationPlan.ts`, `conversationGrounding.ts`, `conversationSearch.ts`, and reference/preference composition helpers.

Acceptance check: after S16, `rejected_ids` contains the rejected dress, `product_type` remains null, and otherwise eligible wrap, mini, midi, and maxi dresses remain in scope. A factual zip question still adds no feature requirement until the customer makes it mandatory.

Tests: extend customer-scenario, conversation-plan, and cross-sell/rejection regression checks with before/after scope equality.

## W4 — Handle catalogue vocabulary and subjective preferences

Priority: P2. Scenarios S10, S12, S13, S18.

Observed cause: validation largely requires exact catalogue labels. A broad colour or fit description can become an invalid literal value. Jacket-family matching exists, but multi-piece extraction does not consistently map jackets to Clothing / Outerwear.

Changes:

- Use one catalogue-backed garment-family resolver across single-item extraction, grouped components, validation, and retrieval. Map jacket requests to the supported Outerwear structure and the jacket/blazer product family; do not emit a fabricated `Jackets` subcategory.
- For “green,” preserve the requested colour family and offer supported shades such as sage or olive in one focused clarification. Apply a shade after the customer accepts it. Do not silently replace a precise colour request.
- Treat “bright,” “bolder,” and “flexible fit” as descriptive guidance rather than exact colour or fit labels. Ask a useful optional question or retain the guidance as context; require evidence for physical properties such as stretch or an adjustable waist.
- Keep firm exclusions and material purity requirements exact. Pure linen must not be silently changed to linen blend.

Likely files: `lib/catalogue/productFamilies.ts`, `lib/ai/validatePreferences.ts`, `lib/stylist/combinedShoppingRequest.ts`, `conversationGrounding.ts`, `conversationPlan.ts`, and related search matchers.

Acceptance checks:

- S10 offers a clear route from green to accepted recorded shades while preserving the A$100 cap and unknown-size label.
- S12 does not save `Bright` as a literal colour; red can be accepted as a concrete choice without losing Work or Conservative context.
- S13's jacket and shirt request reaches grouped search with correct category values and A$300 as the combined total.
- S18 keeps size unknown and distinguishes relaxed styling from verified flexibility or adjustable-waist construction.
- S7's strict linen behavior remains intact.

Tests: extend preference-validation, search-filter, product-family, combined-budget, and evidence-validation coverage.

## W5 — Carry the goal through discovery and wardrobe planning

Priority: P2. Scenarios S13, S17, S18; builds on W1 and W4.

Observed cause: discovery state tracks stages and seen products, but not a durable structured wardrobe goal. In S13, the A$300 total and layering request disappeared into generic discovery. In S17, the distinction between the customer's current neutral wardrobe and the desired bolder style was lost.

Changes:

- Preserve a compact structured brief for the requested goal, optional combined budget, component count or roles, and customer-supplied context. Avoid treating an existing wardrobe description as a hard requirement for new purchases.
- For an open travel wardrobe, ask at most one focused question about missing piece roles or propose a small role plan for the customer to accept. Once roles are explicit, reuse the existing grouped outfit search.
- Keep an explicit total through collection and discovery. Never turn A$300 for a wardrobe into a A$300 allowance for every item.
- Explain the intended roles of proposed pieces, such as a base shirt and removable outer layer. Keep warmth, comfort, and actual weather suitability unverified when data is missing.
- For a bolder look, provide a few distinct, catalogue-supported directions, then let the customer choose. If stock cannot support the requested event, explain that and offer an explicit next choice.
- For changing-fit requests, explain recorded fit information and unknown construction details; allow provisional browsing with clear consent and labels.

Likely files: `lib/stylist/discovery.ts`, `conversationPlan.ts`, `conversationProtocol.ts`, `combinedShoppingRequest.ts`, `lib/ai/interpretConversation.ts`, and discovery/grouped-search presentation.

Acceptance checks:

- S13 retains A$300 and the layering goal through collection choice, then produces an eligible grouped set or a specific no-match explanation.
- S17 reaches useful style directions after collection choice without an interpretation loop or an inferred neutral-only restriction.
- S18 offers a useful explanation or labelled provisional options without guessing size or promising future fit.
- S2's successful discovery-to-denim-jacket journey still works.

Tests: extend guided-discovery, optional-discovery, grouped-discovery-memory, and outfit-budget suites.

## W6 — Complete the explanation and provisional presentation

Priority: P2. Scenarios S3 and S12; browser validation for all affected paths.

Changes:

- When the customer explicitly needs an order by a deadline, include a concise delivery limitation alongside the shopping help. Existing published policy can be cited; an arrival date must remain unconfirmed without delivery estimates.
- Make grouped provisional results as clear as single-item provisional results. S3 retained grass suitability in the response's unverified field while returning a `matches` status; verify the rendered behavior and ensure each relevant group/card and the summary disclose the unknown.
- Use the existing occasion/style mismatch data to explain why office options are alternatives. Avoid describing unconfirmed conservative-office choices as full matches.
- Avoid turning instructions such as “label unknowns” into additional shopping requirements; attach disclosure to the original requirement.

Likely files: `lib/stylist/shoppingPresentation.ts`, `conversationAnswers.ts`, `conversationTurn.ts`, `conversationIssues.ts`, `lib/ai/interpretConversation.ts`, and `components/stylist/ShoppingProductResults.tsx`.

Acceptance checks:

- S3's deadline is acknowledged without a delivery promise, and grass suitability is visibly unverified in grouped results.
- S12's alternatives show their actual recorded occasion/style differences in the chat and cards.
- Desktop and mobile views show the same requirement warnings and totals; typed collection answers behave consistently with buttons.

Tests: extend product-card and shopping-presentation suites, then inspect the affected browser journeys.

## W7 — Retest and publish the before/after evidence

Priority: release gate after W1–W6.

1. Run each targeted regression suite while implementing its package. Once the integrated changes settle, run the full offline suite, lint, TypeScript, and build once; investigate any concrete failures.
2. Rerun all 20 scenarios against the real local endpoint with fresh state. Keep the same scenario goals, but improvise every follow-up from the actual response. Do not reuse a fixed sequence or replay recorded model plans as proof of live behavior.
3. Exercise the formerly unstable collection/discovery paths with a few meaningful paraphrases and at least one mixed request. Record any model nondeterminism separately from deterministic failures.
4. Use the browser for totals, grouped provisional cards, collection choices, rejection, and hypothetical outfit review so the report covers presentation as well as HTTP behavior.
5. Save exact messages, responses, product IDs, prices, state changes, timings, source version, and catalogue conditions. Publish a new report and update the filterable results with before/after status and remaining limits.

Completion criteria:

- All identified logic defects have passing targeted checks and successful live confirmation, or a clearly documented remaining blocker.
- Every original partial/failing case has a fresh assessment; no case is marked passed solely because an HTTP request returned 200.
- All nine original passing cases preserve their observed behavior.
- No unrequested preference or selection mutation; no over-budget displayed combination; no unverifiable physical-property or delivery claim.
- Real missing stock and missing verified product data are reported honestly. Producing a product for every scenario is not a completion requirement.

## Recommended implementation order

W0 → W1 → W2 → W3 → W4 → W5 → W6 → W7. W1 removes the repeated-clarification failures; W2 adds the missing customer-facing capability; W3 protects search integrity; W4 and W5 improve the range of language and situations the stylist can handle; W6 makes the results understandable; W7 supplies fresh evidence.

Execution completed in this order. The original evidence is unchanged; the retest contains all interim failures and retries. Catalogue timeouts and missing verified product data remain explicit in the execution report.
