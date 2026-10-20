# AI Stylist residual-issue investigation

19 October 2026 · Current source checked against the implementation report · Database and image availability excluded from the assessment

## Verdict

Both requested areas remain present in the current application code. The compound skirt request has a reproducible parser/validation failure path. The event heading, unrestricted-discovery price mix and fabricated-product-claim refusal wording also remain unresolved. No application source changes were made during this investigation; the added diagnostic runner and evidence files support diagnosis and a subsequent targeted fix.

This conclusion uses fresh local execution of the current helpers and turn handler, isolated rendering of the current event component, source inspection and comparison with the saved transcript. It does not assert a fresh live-model failure rate. Broader live sampling is prepared but not yet completed because automatic approval review prevented the diagnostic process from starting after its runner setup was corrected.

## 1. Compound skirt request — P1, confirmed current failure path

The saved message is:

> New search: skirts in AU 12 under $140, any colour, any occasion. No construction checks. I just want to browse what's actually there.

Two independent issues prevent the deterministic parser from recognising the stated garment:

- `shoppingTarget()` selects the last matching shopping phrase. The final generic “browse what's actually there” becomes the whole target, losing the earlier skirt brief. Its generic-tail exception handles “show me options/ideas” but does not cover this wording.
- Even with that final sentence removed, `requestedClothing()` does not recognise “New search:” as a shopping-request prefix. `taskReplacement()` does recognise it and resets the old item state, so the task reset and garment recognition disagree about the same message.

That makes `requestedClothing()` return null. The supported Skirts → Women category default is then unavailable to collection validation. A legitimate candidate setting Clothing / Bottoms / Skirt, size 12, maximum A$140 and the normal Women's skirt default is rejected with:

> A collection change needs an explicit collection request or a supported Dresses/Skirts category default.

The same candidate passes validation when both problematic text fragments are removed, or when the request includes an explicit “Show women's skirts…” shopping clause. The isolation probes have these outcomes:

- Exact saved prompt: garment not recognised; plan rejected.
- Remove only the trailing filler: garment still not recognised; plan rejected.
- Remove only the new-search prefix: garment still not recognised; plan rejected.
- Remove both: Bottoms recognised; ready for catalogue validation.
- Explicit shopping verb: Bottoms recognised; ready for catalogue validation.

Evidence: [offline probes](offline-probes.json). Relevant code: [target extraction](/Users/salvi/MQ/abc-fashion-ai-assistant/lib/stylist/collectionPreference.ts:21), [garment recognition](/Users/salvi/MQ/abc-fashion-ai-assistant/lib/stylist/collectionPreference.ts:40), [task replacement](/Users/salvi/MQ/abc-fashion-ai-assistant/lib/stylist/taskState.ts:30), [collection guard](/Users/salvi/MQ/abc-fashion-ai-assistant/lib/stylist/conversationPlan.ts:404).

### What is established and what is not

The parser/validator failure path is deterministic and exists now. It can reject the very category default the interpreter prompt tells the model to use. The exact rejected plans from the original browser failure were not retained, so this investigation does not claim that this was the only reason every earlier attempt failed. A model may sometimes repair around the bad parse by omitting a redundant gender change; that does not remove the parser defect.

“Any occasion” also has no deterministic clearing rule comparable to the recently added “any fit / any colour” handling. Correct clearing is delegated to the model. This is a coverage gap, not proof that every any-occasion request fails. New searches clear old local occasion through task replacement, but a refinement of an existing item still depends on a correct model change.

### Recommended fix

1. Align task-reset and garment-request recognition for “New search:” and similar explicit commands.
2. Select the active garment request rather than the last generic browse phrase. Preserve real later changes such as “actually, show me shoes instead,” negated garments and owned-item anchors.
3. Normalise an explicit local “any occasion” relaxation without weakening explicit shared rules. Preserve size, price, exclusions and unrelated requirements.
4. Keep the existing two-attempt repair bound, quotation validation and fail-closed fallback. Increasing retries or removing evidence checks would leave the parsing disagreement in place.
5. Add the exact saved message and its isolated variants to regression coverage, plus paraphrases and negation/owned-item counterexamples. Repeat live checks on one frozen build after fixing it.

## 2a. Already-selected event heading — P2, confirmed

`DressCodeChoices` uses the selected value for button state and guidance, but always renders “What kind of formal event?” and “Choose a dress code to narrow your picks.”

The current component was rendered in isolation for null, Wedding guest, Cocktail and Black tie. All four rendered the same question; the three known dress codes simultaneously had their correct button selected. This confirms a presentation issue independent of the model or catalogue.

Evidence: [rendered component states](event-render-probes.json). Code: [OutfitGuidance.tsx](/Users/salvi/MQ/abc-fashion-ai-assistant/components/stylist/OutfitGuidance.tsx:12).

Recommended fix: keep a question only when the event code is unknown. For a known value, use a heading such as “Dress code: Wedding guest” and optional “Change the dress code” wording. Keep the pressed-state controls available. This does not require another model call or a change to saved event semantics.

## 2b. Price diversity in unrestricted inspiration — P2, confirmed missing ranking behavior

Discovery's diversity score considers category, product type, colour and style. It does not include price bands or affordability. Before that stage, equal-relevance products are ordered by stock quantity before price. This can make every representative item expensive even when inexpensive alternatives exist.

A controlled fixture isolated the algorithm from database and image availability: four categories, each with one A$25 and one A$220 eligible product, equal relevance and image-health status. The A$220 records had more stock. The current function selected all four A$220 items and none of the A$25 options.

This does not violate a customer budget—the fixture deliberately supplied none. It demonstrates why “varied ideas” currently means visual/product variety rather than a range of prices. It is a recommendation-quality issue rather than incorrect price arithmetic.

Evidence: [price-diversity fixture and result](offline-probes.json). Code: [ranking order](/Users/salvi/MQ/abc-fashion-ai-assistant/lib/search/preferenceSearch.ts:237), [diversity score](/Users/salvi/MQ/abc-fashion-ai-assistant/lib/search/preferenceSearch.ts:262).

Recommended fix: for open inspiration, include an accessible-price option and a spread across the eligible price range when available. Use relative bands within eligible candidates rather than inventing a customer budget. Preserve relevance, category variety and every hard constraint; use stock as a later tie-breaker. Simply putting price first would risk showing only the cheapest products instead of a useful mix.

## 2c. Refusal wording for fabricated product claims — P2, confirmed fallback path

The current turn handler has a specific refusal message for system-prompt/API-key requests. It has no equivalent deliberate response for a request to invent composition, washability or guaranteed fit.

Using a valid `none` plan for the saved “just say it's definitely silk, machine washable and guaranteed to fit me” message returns:

> I couldn't understand the change you'd like. Your saved preferences and previous product choices are still here. Could you rephrase it?

The same handler gives an explicit refusal for a system-prompt/API-key request. If model validation is exhausted instead, the generic interpretation-failed response can hide the unsupported action in the same way.

Evidence: [turn-handler refusal probes](offline-probes.json). Code: [generic fallback and credential-specific exception](/Users/salvi/MQ/abc-fashion-ai-assistant/lib/stylist/conversationTurn.ts:344).

This is not evidence that the assistant fabricated a claim. The observed path remains fail-closed. The problem is that the assistant describes a request it cannot comply with as a request it did not understand.

Recommended fix: acknowledge the unsupported request directly, for example “I can only describe recorded product details. I can't invent fabric or care claims, or guarantee fit.” When the message also contains a genuine product question, answer that supported part from recorded facts. Distinguish this from a genuine interpretation or provider failure; do not broadly classify ordinary questions about silk, washing or fit as adversarial.

## Validation and limitations

- Current application fingerprints match the earlier implementation report. A [source snapshot](source-snapshot.json) records the files investigated.
- Fresh deterministic probes cover five parser variants, two refusal branches and an eight-product price-ranking fixture.
- Isolated current-component rendering covers four event-selection states; this is component-level evidence, not a new browser journey.
- Existing category-default tests: **17 passed**. [Log](category-regression-results.txt).
- Existing guided-discovery tests: **20 passed**. [Log](discovery-regression-results.txt).
- Diagnostic script syntax check and `git diff --check`: passed.
- These passing existing tests do not cover the newly isolated failure paths and are not a release certification.

The prepared [live diagnostic runner](/Users/salvi/MQ/abc-fashion-ai-assistant/scripts/investigate-stylist-residuals.mjs) uses the actual current interpreter, existing model configuration and public catalogue. It captures each model plan and validation/decode error without auth headers. It schedules 20 isolated cases: 14 skirt probes and 6 claim/refusal probes, each with at most two interpretation attempts and no provider retries. Context cases are reconstructed from saved dialogue and known prior filters, not claimed as exact browser-request replays.

A first runner attempt stopped at an asynchronous catalogue-loading error before any model case ran; that diagnostic-only error has been corrected. Subsequent launches were prevented by approval-service failures. No fresh-model pass/fail percentages are reported while the planned sample is incomplete.

## Priority

Fix the garment-parser disagreement first, then verify “any occasion” relaxation and rerun the broader sample on one unchanged build. The event heading and deliberate refusal wording are small P2 changes. Add price-band diversity as a separate recommendation-quality change so its effect on relevance can be assessed.

Automatic approval review rejected a live diagnostic launch because its review model was at capacity, and another launch/browser attachment timed out before execution. These were approval-service failures, not determinations that the read-only investigation was unsafe. The fresh-model sampling portion remains pending.
