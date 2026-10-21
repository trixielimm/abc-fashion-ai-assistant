# Proactive finishing touches

Implemented on 21 October 2026 from the [approved plan](proactive-cross-sell-plan-2026-10-21.md).

## Shopper experience

The first eligible occasion-led shopping response includes **Optional finishing touches** beneath the requested products. It contains one or two actual, available complementary products and names the item they pair with. The assistant also mentions the additions in its opening message.

An unselected dress is explicitly a styling example. Showing suggestions does not select a dress, save an outfit or change the cart. **Match a different dress** refreshes the additions in place. **Hide these suggestions** dismisses the current task's offer; **No more extras** pauses unsolicited offers until explicit resumption. A subsequent explicit matching-product request still works while offers are paused.

The section reuses product photos, prices, pairing reasons, product links, size selection and cart controls. A single addition uses the existing landscape card; multiple additions use the responsive product row. Keyboard operation and the mobile/desktop breakpoints are part of browser verification.

## Retrieval and state

- [proactiveCrossSell.ts](../lib/stylist/proactiveCrossSell.ts) performs deterministic retrieval against the catalogue already loaded for the request. It makes no additional model call. Approved enriched pairing rules and the legacy rule share target resolution with explicit cross-sell retrieval and card presentation.
- Shared restrictions apply to additions. Dress-specific size, colour, fabric and price limits do not become accessory filters. Owned/selected roles, rejected products and cart products are excluded. Unsuitable occasions, unavailable stock, absent rules and optional retrieval failures omit the offer without blocking the requested search.
- Dress-only budgets remain item-local and additions are labelled separately. An explicit combined limit covers selected purchases, the example anchor and all proposed additions together. Current catalogue prices are used; owned pieces cost zero and selected anchors are counted once.
- [conversationProtocol.ts](../lib/stylist/conversationProtocol.ts) validates a separate offer payload. Additions have their own reference group, preserving primary ordinals such as “the second dress.” Named/role references and product actions retain the pairing anchor.
- Task state prevents repeat pitches after refinements or history eviction. Tab-scoped storage retains only shown/dismissed/paused booleans and the task generation across reloads. It stores no messages or product identities. New chat clears it.
- Qualified phrases such as “I only need a women's beach wedding dress” pause offers. Generic “I already own a bag and shoes” records both owned roles using literal evidence.

Live verification also exposed three interpretation boundaries: a trailing “Let me browse without choosing a size” could hide the earlier dress/collection brief; “dress shirt” could lose its Tops/Shirt family while asking for a collection; and explicit provisional consent repeating saved filters could fail interpretation. Each now has a narrow deterministic guard and offline regression coverage. Provisional browsing retains the unknown requirement and labels every card; changed filters still go through normal interpretation.

## Verification evidence

The [evidence directory](test-evidence/proactive-cross-sell-2026-10-21/) contains focused/offline tests, build/typecheck/lint output, synthetic live-model transcripts, catalogue pairing coverage and browser evidence. Final counts and source hashes are recorded in [results-summary.json](test-evidence/proactive-cross-sell-2026-10-21/results-summary.json).

- **Offline:** 45/45 scripts passed, including 28 focused proactive checks and 18 collection checks. Typecheck, lint and the webpack production build passed.
- **New-feature live acceptance:** 9/9 synthetic journey/wording trials passed after fixing qualified suppression, owned roles and trailing browsing wording.
- **Everyday HTTP:** 8 passed, 0 failed, 0 errors, 2 catalogue blockers.
- **Latest prerelease result per journey:** 41 passed, 0 remaining failures/errors, 9 catalogue blockers: J02, J07, J14, J16, J21, J23, J28, J44 and J45.
- **Browser:** verified initial real-stock additions, anchor switching, local dismissal surviving reload, New chat reset and keyboard activation of persistent pause. Inspected the narrow default viewport, 390×844 mobile and 1280×900 desktop; temporary viewport overrides were reset. [Mobile preview](test-evidence/proactive-cross-sell-2026-10-21/browser-finishing-touches-mobile.png), [desktop preview](test-evidence/proactive-cross-sell-2026-10-21/browser-finishing-touches-desktop.png), [keyboard pause](test-evidence/proactive-cross-sell-2026-10-21/browser-paused-desktop.png).

The broad prerelease run originally returned 39 passes, 1 filter failure, 2 request errors and 8 stock blockers. After corrections, all three J13 dress-shirt wordings and all three J43 provisional-browsing wordings passed targeted HTTP reruns; J45 reran as a genuine catalogue blocker. The latest counts combine these runs across revisions. They are not a single unchanged-build benchmark. Final source deltas are recorded in the consolidated JSON; final offline checks and build include all changes.

The new synthetic acceptance journeys cover immediate product previews, references to additions, saving an addition, qualified no-extras wording, later explicit matching requests and owned accessory suppression. Every opening is exercised in three wordings. These are live model calls with isolated synthetic products, rather than an HTTP or visual test.

The existing everyday and prerelease HTTP suites use fresh synthetic prompts and the live read-only catalogue. Existing stock gaps remain catalogue blockers. No shared stock was seeded or changed to make a test pass. Human styling reviews remain pending; recorded attribute compatibility does not establish comfort, fit, sand suitability or delivery.

## Rollout

`STYLIST_PROACTIVE_CROSS_SELL_ENABLED=false` disables unsolicited previews while preserving explicit matching searches. The existing `STYLIST_COMMERCE_ENABLED=false` also suppresses them. Both switches are documented in [.env.example](../.env.example).

Optional first-party analytics use separate recommendation IDs and `placement=complementary` for addition impressions/actions, with typed dismissal and pause events. Positions start at one within their group. Apply [20261021010000_stylist_complementary_events.sql](../supabase/migrations/20261021010000_stylist_complementary_events.sql) before enabling these metrics. This migration was prepared but has **not** been applied to the shared database. Verification ran with analytics disabled and no database writes.
