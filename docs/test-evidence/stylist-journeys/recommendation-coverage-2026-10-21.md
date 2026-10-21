# Recommendation journey coverage — 21 October 2026

The v2 pack has 13 everyday journeys and 54 prerelease journeys (49 live definitions and five controlled recovery cases). All original J01–J50 definitions are retained. The generated [manual guide](../../ai-stylist-journey-pack.md) includes the new wordings, expected outcomes, catalogue prerequisites and browser reviews.

New coverage:

- J51, both suites: complementary products on the first beach-wedding dress response, independent prices and dress-only budget, questions about actual additions, primary dress ordinals, selecting only the addition, and no repeated pitch on refinement.
- J52, both suites: pause unsolicited extras, then fulfil an explicit request for the returned dress's recorded complementary category while keeping the pause. Returned products must carry pairing evidence for that dress.
- J53, both suites: owned bags and shoes suppress duplicate recommendations while other unowned roles remain eligible.
- J54, prerelease: refresh additions for another displayed dress through `offer_anchor_id`; keep primary results, filters, saved selections and cart unchanged.

Required recommendation previews fail when absent. Product bindings use returned names and IDs, with separate primary and complementary pools. The harness independently checks pricing, shared versus item restrictions, pairing anchors, ownership suppression and reference order. The source fingerprint includes both fixture files.

## Validation

- Pack validation passed: 54 journeys, 13 everyday, 49 live, five controlled faults, 111 primary live turns.
- Final offline regression: **45/45 scripts passed**, including 20 journey-harness checks. [Regression evidence](../regression-2026-10-20T20-53-51-261Z.txt).
- ESLint and `git diff --check` passed.
- Live scope: all three wordings of J51–J54 using fresh synthetic customer prompts through the local HTTP endpoint and read-only catalogue access. The original 50 cases were not rerun live for this test-pack update.

The [initial prerelease run](2026-10-20T20-49-15-283Z-prerelease/summary.json) completed 12 trials: eight AUTO_PASS and four FAIL. J51 and J53 passed every wording; J54 passed wordings 1 and 2.

Two initial failures were a test-design problem: J52's generic “find an extra” follow-up legitimately asked which category. The final test explicitly names the bound dress's recorded complementary category, without changing the opening wordings or accepting a clarification as a successful recommendation.

The [corrected J52 run](2026-10-20T20-52-26-407Z-prerelease/summary.json) passed wordings 2 and 3; wording 1 received HTTP 502 `CONVERSATION_FAILED`. A [fresh everyday retry of wording 1](2026-10-20T20-54-27-211Z-everyday/summary.json) passed. These remain separate runs, with the earlier failures and transport error preserved.

## Application issues exposed by the tests

1. **J52, opening wording 2:** “I only need a women's beach wedding dress, maximum 200 AUD.” unexpectedly added an unresolved “beach suitability” requirement and asked for clarification instead of returning dresses. This failed in the initial run and passed on the later fresh run; the earlier failure remains evidence of inconsistent interpretation. [Failed trial](2026-10-20T20-49-15-283Z-prerelease/J52-v2-run1.json).
2. **J54, opening wording 3:** the user requested dress options at any price before choosing a size. The endpoint returned eligible dresses but set `offers_paused: true`, despite no request to pause, and omitted the required complementary preview. The test correctly failed before rematching could run. This application issue remains unresolved. [Failed trial](2026-10-20T20-49-15-283Z-prerelease/J54-v3-run1.json).

No application implementation was changed in this test-pack update. Human review remains pending for styling quality, catalogue facts, card rendering, rematching in the browser, hiding suggestions, pausing extras through the UI, and dismissal after reload.

To rerun the new coverage:

```sh
npm run test:journeys:everyday -- --filter J51,J52,J53 --base http://127.0.0.1:3004
npm run test:journeys:prerelease -- --filter J51,J52,J53,J54 --variant all --base http://127.0.0.1:3004
```
