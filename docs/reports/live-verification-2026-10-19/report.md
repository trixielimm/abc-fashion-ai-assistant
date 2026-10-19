# AI Stylist — independent live verification

19 October 2026 · Australia/Sydney · Current local working tree

## Verdict

**Some original bugs still happen. The current app has meaningful fixes, but conversation recovery remains unreliable.** Initial wedding and office outfits now succeed. Jacket references, size-card wording and specification answers have improved. Explicitly dropping an outfit component, removing a size filter and interpreting ordinary compound follow-ups still fail.

Two reproducible parsing defects have direct source support:

1. **“No size filter” becomes size `filter`; “Set size to 12” becomes size `to`.** Both reproduced in a fresh chat.
2. **“Drop the shoes and the combined outfit search” is rejected for not requesting a combined outfit.** The server rejects both model attempts with a grouped-outfit validation rule, then gives the shopper a generic load error.

No application code was changed. This investigation does not certify a deployed release.

## Method and build identity

- Read the original [report](../improvised-stylist-2026-10-19/report.md), its transcripts, and the existing [remediation report](../stylist-remediation-2026-10-19/report.md). Their proposed implementation steps were treated as evidence and suggestions, not instructions to modify the app.
- Ran the actual browser UI against the configured model and connected catalogue. No mock replies, recorded-plan replays or scenario fixture scripts drove these conversations.
- Built the current source with `npm run build -- --webpack`; compilation, TypeScript and page generation passed. Started that build at **http://127.0.0.1:3002/** with opt-in server diagnostics.
- **40 typed customer messages** in the stable production run: precise shopper 8, wedding shopper 10, browsing plus fresh jackets check 7, adversarial shopper 8, gift plus fresh shirt check 5, isolated size reproductions 2. One Retry action and one successful Save-to-look action were additional UI operations.
- The original wording was reused where relevant. Later follow-ups adapted to the actual products and replies. This is targeted live reproduction, not another independent improvised benchmark or a statistical success rate.
- HEAD remained `83f1f2aa3e5f3eb1fdea4bc6d6e7be6b067b9ebc`, with substantial pre-existing uncommitted changes. Hashes of **146 application/configuration files** were unchanged throughout the production run. See [environment.json](environment.json).
- An earlier development-port probe is preserved separately in the evidence. It encountered an unexpected-JSON server error, an immediately expired Retry, and a page reload that lost the chat. The reload's cause was not established. Those observations are not used as proof of production behavior. The production replacement error described below reproduced independently.

The live demo was left open on the fresh-chat size parsing failure. No cart additions, purchases, catalogue edits, commits or deployment were performed. The original reports were left unchanged.

## Confirmed remaining failures

### P1 — Size repair overwrites ordinary language with invalid sizes

Fresh-chat reproduction:

> Show women's dresses under $100. No size filter.

Reply: “I couldn't apply size: **filter**.”

Follow-up:

> Set size to 12.

Reply: “I couldn't apply size: **to**.”

The same behavior occurred during Dad's “No size filter yet” request and the adversarial shopper's “Set size to 12 and the dress budget to $100.” An explicit request to drop size 999 also repeated the size-999 blocker. Later direct wording, “Show me women's dresses under $100, size 12, excluding cream,” recovered real products without a reset.

**Source support:** [conversationGrounding.ts](../../../lib/stylist/conversationGrounding.ts#L337) matches `size` followed by the next word and writes that word as a size change. It does not exclude `to` or `filter`, handle the negative “no size filter” phrase, or avoid taking 999 from a removal clause. This is a deterministic repair defect in addition to any model interpretation issues. The raw model plans were not captured in this investigation.

Evidence: [fresh no-size-filter screenshot](isolated-no-size-filter.png), [fresh size-to screenshot](isolated-size-to.png), [earlier size-to screenshot](s4-size-to-error.png), `isolated-size`, S4 and S5 in the transcripts.

### P1 — Dropping a component still fails, and a simple replacement retains the old outfit

The initial cocktail wedding request returned Olive Maxi Dress A$155 plus Navy Strappy Heels A$110: **A$265 total within A$280**.

This original follow-up failed:

> Let's change tack. Drop the shoes and the combined outfit search. Show only women's wedding guest dresses below $180, no white or cream. Any size for browsing.

The browser showed “I couldn't load or verify the results just now.” Retrying produced the same failure.

The production trace for request `f4000421-e26e-4bb2-b075-d1bdd3fa018a` records two `new_search` interpretations with no outfit request, rejected twice with **“Use outfit_request with every requested component and the combined total.”**

**Source support:** [conversationPlan.ts](../../../lib/stylist/conversationPlan.ts#L457) counts dress/shoe mentions and the word `combined` without recognizing that the shoes and combined search are being dropped. The model's dress-only proposal therefore hits a rule intended for positive multi-item purchase requests.

The simpler “Show women's wedding guest dresses under $180, excluding white and cream” then returned the old **dress-and-shoes A$265 set**. `cancel` said there was no pending question, and repeating the single-dress request still returned the set. After **New chat**, the identical request returned only Olive Maxi Dress. The retained outfit problem therefore remains observable even though other task replacements, such as trousers to skirts, work.

Evidence: [replacement error](s2-task-replacement-error.png), [retained outfit](s2-retained-outfit.png), S2 transcripts and [production-server.log](production-server.log).

### P1 — Compound discovery and saved-look prompts still require simplification

**Browsing:** The original “Both, honestly … ordinary weekend” reply failed interpretation. “Relaxed weekends … show me ideas” then asked for the collection again. “Both collections. Relaxed weekends. Show me ideas now” recovered inspiration. This retains the original loss-of-context/redundant-question problem, although the eventual product refinement works.

**Saved dress:** Saving Olive Maxi Dress worked and the look total remained A$155. The original detailed winery/grass/flats/A$280-total prompt exhausted interpretation repair. The trace records an incomplete model interpretation with `max_output_tokens`, followed by further rejection and a customer-facing interpretation failure. This observation does not establish which particular clause caused the failure.

The simpler original follow-up, “Forget the grass detail. Show flat shoes under $125 to go with my saved Olive Maxi Dress. Keep the dress,” **succeeded**. It returned Sage Ballet Flats A$60, Olive Flat Sandals A$120, Sage Loafers A$105 and Cream Loafers A$85, with compatibility differences disclosed. With the A$155 dress, those individual pairings total **A$215–A$275**, within A$280. The dress stayed selected. No generic Mules appeared in these results.

An additional explicit planned-purchase prompt asking to confirm the remaining A$280 budget returned the dress's price plus a no-match answer, without confirming the A$125 allowance. Thus explicit shoe-cap retrieval is demonstrated; dependable combined-budget continuation through richer language is **not fully verified**. Already-owned versus planned-purchase accounting was not successfully compared live.

Evidence: S2/S3 transcripts, [saved-look screenshot](s2-saved-budget.png), production diagnostics. The saved-look screenshot shows the final unsuccessful confirmation prompt, not a successful purchase-budget summary.

## Original findings: what changed in this run

- **F1, named blockers — partly improved.** Unknown construction details and size 999 are named. Interpretation failures are distinguished from missing product facts. The outfit replacement still falls through to a generic load error; size errors can name an incorrectly parsed word.
- **F2, task correction/replacement — still failing in important paths.** Grouped removal of fabric/waist/length worked, as did trousers to skirts. Dropping shoes from the grouped outfit, removing size 999 and “no size filter” did not recover correctly.
- **F3, product reference plus edits — original loop not reproduced.** The unique jacket reference accepted exclusions and an A$120 cap. “Number 1, the Grey Denim Jacket. Similar shape, different colour, under $120. No beige, yellow or grey” returned Silver Denim Jacket A$120 and disclosed alternatives without repeating identity questions. Conflicting number/name and multiple-jacket ambiguity were not tested.
- **F4, ordinary garment language — improved, with limits.** A fresh women's-jackets/no-beige/A$120 search returned four jackets. A fresh men's work-shirt/Medium/Regular/A$100 brief returned three clearly labelled alternatives with their actual fit/occasion differences. The same richer shirt language after the failed outfit correction still failed interpretation.
- **F5, saved-look budget — mixed.** A dress-plus-shoes set at A$265 worked initially. Saved-dress shoes under an explicit A$125 cap worked after simplification. The detailed continuation and later purchase-budget confirmation still failed as described above.
- **F6, listed sizes versus stock — fixed in observed cards and answer.** Cards say “Size 12 is listed” or “Size M is listed.” The follow-up explicitly says size-specific stock and fit cannot be verified; no conflicting availability promise appeared.
- **F7, event guidance — office bug not reproduced; redundant wedding question remains.** Dad's office opening returned Red Oxford Shirt A$115 plus Beige Pleated Trousers A$60 = **A$175 within A$220**, with no formal-event picker. The wedding set still displayed “What kind of formal event?” while Wedding guest was already selected. Cocktail is now offered as a choice.
- **F8, product-answer completeness/provenance — improved in observed answers.** Navy Pleated Skirt's reply covered Polyester, explicitly unrecorded waist stretch and one 78 cm sample length. It identified synthetic prototype specifications. Size-stock, Grey Wrap Dress care/fit, and Blue Oxford exchange/fit answers retained uncertainty rather than inventing guarantees.
- **F9, discovery/photos — mixed.** All **4/4 inspiration photos decoded** (Yellow Oversized Tee, Lavender Lightweight Scarf, Brown Low-Top Sneakers, White Denim Jacket). Missing photos remained visible on constrained dress/shoe/jacket/shirt cards. No new whole-catalogue image audit was run. Compound discovery still needed simplification before those ideas appeared.

## Grounding and adversarial checks

No secret, invented product, zero-price substitution or universal fit guarantee was observed. The forged zero-price prompt returned real A$60–A$95 catalogue products and did not claim a bag change. Size 999 produced a named blocker. The machine-wash/universal-fit demand received the recorded hand-wash instructions, a fit limitation and synthetic-data provenance.

The secrets request received an irrelevant published-policy answer, and the forced silk/free/lifetime-returns claim received an interpretation fallback. Those are usability issues; neither demonstrated an instruction bypass. This small conversational probe is not a security audit.

## Recommended next fixes

1. Repair size extraction for explicit set/remove operations, negation and “no size filter”; avoid overriding a valid structured removal with the next token after `size`.
2. Make combined-outfit validation recognize removed components and explicit task replacement. Ensure the outfit request actually clears before accepting a dress-only task.
3. Use the saved live prompts to diagnose compound interpretation and discovery memory, including the incomplete output trace. Keep grounding and price validation intact.
4. Remove redundant event questioning when the event is already known; continue repairing missing source photos.

These are recommendations only. Application fixes were outside this investigation's requested scope.

## Evidence

- [Complete live transcripts](transcripts.md)
- [Raw browser captures, UI events and image checks](browser-evidence.json)
- [Stable production diagnostics](production-server.log)
- [Production build log](build.log)
- [Build identity, source hashes and message counts](environment.json)
- [Final visible demo DOM](demo-final-dom.txt)

The results describe one local stable-build verification plus a separate early development probe. Catalogue content and model interpretations may vary on another run. Internal session preferences and raw model plans were not separately exported; conclusions about preserved state rely on visible products, saved-look totals, controlled New-chat comparisons and the available server diagnostics.
