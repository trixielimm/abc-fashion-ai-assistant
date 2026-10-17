# AI Stylist customer scenario test report — 17 October 2026

**Outcome: this commit is not ready for customer-scenario acceptance.** All 28 existing offline suites pass, but the running app and production build fail. A separate real-model, fixture-backed conversation-engine assessment produces **23 Pass, 33 Fail, 1 Blocked and 3 Feature gap** across 60 recorded case runs. These 23 passes are automated component checks, not completed browser acceptance.

## Scope and reproducibility

- Specification: [20-case customer scenario pack](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/ai-stylist-customer-scenarios.md>); each case was started independently three times. S4-C includes the two S4-A setup messages, giving 189 recorded turns in total.
- App commit: `b0067a6cd70588ffe120d809614096381ac303a4`. The working tree was clean before testing. No production implementation, dependency manifest or shared catalogue was changed for this assessment.
- Environment: Node v24.14.0; Next.js 16.3.8; model `gpt-5.6-luna`; reasoning `low`; configured production interpreter prompt/schema and validation/retry behaviour. Model version is an alias, not a pinned provider snapshot.
- Model capture: **17 October 2026, 15:00:42–15:04:28 AEDT (Australia/Sydney)**; UTC 2026-10-17T04:00:42.131Z to 2026-10-17T04:04:28.874Z. Initial regression/startup checks began at 14:58 AEDT. Assessment was finalized separately from the live capture.
- Pipeline executed: `makeTurn → shortcutPlan / interpretConversation → finishConversationTurn → acceptReply`. 186 turns used the actual configured model interpreter; three used the production short-benefit shortcut. Interpreter retries can make more than one provider call per turn; provider-call/token/cost totals were not instrumented.
- Controlled catalogue: [saved fixture products, expected IDs and synthetic specifications](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-00-42-131Z/fixtures.json>); SHA-256 `eca3f32181433a31317c95232dbdfd3939febe35a57db6b56e1a24192a1938de`. These are hand-authored synthetic test records, validated through the existing specification validator. They are not supplier evidence.
- Separate live catalogue audit: 316 available rows and 316 valid stored prototype specifications, read without changing data. [Snapshot, attributes and prerequisite checks](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-catalogue-2026-10-17T04-01-13-359Z.json>).
- Readable evidence: [all assessed transcripts and displayed cards](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/ai-stylist-customer-scenarios-transcripts-2026-10-17.md>); [machine-readable assessed results](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/summary.json>); [original exploratory capture](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-00-42-131Z/summary.json>).

**Assessment correction:** the initial harness was calibrated after capture: case-insensitive labels are normalized, an honest no-cheaper response is accepted, and 15 dependent turns without displayed references are excluded. S5-C checks the actual closure explanation rather than merely an absence of a sales push. The original outputs remain intact. No extra model repetitions were used to replace failures. Final scoring reuses those recorded plans/replies. The original pilot summary is superseded by the assessed summary linked above.

## Execution results

| Layer | Result | Evidence and meaning |
| --- | --- | --- |
| Existing offline regression | **28/28 suites pass** | [Fresh regression log](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/regression-2026-10-17T03-58-17-796Z.txt>). Includes preference validation, recommendation contracts, answers, search, commerce, telemetry, presentation and in-memory integration. It explicitly excludes live/API/browser acceptance. |
| ESLint | **Pass** | [Lint log](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-lint-2026-10-17.txt>). Final check includes the new scenario and audit scripts. |
| TypeScript | **Fail** | [TypeScript log](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-types-2026-10-17.txt>): TS2307, missing `@vercel/analytics/next`. |
| Production webpack build | **Fail** | [Build log](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-build-2026-10-17.txt>): same missing analytics module. |
| Local homepage and live conversation test | **Blocked by HTTP 500** | [Live HTTP failure log](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-http-failure-2026-10-17.txt>). Response is Next.js HTML error output, not a conversation JSON response. |
| Real-model, in-process customer scenarios | **23 pass / 33 fail / 1 blocked / 3 feature gap** | 60 case runs; 121 turn checks pass, 53 fail, 15 dependent turn checks are blocked/excluded. Turn counts are not independent customer journeys. |
| Browser UI, real cart, persistence, images and aesthetic judgment | **Unverified** | App cannot start correctly. Component-level cart IDs remain unchanged; that does not establish browser cart/storage behaviour. No human fashion reviewer was used. |

The fixture component pass fraction is **38.3% of 60 runs**. It is a small observed sample, not a production reliability estimate. **Four cases pass all three automated runs:** S1-C, S5-A, S5-E and S5-F.

## All 20 cases, three runs each

Pass means the automated engine assertions for the recorded run pass. Full UI acceptance and human usefulness/taste remain unverified for every row. Each run result links to its exact input, interpreted plan, response, product IDs and state.

| Case | Run 1 | Run 2 | Run 3 | Finding / exact affected turn |
| --- | --- | --- | --- | --- |
| S1-A | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S1-A-run-1.json>) | [Blocked](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S1-A-run-2.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S1-A-run-3.json>) | R1/R3: clear complete brief receives generic rephrase (T1). R2: initial search and honest no-cheaper response pass; no new dress exists for T3, so that follow-up is blocked. |
| S1-B | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S1-B-run-1.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S1-B-run-2.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S1-B-run-3.json>) | Complete brief or simple blue/price edit receives generic or “Which item?” clarification; the full edit journey never completes. |
| S1-C | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S1-C-run-1.json>) | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S1-C-run-2.json>) | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S1-C-run-3.json>) | No cards for the A$1 combination; black, size 10 and A$1 survive the follow-up. |
| S2-A | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S2-A-run-1.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S2-A-run-2.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S2-A-run-3.json>) | All runs ask “Which item?” when adding blue (T2) and/or relaxed style (T4), although the customer is refining the shortlist. |
| S2-B | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S2-B-run-1.json>) | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S2-B-run-2.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S2-B-run-3.json>) | Rejection persists and is excluded in R1/R2. R3 unnecessarily asks which product on the next search (T3). |
| S2-C | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S2-C-run-1.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S2-C-run-2.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S2-C-run-3.json>) | “First bag” is interpreted with subcategory Bags, while displayed bags are Clutches (T2). The explicit zip filter then gets blocked by an unnecessary context reference (T3). |
| S3-A | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S3-A-run-1.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S3-A-run-2.json>) | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S3-A-run-3.json>) | R1 selects an outfit piece from “I like” (T4). R2 cannot browse after category confirmation (T3). R3 completes the automated checks. |
| S3-B | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S3-B-run-1.json>) | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S3-B-run-2.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S3-B-run-3.json>) | Browsing without optional colour/size/budget works in R1/R2. R3 asks which item instead of browsing (T2). |
| S3-C | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S3-C-run-1.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S3-C-run-2.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S3-C-run-3.json>) | R1 changes category cleanly. In R2/R3, the black bag restriction is omitted or stored as style; Beige B-OPEN-45 is displayed (T2). |
| S4-A | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S4-A-run-1.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S4-A-run-2.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S4-A-run-3.json>) | R1 preserves and explains the owned anchor. R2 asks which dress during matching (T3). R3 applies own followed by keep, downgrading owned to selected (T2). |
| S4-B | [Feature gap](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S4-B-run-1.json>) | [Feature gap](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S4-B-run-2.json>) | [Feature gap](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S4-B-run-3.json>) | All runs browse wedding shoes under A$100, but cannot retain plain/navy/midi as an external owned anchor. The second response is generic and does not continue the requested styling. |
| S4-C | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S4-C-run-1.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S4-C-run-2.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S4-C-run-3.json>) | No full multi-anchor run succeeds. Bag ownership fails in R2/R3; R1 retains both pieces but asks which bag rather than matching shoes against both (T5). |
| S5-A | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-A-run-1.json>) | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-A-run-2.json>) | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-A-run-3.json>) | All runs answer no pockets, offer the A$120 pocketed replacement, calculate A$25 extra, and retain the A$95 original and A$150 limit. |
| S5-B | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-B-run-1.json>) | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-B-run-2.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-B-run-3.json>) | R1/R2 return only VB-ELIGIBLE, excluding wrong occasion/colour/size/price decoys. R3 fails the initial complete brief (T1); dependent steps are excluded. |
| S5-C | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-C-run-1.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-C-run-2.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-C-run-3.json>) | No expensive identical bag is promoted, which is good. R1/R3 omit the actual closure comparison; R2 incorrectly treats the supported closure request as unresolved (T2). |
| S5-D | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-D-run-1.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-D-run-2.json>) | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-D-run-3.json>) | R3 correctly shows A$80/A$65 alternatives and A$0/A$15 differences. R1 cannot explain “the cheaper one” (T3); R2 stores adjustable strap as unsupported (T1). |
| S5-E | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-E-run-1.json>) | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-E-run-2.json>) | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-E-run-3.json>) | All runs disclose pockets gained, lining lost and A$25 difference; requiring both lining and pockets removes the ineligible replacement. |
| S5-F | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-F-run-1.json>) | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-F-run-2.json>) | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S5-F-run-3.json>) | All runs preserve unknown original lining and refuse to establish an improvement solely from a candidate’s known lining. |
| S6-A | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S6-A-run-1.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S6-A-run-2.json>) | [Pass](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S6-A-run-3.json>) | R3 keeps shoe size 38, reports 4 cm heels and Rubber soles, and honestly finds nothing cheaper than its cheapest first pair. R1 blocks the cheaper follow-up; R2 fails initial vocabulary interpretation. |
| S6-B | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S6-B-run-1.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S6-B-run-2.json>) | [Fail](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/docs/test-evidence/customer-scenarios-2026-10-17T04-05-28-005Z/S6-B-run-3.json>) | All runs fail initial search despite two eligible fixtures: Necklaces is put in subcategory instead of Jewellery/product_type Necklace. Material/fastening steps are blocked. |

The single Blocked run (S1-A/R2) is **a fixture/reference limitation, not an AI failure**: ranking placed the cheapest eligible dress first, so there was no cheaper result to ask about. The no-match response itself preserved the requirements. Future fixtures should ensure the first displayed reference has an eligible cheaper alternative, rather than assuming its order.

## What works

1. **The core value-comparison calculations and safeguards are strong when the intent is interpreted correctly.** S5-A passes 3/3 with a supported pocket gain and A$25 increment; S5-E passes 3/3 with a lining loss disclosed and both-feature enforcement; S5-F passes 3/3 without treating unknown as false. Synthetic benefit provenance is retained in comparison evidence.
2. **The deliberately empty combination is handled safely.** S1-C passes 3/3, with no over-budget, wrong-colour or wrong-size cards and no silent relaxation of the A$1 restriction.
3. **Products and recorded prices stay grounded.** Across all 143 displayed card occurrences in the original capture, every ID exists in its corresponding fixture, every price matches that row, and each row is available and in stock. This says nothing about whether the interpreter retained every raw customer requirement; the black-bag failures demonstrate that separate problem.
4. **Useful conversation behaviours exist but are inconsistent.** Rejection persists in two full S2-B runs; browsing without size/budget succeeds in two S3-B runs; two S5-B runs reject all wrong-colour, wrong-size, wrong-occasion and over-budget decoys. One S4-A run preserves ownership and gives an evidence-qualified pairing explanation.
5. **Shoe construction answers can work.** In the two S6-A runs that display shoes, the factual response gives the exact fixture’s 4 cm heel and Rubber sole without changing the requirements. The full R3 run preserves shoe size 38 and the A$120 ceiling.

## Problems and suggested improvements, in priority order

### P0 — Restore a runnable application

[app/layout.tsx](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/app/layout.tsx:3>) imports `@vercel/analytics/next` and renders `<Analytics />` at line 61, but the installed dependencies and package manifest do not provide it. This breaks TypeScript, the homepage, the live endpoint test and the production build.

**Improve:** add the intended analytics package and commit the matching manifest/lockfile, or remove the import/component if analytics is optional. Verify with a clean install, type check, production build and HTTP smoke test before rerunning UI scenarios. This report does not apply either change.

### P1 — Enforce hard requirements independently of the model’s chosen field

In S3-C/R2/T2, the customer asks for a **black bag under A$80**, but the plan has no preferred colour. In R3, black is stored as `style`. Both return **Beige B-OPEN-45**. The reply validator checks cards against the extracted preferences, so it cannot catch a colour the interpreter omitted or misclassified. This is a real hard-restriction violation, not a catalogue shortage.

**Improve:** validate supported explicit constraints and field/value combinations before retrieval; normalize clear colour terms into the colour field; reject plans that omit an explicitly stated hard requirement. Preserve provenance from the latest message through the resulting filter. Add regression assertions against the raw customer brief as well as the model-generated filters. Acceptance: neither of these black-bag messages may display Beige B-OPEN-45.

### P1 — Make ordinary refinements independent of product selection

S1-B, S2-A, S2-B/R3 and S3-B/R3 repeatedly ask “Which item?” for changes to a shortlist. Recorded plans set `reference: {kind: context}` during `refine`; [the reference check](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/lib/stylist/conversationPlan.ts:290>) resolves that to a single item and blocks when several are visible.

**Improve:** treat blanket colour, budget and style edits as operations on the current shopping scope. Require a single-product reference only for actions that need one. Add exact live and deterministic cases for “blue instead,” “my maximum is now A$100,” “more relaxed,” and “other options.” Acceptance: update the requested field, retain all others, and search without an unnecessary item-selection question.

### P1 — Resolve product roles, categories and subcategories correctly

All S2-C runs interpret “first bag” as `subcategory: Bags`, while the actual cards have subcategory Clutches. [The ordinal resolver](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/lib/stylist/productReference.ts:90>) filters by exact subcategory and finds no product. S6-B separately invents subcategory Necklaces instead of the fixture hierarchy Accessories → Jewellery → Necklace. Several dress plans also put a colour into style or Dresses into product_type. These failures are visible in the saved plans and do not require guessing a provider error.

**Improve:** supply the interpreter with the compact allowed hierarchy and category-specific fields; validate and normalize the interpreted schema against it. Resolve broad “bag/shoe/necklace” references using category/product type or the visible list, rather than treating the broad noun as an exact subcategory. Acceptance: “the first bag” resolves to the actual first displayed bag; silver necklaces browse immediately when eligible fixture records exist.

### P1 — Guard customer-controlled outfit transitions

S3-A/R1/T4 turns **“I like the first dress”** into a selected outfit item, contrary to the specification. S4-A/R3/T2 emits both `own` and `keep` for the same product. [The outfit update loop](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/lib/stylist/conversationPlan.ts:127>) processes them sequentially, and the latter writes ownership selected over owned. Bag ownership/reference failures also stop S4-C.

**Improve:** require explicit selection wording for `keep`; prevent a mere expression of interest from changing outfit state. Deduplicate same-product operations and preserve owned status when “keep” means retain an already owned piece. Handle explicit multiple owned anchors as a collection, with pairing evidence listing both IDs. Acceptance: likes leave outfit/cart untouched; own-and-keep stores one owned piece; both anchors survive the shoe search.

### P2 — Explain the actual benefit comparison and keep its reference

S5-C safely avoids selling an identical expensive bag, but never completes the specified closure comparison: two runs omit closure entirely and one treats a supported zip closure as unsupported. S5-D/R1 cannot explain “the cheaper one”; R2 unnecessarily adds adjustable strap to unresolved requirements even though feature support exists.

**Improve:** route supported closure/strap terms to their typed feature keys, avoid duplicate unresolved entries, and resolve “cheaper one” against displayed alternatives and the stored original. Explain the recorded equality or gain with the exact two prices. Acceptance: S5-C explains the same recorded closure and no useful gain; S5-D states A$0 extra and A$15 less, without a generic rephrase or unrelated priority question.

### P2 — Add a structured external owned-item record

S4-B is a confirmed feature gap. Generic ownership stores a category, not a description and attributes. Wedding shoes within budget are a useful fallback, but the app does not preserve plain/navy/midi as a matching anchor or meaningfully continue after “work from that description.” No external SKU is invented in the tested replies.

**Improve:** store a customer-described external item separately from catalogue products, with customer-provided colour, type, length and occasion plus unknown fields. Use qualified pairing suggestions and acknowledge that the match is based on a description. Until available, explicitly explain the limitation before offering the shoe shortlist. Acceptance: both turns retain the description without inventing a product ID, material or exact shade.

### P2 — Make failures diagnosable and acceptance tests authoritative

Nine original turns end in the generic “Could you rephrase” fallback. [The plan retry/fallback path](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/lib/stylist/conversationPlan.ts:338>) catches schema/evidence/plan failures, retries once and replaces both failures with that generic clarification. The saved public result does not retain which validator failed, so the precise cause of these nine turns is **unconfirmed**.

The existing live-answer script also prints “0 live requests passed; 0 failed scenarios” after its initial seed throws on an HTML 500 response. It then exits with a JSON parsing error. Those zero counters are not a successful test result.

**Improve:** record structured failure stage, validation field and retry count server-side; distinguish an interpretation failure from a genuinely ambiguous brief. Record seed/preflight errors as blocked/failed, and inspect HTTP status/content type before parsing JSON. Add these 20 cases to a repeatable acceptance job; keep deterministic logic tests, controlled real-model runs and browser tests as separately reported layers. Require zero hard-restriction and unintended state-mutation failures before release.

## Catalogue readiness and human review

| Live prerequisite | Matching available records | Consequence |
| --- | ---: | --- |
| Black dress, size 10, at or below A$150 | 0 | A live S1 shopping journey cannot continue beyond an honest no-match response. |
| Black dress, size 10, at or below A$1 | 0 | Deliberate no-match combination is present. |
| Blue beach-wedding dress, at or below A$150, any size | 0 | The S2-A blue comparison and live S5-B setup are unavailable. |
| Work dress, at or below A$120 | 0 | No live S2-B rejection fixture. |
| Bag, at or below A$100, synthetic zip closure true | 8 | Feature-filter data exists for a live bag follow-up. |
| Black work shoes, size 38, at or below A$120 | 0 | S6-A’s exact live fixture is unavailable; size 38 is absent from the catalogue’s recorded available labels. No conversion was inferred. |
| Silver necklace, at or below A$80 | 0 | No live S6-B fixture. |

Keep these as versioned local/test-environment fixtures. Do not change shared products merely to force a green run. For value cases, retain original/replacement/decoy IDs, feature null/false distinctions and exact price arithmetic. For cheaper follow-ups, set up and verify the actual first displayed product before assuming a lower-priced alternative will exist.

Human review remains required for outfit taste, whether colours visibly coordinate, shortlist variety and customer usefulness. The synthetic fixture catalogue deliberately has simple repeated styles; label compatibility does not establish visual compatibility. The generic external-item fallback and repetitive priority question are visible clarity weaknesses even without a fashion review.

## Timing and remaining acceptance work

Across 186 original model-interpreted turns, in-process durations were **median 2.89 s, p95 8.95 s, maximum 17.57 s**. This includes interpretation, any internal validation retry and local execution; it excludes browser rendering, live catalogue retrieval and network image work. Three production shortcut turns were measured separately. No provider cost/token accounting was captured.

Recommended completion order:

1. Repair the analytics dependency and verify startup/build/type checking.
2. Add hard-intent fidelity, safe outfit transitions and role-aware reference handling; replay the exact failures as deterministic regressions.
3. Rerun all 20 cases three times with a frozen fixture and the same model settings, retaining every result. Keep the cheaper-reference fixture limitation separate from behavioural failures.
4. Execute the pack through the browser, including new-chat isolation, displayed cards, no-extras controls, real cart state and persistence. Run production HTTP checks as well.
5. Have a human review pairing taste, clarity, relevance and usefulness; retain their rationale separately from automated correctness.

## Commands and delivered files

Commands were run from the repository root; the fixture runner makes configured model calls unless replay mode is set:

```sh
node scripts/run-regression.mjs
npm run lint
./node_modules/.bin/tsc --noEmit --incremental false
npm run build -- --webpack
node --env-file=.env.local --import tsx scripts/test-conversation-answers-live.mjs http://127.0.0.1:3000
node --env-file=.env.local --conditions=react-server --import tsx scripts/test-customer-scenarios.mjs
node --env-file=.env.local --conditions=react-server --import tsx scripts/audit-customer-scenario-catalogue.mjs
```

Offline reassessment of the saved live capture (no model calls):

```sh
SCENARIO_REPLAY=docs/test-evidence/customer-scenarios-2026-10-17T04-00-42-131Z node --conditions=react-server --import tsx scripts/test-customer-scenarios.mjs
```

The new reusable scripts are [customer scenario runner](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/scripts/test-customer-scenarios.mjs>) and [read-only catalogue auditor](</Users/beatricelim/Documents/Session 2 2026/COMP3850 PACE/abc-fashion-ai-assistant/scripts/audit-customer-scenario-catalogue.mjs>). Full transcripts, fixtures, plans, replies, states, durations and fresh regression/build/type/lint evidence are linked throughout this report. Production code and shared data remain unchanged.
