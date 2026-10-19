# Conversation recovery fixes and live retest

19 October 2026 · Australia/Sydney · Local production build at http://127.0.0.1:3002/

Implemented the conversation fixes recommended by the [independent verification](../live-verification-2026-10-19/report.md). Source photos, catalogue records, image handling and product specifications were left unchanged. Hash checks confirm all 19 protected photo/catalogue/specification source files are unchanged.

## Changes

- **Size edits:** replaced the next-word-after-size fallback with explicit label/set/remove parsing. “No size filter,” “any size,” “drop size 999” and “set size to 12” now retain their intended meanings. Negated edits do not authorize removing a restriction. Unsupported labels still go through catalogue validation.
- **Outfit replacement:** validation counts positively requested components, excluding dropped components. An explicit replacement or a complete single-item request with its own cap clears the old outfit request, pending task and local item filters while retaining the saved look and shared restrictions. Component refinements and explicit instructions to retain pieces preserve the group.
- **Discovery memory:** a compound collection answer uses item scope instead of inventing a global rule. Its explicit collection choice survives interpretation trouble in another clause. Volunteered weekend context can proceed directly to inspiration.
- **Saved-look continuation:** “I still need shoes” and a request to confirm the purchase budget while showing options resolve the unique saved garment and search only the additional category. The requested extra item cannot be overwritten by the anchor's category. “Total purchase budget” is recognized; existing current-price and selected-versus-owned accounting remain enforced.
- **Interpretation:** clarified the model instructions for these cases and allowed 4,000 output tokens initially, 6,000 on the single repair attempt. Exhausted repair remains a clarification rather than being converted into an incompletely interpreted search.
- **Event guidance:** a known event displays “Wedding guest guidance” (or the selected dress code) instead of asking which formal event it is again. Office outfits retain their existing absence of event guidance.

The request changes nine implementation/test files. [Changes against the preserved pre-fix source](changes.diff) distinguish this work from the substantial pre-existing dirty checkout. No commit or deployment was performed.

## Verification

- **41/41 regression scripts passed**, including **14 new integration checks** for the failed prompts, state transitions, exclusions, budget accounting, ambiguous anchors and exhausted interpretation repair. [Regression log](regression.log).
- **Lint passed.** [Log](lint.log).
- **Webpack production build passed**, including TypeScript. [Build log](build.log).
- **20 real browser customer messages**, using the configured model and current connected catalogue. Sixteen exercised the main fixes; four repeated size handling and implicit single-item replacement after the final defensive guards were built. [Full transcripts](transcripts.md), [raw captures](browser-evidence.json).
- Final-build source hashes remained unchanged during the smoke check. [Build identities](builds.json), [verification summary](results.json).

### Observed live outcomes

1. **Size recovery:** the exact fresh “No size filter” prompt returned four dresses under A$100. “Set size to 12” returned cards saying “Size 12 is listed.” A size-999 request was still rejected; dropping size 999 and restoring A$100/no cream returned Navy Maxi Dress A$95 and Grey Wrap Dress A$60 without a reset.
2. **Task replacement:** the original winery wedding opening returned the A$265 dress/shoe set. The exact “Drop the shoes and the combined outfit search” request then returned only Olive Maxi Dress A$155. The full dress-only restatement also replaced an active group on the final build without explicit cancellation or New chat.
3. **Saved purchase:** the detailed grass/winery request received a concrete unverified-suitability blocker. One reply dropping the grass detail reached four flat-shoe alternatives. The formerly failing planned-purchase confirmation showed **A$155 selected and A$125 left of A$280**, with A$60–A$120 shoes. Those dress-plus-one-pair totals are A$215–A$275.
4. **Already owned:** explicitly marking the dress owned changed the display to **A$0 selected and A$280 left of A$280**, and allowed shoe options above A$125. The dress stayed available as a styling reference.
5. **Discovery:** the original “Both, honestly … ordinary weekend” answer immediately produced four inspiration products without another collection or day question. A compound number/name/colour/budget refinement returned Grey Denim Jacket A$55 under A$100.
6. **Office shopping:** Dad's initial shirt/trouser request returned A$175 within A$220 and no formal-event picker. “Forget the two-piece outfit … shirts under A$100 … No size filter yet” returned three shirt alternatives, with their occasion differences disclosed.

## Remaining limits

Grass suitability is not recorded. The stylist now identifies that detail and supports removing it or explicitly browsing provisional options; it does not assert verified traction or outdoor suitability. This is deliberate grounding, and no product specification was added to eliminate the blocker.

Missing source photos and synthetic specification content remain as requested. This targeted live retest does not establish a general model success rate or verify a deployed environment. Arbitrary compound language can still require clarification; bounded interpretation repair and hard catalogue constraints remain in place.

## Screenshots and diagnostics

- [Size correction](size-correction.png)
- [Dress-only replacement](outfit-replaced.png), [final-build dress-only result](final-dress-only.png)
- [Selected-purchase budget](saved-purchase-budget.png), [owned-garment budget](owned-budget.png)
- [Weekend discovery](discovery-weekend.png), [office shirt replacement](gift-shirt-replacement.png)
- [Known event guidance](wedding-guidance.png)
- [Core live diagnostics](server.log), [final-build diagnostics](final-server.log)

The local final-build demo remains available on port 3002. No products were added to the cart and no purchase was made.
