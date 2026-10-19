# AI stylist fixes and reactive retest

Implemented in the recommended W0–W7 order on 19 October 2026 (Sydney). The original report recorded 9 pass, 6 partial, and 5 fail. All 20 main scenarios reached an acceptable final path after implementation and retesting. This result describes the final behavior reached during an iterative run that included fixes and retries; every intermediate attempt is retained.

## What changed

- **Clarification and question routing:** collection answers are resolved from their own clause, including compound replies and retry phrasing. General fit guidance and saved-search availability no longer require a nonexistent product reference. Explicit collection answers survive a failure to interpret a companion clause.
- **Named combinations:** customers can ask for the total, review, or both for named displayed candidates. Prices are refreshed and calculated in cents, repeated references are deduplicated, explicit quantities are handled, missing prices prevent a fabricated total, and owned pieces have zero new purchase cost. These questions leave the saved look unchanged.
- **Search integrity:** rejecting one product excludes its ID without importing its type or other attributes into the search. Literal material requirements, including pure linen, remain saved even when the model omits or broadens them. Owned jackets are excluded from purchase-component extraction.
- **Vocabulary and discovery:** jackets use the existing Outerwear family. Green can be clarified to catalogue shades without silent replacement. Bright and flexible descriptions are retained as guidance rather than invalid literal catalogue values. A structured brief preserves travel layering, combined budgets, fit guidance, and deadlines through discovery.
- **Grounded explanations:** grouped provisional results disclose the unknowns in the chat and cards. Deadline requests get an arrival limitation. Work alternatives explain their occasion/style differences. Waterproofing and laptop fit are explicitly marked unverified when the records do not establish them.
- **Recovery from invalid interpretations:** instructions such as “label unknowns” and “no substitutions” are kept distinct from physical garment requirements. Confirmed shade choices are retained, while questions that merely mention a shade do not select it. Permission to browse softness unverified cannot erase the requirement.

Primary changes are in the conversation, task, answer, product-family, and presentation modules, plus the chat and product cards. The new `shoppingBrief.ts` module stores customer context independently of product facts. Existing selected-outfit reviews retain their selection-only behavior. No database migration is required.

The starting commit, original uncommitted diff, model name, flags, and source fingerprints are preserved in [baseline.json](baseline.json), [baseline.diff](baseline.diff), and [baseline-source.tar.gz](baseline-source.tar.gz). [implementation.diff](implementation.diff) compares this work with that preserved starting state, including the pre-existing search/card changes. The original 55-turn evidence file's SHA-256 was checked unchanged.

## Verification

- **42/42 regression scripts passed**, including **22 focused checks** for the observed defects and additional edge cases. See [regression-final.log](regression-final.log).
- TypeScript and whitespace checks passed. Lint completed with no errors and one pre-existing unused-import warning in `scripts/upload-generated-product-images.mjs`; see [lint-final.log](lint-final.log).
- The production **Webpack build passed**; see [build-webpack-final.log](build-webpack-final.log). Default Turbopack compilation could not bind its CSS-worker port in this environment, including the escalated attempt. That environment limitation is retained in [build.log](build.log) and [build-host.log](build-host.log).
- Live conversations used the real local HTTP endpoint, configured model, and catalogue, with independent state for each scenario. All follow-ups were chosen after reading the actual response. The run contains **20 main scenarios plus 6 fresh variations, 72 HTTP attempts, and 66 HTTP 200 responses**. There was **one interim HTTP 502** during the owned-jacket extraction correction and **five HTTP 503 catalogue failures** during the variation runs. All six variation paths subsequently reached an acceptable result. An HTTP 200 alone was not used as a pass criterion.
- [assessment.json](assessment.json) contains 20 checks against the final recorded behavior and state. [transcripts.md](transcripts.md) is the readable transcript; [live-evidence.json](live-evidence.json) retains each request, response, timing, error, and accepted state.

## Final scenario outcomes

1. **Precise black dress — met.** The saved black, size 10, A$150 brief remains intact. Asking whether any eligible dress is available reruns that constrained search and returns an honest no-match without asking which product the customer means. Evidence: S1.

2. **Unsure shopper — met.** After a collection choice, discovery offers varied ideas. Choosing the White Denim Jacket as a reference and setting A$100 finds the Grey Denim Jacket for A$55. Evidence: S2.

3. **Outdoor wedding — met with explicit unknowns.** The customer accepts provisional browsing, the dress/shoe set stays within A$300, grass suitability remains unverified on the cards, and weekend arrival is explicitly unconfirmed. Evidence: S3 and the provisional browser captures.

4. **Three-piece budget — met.** The named Sage Midi Dress, Red Block Heels, and Silver Envelope Clutch total A$245, leaving A$155 of A$400. The answer also reviews the combination without saving those pieces. Evidence: S4 and the combination browser capture.

5. **Owned navy blazer — met.** Trousers and a shirt cost A$175, leaving A$45 of A$220. The named candidate review includes the described blazer without charging for it or selecting the candidates. The initial failed attempt was corrected and a separate fresh variation confirmed the result. Evidence: S5 and S5-V1.

6. **Red changed to blue — met.** Blue replaces red while size 10 and A$150 survive. No mismatched product is shown to avoid a genuine no-match. Evidence: S6.

7. **Strict linen — met through an honest catalogue blocker.** Pure Linen, size 12, and A$50 stay saved. The final response explains that the exact material is unsupported and shows no blend or other substitute. An omitted material and a mistaken “no substitutions” feature were caught during implementation and corrected. Evidence: S7 and S7-V1.

8. **Unknown size — met.** The stylist allows browsing, explains the Burgundy Maxi Dress's Brunch-versus-Work difference, and lists recorded size labels without guessing fit. Evidence: S8.

9. **Commuting bags — met.** Two named bags are compared using prices, dimensions, closures, and compartment counts. Detailed prototype specifications are labelled synthetic. Evidence: S9.

10. **Gift bag — met.** Green is clarified to recorded sage/olive choices. Explicit acceptance of sage produces a bag under A$100, while the original size uncertainty remains labelled in the main gift journey. A compound shade reply initially fell back; explicit-choice persistence and a fresh compound variation confirmed recovery. Evidence: S10 and S10-V1.

11. **Sensitive to fabric texture — met with provisional labels.** “Both collections” consumes the collection checkpoint rather than repeating it. Softness remains an unknown requirement when provisional browsing is permitted, including when the unknown is introduced in the same compound message. Evidence: S11 and S11-V1.

12. **Conservative office with colour — met with disclosed alternatives.** Bright is guidance rather than a literal colour filter. The customer chooses red, and the response preserves Work, Conservative, and A$180 while explaining the actual occasion/style differences. Evidence: S12.

13. **Small travel wardrobe — met.** The A$300 total and layering goal survive collection choice. A focused role question leads to jacket-and-shirt groups whose displayed combinations remain within that total. Evidence: S13.

14. **Dressy shoes for standing — met with explicit unknowns.** Provisional choices retain the stated suitability limits. The Sage Ballet Flats' recorded 0 cm heel is reported without claiming all-day comfort. Evidence: S14.

15. **Zip becomes mandatory — met.** A factual zip question leaves required features unchanged. Only the later explicit instruction saves `zip_closure`, and returned bags remain within A$100. Evidence: S15.

16. **Reject one dress — met.** The Burgundy Maxi Dress is excluded by ID. The broader work-dress search keeps product type unset and can return wrap, mini, slip, and maxi alternatives. Evidence: S16 and the rejection browser capture.

17. **Bolder concert look — met with occasion limits.** The collection answer leads to several catalogue-based directions. The fresh variation keeps Concert as context and labels items whose recorded occasion differs, without inferring a neutral-only requirement from the old wardrobe. Evidence: S17 and S17-V1.

18. **Changing size — met with fit limits.** Collection choice plus a fit-label question produces guidance and browsing results. Size remains unknown, and recorded cuts are not presented as proof of stretch, adjustable construction, or future fit. The retry wording that exposed a further interpretation issue was fixed and confirmed live. Evidence: S18 and S18-V1.

19. **Only a silver necklace — met.** The silver necklace-only A$80 request stays unchanged and receives an honest no-match. Evidence: S19.

20. **Waterproof/laptop bag facts — met.** The final answer explicitly states that waterproofing and laptop fit are unverified, gives recorded 30 × 22 × 8 cm dimensions, and identifies those dimensions as synthetic prototype data. Evidence: S20.

## Browser evidence

The real chat UI was checked for the named combination total/review, grouped provisional warnings, deadline disclosure, a compound collection reply, and product rejection. Mobile checks used a 390 × 844 viewport; the document width remained 390 pixels. Desktop checks used 1280 × 900. Temporary viewport overrides were reset.

- [Named combination](browser-combination.png) and [DOM transcript](browser-combination.txt).
- [Mobile provisional summary](browser-provisional-mobile.png), [desktop provisional card warning](browser-provisional-desktop.png), and [DOM transcript](browser-provisional.txt).
- [Rejection result](browser-rejection.png) and [DOM transcript](browser-rejection.txt).

The browser also encountered a temporary catalogue failure. A development reload expired its first retry token; the UI preserved state and requested a new message. These are recorded as execution conditions rather than counted as successful shopping behavior.

## Remaining limits

The live catalogue intermittently timed out. Application state was preserved, and later retries succeeded; these results do not establish uninterrupted service availability. Model interpretation can still request clarification for wording outside the supported operations. The focused regressions and six variations provide evidence for these fixes, not a general reliability percentage.

Product photography gaps and missing manufacturer-verified physical data remain. Synthetic measurements, care, and feature details retain their provenance labels. Fit, softness, grass suitability, laptop capacity, visual compatibility, and delivery dates are not established merely by the conversation fixes.
