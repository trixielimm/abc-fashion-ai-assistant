# Category collection defaults

Implemented 19 October 2026. This extends the approved dress-default plan to skirts, as agreed in the chat.

## Result

- A positive dress request defaults to Women / Clothing / Dresses. A generic dress does not acquire a guessed dress type.
- A positive skirt request defaults to Women / Clothing / Bottoms / Skirt. The actual catalogue stores Midi Skirt and Pleated Skirt under Bottoms; generic Skirt is validated as an umbrella over recorded skirt types. Trousers remain excluded.
- Explicit latest-turn requests for Men, Women, Unisex or Both take priority. Both remains different from Unisex.
- Shirts, trousers, suits, jackets and shoes have no category default. Saved preferences apply when available; unresolved clothing requests receive the existing collection question.
- The current item's effective collection/source is remembered separately from the explicit browsing preference. A dress default does not silently set Women for later generic clothing searches.
- A newly stated full dress/skirt request can override an earlier ordinary Men's browsing filter, including a repeated request after no_match. Short edits such as “cheaper”, “under $150” and “more dresses” retain the current item's collection.
- Shared collection restrictions remain authoritative. A conflict produces a focused question before any search.
- Explicit men's dress/skirt no-match replies identify the searched collection and offer opt-in Women's/Both choices. Those choices retain the occasion, budget and other saved requirements.

The server excludes dress shirt, dress shoes, dress code, dress me, negations, personal identity, owned garments and styling anchors from category-default evidence. Pure product questions do not change collection state. Broad formal-clothing requests still ask collection when unresolved.

## Changes

`lib/stylist/collectionPreference.ts` centralises the default allowlist, target detection, explicit-collection parsing, precedence and current-item provenance. Older sessions without provenance remain accepted. `conversationPlan.ts` resolves the collection before prompting/search, validates model evidence against the same rules, and preserves shared restrictions. `conversationGrounding.ts` grounds Dresses and the actual Bottoms/Skirt hierarchy, handles repeated requests and prevents the previous defaulted category from leaking into a new request. It also preserves numeric AUD budgets such as “under 200 aud”.

`conversationProtocol.ts` transports optional provenance and clears it when focusing a genuinely different product. `conversationTurn.ts` explains recovery from the old Men's filter and supplies the explicit no-match choices. `shoppingPresentation.ts` retains focused shared-collection conflict questions. Interpreter instructions describe the same precedence and catalogue hierarchy.

The existing product/search fixtures now label synthetic clothing as Women, so collection-filter tests use meaningful catalogue metadata. No production catalogue records, database schema, cart behaviour or configuration were changed. Existing unrelated working-tree edits were preserved.

## Verification

- **17 focused category-default checks** cover fresh dresses/skirts, positive and tentative item requests, legacy checkpoint recovery, explicit overrides, current-item refinements, category switching, shared conflicts, misleading dress phrases, absent stock, no-match choices, product questions, legacy state, reset/page focus and retry replay.
- **38/38 offline regression scripts passed** after the final code changes, including the collection-first, guided-discovery, product-answer, outfit and commerce suites. See [the final regression report](test-evidence/regression-2026-10-19T02-19-48-315Z.txt).
- **10/10 focused live model scenarios passed**, 19 turns total: original collection-first cases, default dress, budget refinement, default skirt, legacy checkpoint recovery, explicit men's dresses, dress shirt and shared-Men conflict. These use isolated synthetic catalogue records and actual configured-model interpretation. See [live scenario summary](test-evidence/customer-scenarios-2026-10-19T02-18-09-559Z/summary.json). An earlier dress-shirt check unnecessarily required subcategory Tops even though an explicit Dress Shirt product type safely identifies the request; the check now accepts null or Tops and still requires collection onboarding.
- **10/10 recorded-plan replays passed** against the final implementation, without new model calls. See [replay summary](test-evidence/customer-scenarios-2026-10-19T02-19-48-615Z/summary.json).
- **Browser on localhost:3000:** “I want a dress for work under 200 aud” skipped collection onboarding and showed labelled alternatives under A$200. The visible catalogue lacked exact Work dress matches; alternatives disclosed their different recorded occasions. “I want a skirt for work under 200 aud” immediately returned Brown Midi Skirt at A$145, recorded for Work, without a collection question.
- **Browser recovery:** an explicit men's dress request correctly returned no_match and offered Women's/Both choices. Repeating “I want a dress for work under 200 aud” then switched this request to the women's dress collection and returned labelled alternatives within the original A$200 limit.
- **Lint and production build passed**, including TypeScript and page generation, using `npx next build --webpack`. Webpack was used because the earlier collection-first work established a Turbopack worker-port restriction in this environment; project build configuration was not changed.
- `git diff --check` passed.

Browser evidence: [dress result](test-evidence/category-default-dress-2026-10-19.jpg), [skirt result](test-evidence/category-default-skirt-2026-10-19.jpg), and [recovery result](test-evidence/category-default-recovery-2026-10-19.jpg). Full legacy-session recovery is also recorded in CAT-C's live transcript and the offline test.
