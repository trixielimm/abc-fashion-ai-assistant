# Stylist journey review

Started: 2026-10-20T20:14:03.424Z
Suite: everyday · Pack: stylist-journeys-v1

Automated results: {"AUTO_PASS":8,"FAIL":0,"ERROR":0,"BLOCKED_CATALOGUE":2}. Every human review is PENDING.

AUTO_PASS certifies only the listed automated checks. Check catalogue facts, missed requests, visual styling and browser behaviour before approving release.

## J01: Direct dress search and material question (v1-run1)

Automated: **AUTO_PASS** · Human: **PENDING**

Expected: Show eligible dresses, then answer about the exact named dress without changing the search.

Evidence: [J01-v1-run1.json](J01-v1-run1.json)

- [ ] Check that the answers are useful and address every part of the request.
- [ ] Compare material claims with the current product record; missing data must be acknowledged.

Reviewer: ______ · Outcome (Pass / Partial / Fail / Blocked): ______ · Notes: ______

## J02: Guided beach wedding shopping (v1-run1)

Automated: **BLOCKED_CATALOGUE** · Human: **PENDING**

Expected: Allow browsing without a size; retain occasion and budget through colour refinement.

Evidence: [J02-v1-run1.json](J02-v1-run1.json)

Failure: Need 1 eligible products, but received 0 (no_match). Inspect the catalogue to distinguish stock limits from a search bug.

- [ ] Check that the answers are useful and address every part of the request.
- [ ] If alternatives differ in occasion, disclose this; do not certify sand suitability.
- [ ] When approved eligible additions exist, the first successful response should show optional finishing touches without another prompt.

Reviewer: ______ · Outcome (Pass / Partial / Fail / Blocked): ______ · Notes: ______

## J03: Discovery from uncertainty (v1-run1)

Automated: **AUTO_PASS** · Human: **PENDING**

Expected: Help the customer choose a direction without inventing size or budget.

Evidence: [J03-v1-run1.json](J03-v1-run1.json)

- [ ] Check that the answers are useful and address every part of the request.

Reviewer: ______ · Outcome (Pass / Partial / Fail / Blocked): ______ · Notes: ______

## J16: Colour edit preserves size and budget (v1-run1)

Automated: **BLOCKED_CATALOGUE** · Human: **PENDING**

Expected: Change only colour.

Evidence: [J16-v1-run1.json](J16-v1-run1.json)

Failure: Need 1 eligible products, but received 0 (no_match). Inspect the catalogue to distinguish stock limits from a search bug.

- [ ] Check that the answers are useful and address every part of the request.

Reviewer: ______ · Outcome (Pass / Partial / Fail / Blocked): ______ · Notes: ______

## J17: Budget edit preserves item and occasion (v1-run1)

Automated: **AUTO_PASS** · Human: **PENDING**

Expected: Reduce the cap without losing the work dress request.

Evidence: [J17-v1-run1.json](J17-v1-run1.json)

- [ ] Check that the answers are useful and address every part of the request.

Reviewer: ______ · Outcome (Pass / Partial / Fail / Blocked): ______ · Notes: ______

## J18: Shoe size correction after invalid input (v1-run1)

Automated: **AUTO_PASS** · Human: **PENDING**

Expected: Accept a clear correction instead of repeating the invalid-size blocker.

Evidence: [J18-v1-run1.json](J18-v1-run1.json)

- [ ] Check that the answers are useful and address every part of the request.
- [ ] Prerequisite: the test catalogue supports shoe size 7. Do not infer a conversion.

Reviewer: ______ · Outcome (Pass / Partial / Fail / Blocked): ______ · Notes: ______

## J19: Reject an item permanently within the chat (v1-run1)

Automated: **AUTO_PASS** · Human: **PENDING**

Expected: Retain the rejection without narrowing all dresses to the rejected product type.

Evidence: [J19-v1-run1.json](J19-v1-run1.json)

- [ ] Check that the answers are useful and address every part of the request.

Reviewer: ______ · Outcome (Pass / Partial / Fail / Blocked): ______ · Notes: ______

## J26: Dress and shoes share one total (v1-run1)

Automated: **AUTO_PASS** · Human: **PENDING**

Expected: Every selectable dress-and-shoes combination fits the combined limit.

Evidence: [J26-v1-run1.json](J26-v1-run1.json)

- [ ] Check that the answers are useful and address every part of the request.

Reviewer: ______ · Outcome (Pass / Partial / Fail / Blocked): ______ · Notes: ______

## J31: Style an external owned garment (v1-run1)

Automated: **AUTO_PASS** · Human: **PENDING**

Expected: Keep the external description separate from catalogue SKUs and disclose limited pairing evidence.

Evidence: [J31-v1-run1.json](J31-v1-run1.json)

- [ ] Check that the answers are useful and address every part of the request.

Reviewer: ______ · Outcome (Pass / Partial / Fail / Blocked): ______ · Notes: ______

## J38: Strict no-match keeps every limit (v1-run1)

Automated: **AUTO_PASS** · Human: **PENDING**

Expected: Return no matches without silently relaxing constraints.

Evidence: [J38-v1-run1.json](J38-v1-run1.json)

- [ ] Check that the answers are useful and address every part of the request.
- [ ] Prerequisite: no eligible blue size-10 dress costs A$1 or less. Verify against the catalogue snapshot.

Reviewer: ______ · Outcome (Pass / Partial / Fail / Blocked): ______ · Notes: ______
