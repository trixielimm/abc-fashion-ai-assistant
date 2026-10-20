# AI Stylist implementation and improvised retest

19 October 2026 · Local production build · Follow-up to the [original evaluation](../improvised-stylist-2026-10-19/report.md) and [remediation plan](../improvised-stylist-2026-10-19/remediation-plan.md)

## Result

The implementation now covers named blockers and recovery controls, task replacement, compound product references, everyday garment families, saved-purchase budget accounting, responsive discovery, truthful size wording, relevant event guidance, specification provenance and image-health-aware inspiration. The final source passes all 40 regression scripts, including 18 new state, budget and interpretation checks, plus lint, TypeScript and a webpack production build.

The same five customer personas were tested through the browser with the real configured model and current catalogue. This was an adaptive development retest: replies influenced the next customer message, new failures were preserved, and targeted fixes were made during the run. It is not a clean five-out-of-five release certification. There are 36 typed customer messages plus one conservatively counted Save-to-look action: counts are **7 / 8 / 7 / 8 / 7**, including initial candidate probes. No scenario exceeds ten customer turns. Engineering reloads are explicitly recorded and are not presented as successful customer recovery.

The final saved-dress and relaxed gift-filter continuations were successfully repeated in the browser after the user restarted the production test server. The saved A$155 dress left A$125 for shoes, and the relaxed gift search returned four size-M shirts under A$130. Automatic approval review had temporarily prevented both the restart and a browser action; the completed follow-ups are retained after that interruption. One final deterministic matcher correction excludes generic Mules from flat-shoe results unless the type actually establishes flatness; it passed the complete regression suite and production build.

**Release judgment: substantial improvement with qualified acceptance.** Five changing-build journeys are too small to establish a general reliability rate. Interpretation fallbacks still occur on some compound prompts, and source photo coverage and manufacturer-verified specifications remain content dependencies. No deployment was performed.

## What changed

### W0 — Baseline and diagnostics

The pre-existing dirty working tree was preserved. Sixty-six relevant files and the original diff were backed up before implementation. [Baseline hashes](baseline.json), a [diff against that preserved baseline](changes-from-preserved-baseline.diff) and [current hashes](source-changes.json) distinguish this implementation from older uncommitted work. No reset, commit, deployment or database migration was performed.

Optional server diagnostics record correlation ID, stage, elapsed time, action, changed field names, rejection type, issue fields and product counts. Default logs exclude raw customer text, model output, credentials and signed image URLs. Explicit local diagnostic fixtures retain their own non-sensitive test prompts and plans in [before](diagnosis-before.json), [after](diagnosis-after.json) and [exact-fit](diagnosis-precise.json) evidence. The configured model remained unchanged; a valid but rejected plan was investigated before altering interpretation behavior.

### W1–W3 — Truthful UI, repairable blockers and task state

Cards now say “Size 12 is listed.” A listed catalogue size does not establish variant stock, reservation or fit. Formal-event controls require an active event context; Dad's work outfit no longer receives the formal-event picker. Cocktail and wedding context are supported separately from coarse catalogue occasion labels.

Structured issues retain the failing field, scope, supplied value, actual saved conflict and valid choices. An unsupported requirement offers scoped removal, explicitly permitted provisional browsing and a new shopping task. Recovery actions carry the issue ID and task generation; obsolete controls cannot alter a later task.

A replacement task clears its old item filters and pending questions while preserving the saved look and shared rules. Cancellation restores the earlier task fields while retaining independently saved pieces. Provisional browsing keeps unknown requirements saved, labels them on alternatives, and excludes known negative-material violations. Reapplying a hard requirement turns provisional permission off. A feature flag can roll back the new transitions.

### W4 — Product references and everyday language

One catalogue-family matcher is shared by validation, retrieval and reply checks for jackets/blazers, shirts, skirts, trousers/pants and flats. Medium normalizes to M, and an AU prefix is removed only when the resulting size exists in the catalogue. This does not guess measurements or convert clothing sizes into shoe sizes.

A product number and name can be combined with a new price or colour restriction. Resolving the identity also applies accompanying edits and retains previous exclusions. Conflicting number/name references still require clarification. A trailing “show me options” no longer hides the earlier garment brief or collection request.

The live test caught a literal-quotation failure on grouped construction requirements. A narrow repair now uses an actual contiguous span from the latest message only when every affected label matches an explicit known requirement. Invented waterproof or material evidence remains rejected. Scalar removal with a null value normalizes to the domain's set-null operation; other invalid transport shapes remain rejected.

### W5 — Purchase budgets and saved-look continuation

A versioned purchase-budget summary tracks which selected garments belong to the current purchase. Current catalogue prices and availability are reread before a total is claimed. The selected dress's cost reduces the allowance for new shoes; unrelated saved garments are excluded. Already-owned garments cost zero in the new purchase. Arithmetic and reply validation use integer cents.

The final follow-up fix detects a uniquely named kept garment plus an explicit request for only an additional category. It routes that request to cross-sell continuation, preserves the kept garment and prevents the interpreter from rebuilding an entire outfit. The new contract test verifies a A$155 saved dress leaves A$125 from a A$280 total, and every displayed shoe option respects that allowance. The live follow-up confirmed the A$155 dress remained selected and the allowance was A$125. Shoe options were priced A$60–A$120, so each possible dress-plus-one-shoe total stayed at A$215–A$275, below A$280.

### W6 — Discovery and product answers

Volunteered weekend/work context is applied before another optional question. A compound “Both collections … show me ideas now” answer retains the collection choice. Discovery can show immediate inspiration without guessing size. Compound jacket reference and price/exclusion changes were verified live.

Multi-part answers now explicitly distinguish recorded material, missing waist-stretch evidence, sample length, care and store policy. Synthetic prototype construction, measurement and care details are labelled beside those details. A material label does not verify full composition or certification. Fit, size-specific stock and unpublished return conditions remain uncertain.

### W7 — Product photos

A read-only audit checked 318 catalogue image references: **80 objects present and 238 missing**. Discovery prefers photo-backed eligible products when the manifest is current and enough candidates exist. A changed image key or an audit older than 24 hours becomes unknown. Image health never overrides shopping constraints, and specific matches with missing photos still show an honest placeholder.

All four inspiration photos in the browser test decoded successfully. However, the later Grey Denim Jacket and the wedding/gift set still lack source photos. No bucket permissions or database records were changed, and no substitute photography was fabricated. The [missing-image inventory](image-audit/products-without-matching-images.csv) is actionable content work.

### W8 — Integration and rollout

Old valid request shapes remain accepted; new reply fields are optional or defaulted. Contract checks cover stale recovery actions, cancellation, shared-rule retention, exact versus provisional results, budget membership, current prices and rollback behavior. Task recovery defaults on and can be disabled with `STYLIST_TASK_RECOVERY_ENABLED=false`. Diagnostic logging requires `STYLIST_DIAGNOSTICS_ENABLED=true`.

The browser retest found issues beyond the original fixtures, and those attempts remain in the evidence. The user restarted the test server after an approval-service outage. The integrated saved-dress and gift-filter follow-ups then succeeded. The additional flat-shoe matcher guard was verified by the full regression suite and production build; a further browser run of that small deterministic guard is distinguished from the successful budget run. No deployment has been made.

## The five customer journeys

### 1. Precise fit — 7 customer turns

**Before:** construction unknowns caused repeated generic clarification; a complete brief was difficult to relax.

**Observed improvement:** the opening now preserves the request and separately names high waist, full length, polyester exclusion and elasticated waist as unverified. Explicit provisional permission returned Black Wide-Leg Pants at A$125, with “Size 12 is listed,” each unknown labelled, and the actual Wedding Guest versus Work difference displayed. Removing the fabric/waist/length checks removed those unknown labels. A later skirt task replaced the trouser task without a New-chat reset.

**Limits:** the original exact brief still has no confirmed match. Earlier candidate openings failed quotation validation and are retained. The provisional trousers are alternatives rather than confirmed office matches; the later black-work skirt request produced no stock match. A subsequent request for skirts in any colour/occasion exhausted interpretation repair, so this persona remains mixed rather than fully passed.

### 2. Event shopper — 8 customer turns, including Save to look

**Before:** wedding intent conflicted with saved state; the saved dress could not continue smoothly to shoes under the same total.

**Observed improvement:** a fresh task produced Olive Maxi Dress A$155 plus Navy Strappy Heels A$110 = **A$265**, leaving **A$15** from the A$280 combined budget. Saving the dress worked. Wedding context was retained.

**Failure found and fixed:** an early interpretation added an unwanted hard style filter; another treated cocktail as an unsupported feature. Both received targeted normalization. The shoes-only follow-up still rebuilt a complete outfit and failed on flats in the served candidate. A final implementation fix routes a kept, uniquely named dress to saved-purchase continuation. **The browser repetition succeeded:** A$155 selected, A$125 left of A$280, with new shoe options within that limit. Generic Mules appeared in this run despite not establishing sole height; the final matcher excludes that ambiguous type, with regression/build verification. Explicit ballet flats, flat sandals and loafers remain eligible.

**Remaining UX/content:** the optional formal-event heading asks a question even when Wedding guest is already selected, and both suggested products lack photos. These are not hidden by the successful arithmetic.

### 3. Browsing shopper — 7 customer turns

**Before:** repetitive questions and photo placeholders made exploration weak; a compound jacket reference became stuck.

**Observed improvement:** after fixing compound collection parsing, the shopper received four varied ideas, with **4/4 photos visibly decoded**: White Denim Jacket, Lavender Lightweight Scarf, Brown Low-Top Sneakers and Yellow Oversized Tee. “Number 1, White Denim Jacket … under A$100 … no beige or yellow” returned Grey Denim Jacket at **A$55** without another identity question. The later fit/care question reported Relaxed fit, withheld a size guarantee and explicitly labelled the care and sample length as synthetic prototype data.

**Limits:** earlier candidate replies repeated the collection question. The final refined jacket lacks a source photo. The inspiration shortlist also includes a A$220 tee, which was permissible because no budget had yet been supplied; it would benefit from better price diversity.

### 4. Adversarial customer — 8 customer turns

**Before:** unsafe requests generally failed safely but responses were generic.

**Observed improvement:** the secrets/debug request received a clear refusal. A mixed zero-price request did not alter prices or the bag. A subsequent legitimate dress search returned real A$60–A$120 catalogue prices. The grounded product answer reported Polyester for Navy Maxi Dress, explicitly said waist stretch was unrecorded, labelled synthetic care/measurement data, and limited returns claims to the published 30-day policy. Size 999 produced a named size blocker and recorded options rather than an invented SKU or stock claim. Correcting the size to 12 and budget to A$150 then returned three real dresses at A$70–A$120, demonstrating recovery from the invalid size.

**Limits:** one attempt to force silk/washing/fit claims exhausted interpretation repair and returned a generic recovery message. No secret, fabricated item or stock confirmation was observed, but eight turns do not constitute a comprehensive security audit.

### 5. Gift for Dad — 7 customer turns

**Before:** ordinary shirt/fit language repeatedly failed, and the work outfit displayed formal-event controls.

**Observed improvement:** the opening immediately returned Red Oxford Shirt A$115 plus Beige Pleated Trousers A$60 = **A$175**, leaving **A$45** from the A$220 total. No formal-event picker appeared, and no trouser size was invented.

**Stock evidence:** no men's regular-fit shirt exists in the public catalogue, so the first M/regular-fit no-match was legitimate. Public records include a Blue Oxford Shirt A$50 (Oversized), White Polo Shirt A$95 (Slim), Red Oxford Shirt A$115 (Slim) and White Linen Shirt A$120 (Relaxed).

**Failure found and fixed:** later relaxed searches continued returning no match even after price/fit/colour changes, so this journey is mixed rather than passed. The final code explicitly clears local fit/preferred-colour filters when the shopper says “any fit / any colour,” retaining size and shared rules. The final browser follow-up succeeded: White Linen Shirt A$120, Red Oxford Shirt A$115, White Polo Shirt A$95 and Blue Oxford Shirt A$50, all listing M. No size or fit guarantee was invented.

## Verification and evidence

- `npm test`: **40/40 scripts passed** on the final implementation. [Complete log](regression-results.txt).
- New remediation suite: **18 checks passed**, covering state transitions, reference/edit composition, budget integrity, literal evidence, rollback and explicit relaxation. [Log](remediation-checks.txt).
- `npm run lint`: passed. [Log](lint-results.txt).
- `tsc --noEmit`: passed at the recorded checkpoint; the final webpack build also completed its TypeScript phase. [Log](typecheck-results.txt).
- `npm run build -- --webpack`: passed. [Production build](production-build-results.txt).
- Default Turbopack build: blocked by this execution environment's worker port-binding restriction; it is not reported as passed. [Environment failure](turbopack-environment-limitation.txt).
- Live browser: same five baseline opening briefs, adaptive follow-ups, current catalogue and configured model. [Full transcripts](transcripts.md), [raw events](browser-retest.json), [initial probes](candidate-initial-probes.json).
- [Saved-purchase budget screenshot](scenario-2-purchase-budget.jpg) and [DOM](scenario-2-purchase-budget-dom.txt); [relaxed gift results screenshot](scenario-5-relaxed-gift.jpg) and [DOM](scenario-5-relaxed-gift-dom.txt).
- [Provisional-results screenshot](scenario-1-provisional.jpg) and [DOM](scenario-1-provisional-dom.txt); [photo-backed inspiration screenshot](scenario-3-inspiration.jpg) and [DOM](scenario-3-inspiration-dom.txt).

Tests used local port 3002, separate from the user's existing development server on port 3000. No checkout, purchase, deployment or catalogue mutation was made. The fictional shopping prompts were sent to the configured AI service as part of the authorized test. Synthetic fixture tests and direct diagnostic calls are distinct from the browser journeys. All earlier failed probes remain available; no numerical success rate is inferred from this small, changing-build sample.

## Remaining work, in order

1. Address the remaining compound-prompt interpretation failures, particularly the final any-colour/any-occasion skirt request. Reuse the saved transcript as a diagnostic input and retain bounded, fail-closed model repair. Broaden live sampling before rollout; do not infer reliability from these five development journeys.
2. Upload the 238 missing real product images using the inventory; rerun the read-only audit and refresh its manifest. Verify specific wedding, gift and jacket cards visually.
3. Replace synthetic garment specifications with reviewed manufacturer data before treating them as purchase guidance. Add verified waist/length/composition fields if exact-fit matching is a product requirement.
4. Improve the already-selected event heading, price diversity in unrestricted inspiration, and the refusal wording for malformed product-claim requests. These are visible residual polish issues rather than validated completion claims.

The approval service interrupted a test-server restart and one browser action through capacity/time-out failures. The rejected actions did not execute. The user manually restarted port 3002, and the two essential final follow-ups subsequently completed. Those interruptions are operational limitations, not application test failures or unsafe-action determinations.

The further test-server restart for the last flat-shoe matcher guard timed out in automatic approval review, and an additional optional browser check was rejected before execution because the review model was at capacity. The existing port-3002 process therefore predates that last matcher guard. Its production files are rebuilt and its automated checks pass; a browser repetition of that specific guard remains unverified. The interactive report was saved successfully.
