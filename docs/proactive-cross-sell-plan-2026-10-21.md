# Proactive complementary-product recommendations

Plan prepared on 21 October 2026. This proposes the next change; the feature is not implemented by this document.

## Intended experience

When a shopper asks for a dress for a beach wedding, the first successful response should show dresses and proactively offer a small selection of complementary products. The shopper should not have to ask for accessories or discover a hidden menu first.

Keep the dresses first. Below them, show an **Optional finishing touches** section with up to two actual catalogue products, such as a bag and shoes, when approved pairing rules, stock and the shopper's restrictions support them. One useful addition is sufficient when only one qualifies.

Example copy, populated with real eligible products at runtime:

> To help complete the beach-wedding look, I've included a couple of optional additions below. These suggestions pair with [dress name]; you haven't selected that dress yet.

Each addition shows its photo, current price, a short supported pairing reason and its existing product actions. Show **Priced separately** when the shopper specified only a dress budget. Include **Match a different dress**, **Hide these suggestions** and **No more extras** controls. Do not add another question before showing the requested dresses.

## Why the current flow misses this

- [ShoppingProductResults.tsx](../components/stylist/ShoppingProductResults.tsx) puts “Style with a bag” inside a product's **More options** menu.
- [friendlyShoppingMessage.ts](../lib/stylist/friendlyShoppingMessage.ts) ends ordinary successful searches with browsing/refinement guidance, rather than an offer of complementary products.
- [shoppingPresentation.ts](../lib/stylist/shoppingPresentation.ts) derives the card's extra target from the legacy `cross_sell_category`. [crossSell.ts](../lib/search/crossSell.ts) also supports the enriched, prioritised `pairing_categories`, so the two paths can disagree.
- The backend already has pairing retrieval, compatibility evidence, owned-item handling and `offers_paused`. Reuse these rather than relying on the language model to invent products or prices.

## 1. Define when to offer extras

Add a deterministic eligibility decision after the primary search has produced validated results.

- Start with occasion-led, single-item shopping such as the beach-wedding dress request. Offer extras on the first successful eligible response in that shopping task, including after an earlier clarification is resolved.
- Require an available primary match and at least one available, eligible complementary product from an approved pairing category. Do not attach offers to no-match responses, blocking clarifications, unresolved hard requirements or provisional-only results.
- Suppress offers for “only a dress,” “no other items,” `offers_paused`, and roles already owned or selected. Respect both catalogue-owned pieces and customer-described owned items.
- Exclude discovery, factual/policy answers, replacement comparisons and completed multi-item outfit responses in the first release. An explicit cross-sell response must not start another unsolicited sales chain.
- Persist shown/dismissed state for the current task generation. A refinement, retry, page reload or truncated conversation history must not repeat the pitch. A new task can allow a new offer; “No more extras” persists until explicit resumption.
- Keep **Hide these suggestions** local to this offer and **No more extras** as the persistent preference. An explicit later request for matching products can still be fulfilled without silently unpausing future offers.

## 2. Retrieve relevant products without changing the brief

Introduce a small proactive-offer planner, for example `lib/stylist/proactiveCrossSell.ts`, called from [conversationTurn.ts](../lib/stylist/conversationTurn.ts) after primary retrieval and presentation validation.

1. Resolve an anchor: use a relevant selected primary piece when present; otherwise use the highest-ranked eligible displayed primary match. Label an unselected anchor as a styling example, never as the shopper's choice.
2. Unify target resolution across presentation and retrieval, using approved `pairing_categories` priorities and the existing legacy fallback. Filter occupied roles and try the next approved category when an earlier category has no eligible stock.
3. Reuse `retrieveCrossSell`, compatibility scoring and authoritative catalogue records. Return at most two additions, with product IDs, anchor ID, pairing evidence and prices. Use the catalogue already loaded for the turn; no additional model call is needed.
4. Carry shared restrictions and relevant occasion context into the additions. Do not copy dress-specific size, colour, material or price limits to shoes or bags. Apply any explicitly stated constraints for those additional items.
5. If no addition qualifies, omit the section. A secondary retrieval failure must leave the primary results usable and must not create a blocking question.

Pairing reasons must describe recorded facts or clearly qualified styling suggestions. Beach-wedding context alone must not produce claims about walking on sand, comfort, weather resistance or delivery.

## 3. Preserve budget meaning

- **“A dress under A$200”** remains a dress cap. Extras have visible separate prices; do not present the whole look as within A$200 or invent an accessories budget.
- **An explicit combined spending limit** applies to the proposed combination. Reuse [purchaseBudget.ts](../lib/stylist/purchaseBudget.ts): selected purchases consume the allowance, owned pieces cost zero, and an unselected example dress is included once in any displayed example total.
- If two additions are presented as completing one look, validate the dress plus both additions against the total. Do not show two individually affordable additions as a jointly affordable set when their combined cost exceeds it.
- Do not substitute a more expensive dress, relax saved restrictions or select products automatically to make an offer possible.

## 4. Add a distinct, visible UI section

Extend [conversationProtocol.ts](../lib/stylist/conversationProtocol.ts) with a nullable, validated complementary-offer payload and persist its exposure/dismissal state through the session. Default missing fields safely for existing sessions.

Render the section in [ConversationChat.tsx](../components/stylist/ConversationChat.tsx) below the requested products, using existing card styles and a compact responsive layout in [ShoppingConversation.module.css](../components/stylist/ShoppingConversation.module.css). Keep it visually secondary, keyboard accessible and clearly optional.

Store primary results and additions in separate reference groups. “The second dress” must retain its existing meaning; “the bag” and product-button actions must resolve to the displayed addition. Include the anchor context when the shopper saves an addition or asks why it matches. Showing a preview must not change the active search, focused product, saved outfit or cart.

“Match a different dress” should offer a direct choice among the displayed dresses and regenerate the preview for that product. Existing explicit matching-item actions remain available.

## 5. Verify the behaviour

Add focused unit and integration cases to the existing cross-sell, presentation, conversation and client suites, plus a dedicated proactive-offer suite. Extend the journey fixtures with these acceptance scenarios:

- Beach-wedding dress request: the initial successful response includes primary dresses and one or two actual additions without a follow-up prompt. Every addition has a valid anchor and supported pairing evidence.
- Multiple dresses: the example anchor is labelled as unselected; changing it updates the additions; “second dress” still refers to the primary results.
- “Only a dress,” “no extras,” owned shoes/bag and already-complete outfits: no unsolicited duplicate products. Explicit later matching requests still work.
- Dress-only cap, per-addition cap and combined total: correct scope, accurate prices, no double counting and no advertised over-budget combination.
- Size unknown, global exclusions, unavailable stock, missing pairing rules and retrieval failure: appropriate filtering/disclosure or omission, with the requested search preserved.
- Refinement, retry, reload and history eviction: no repeated offer. Local dismissal and persistent pause have distinct behaviour.
- Product selection, questions and cart actions: correct product/anchor identity and no automatic outfit/cart changes.

Use isolated synthetic catalogue fixtures to guarantee eligible dress/bag/shoe coverage. Then rerun the everyday and prerelease journeys against the live catalogue, plus a synthetic live-model variant of the new beach-wedding journey. Keep genuine catalogue gaps as `BLOCKED_CATALOGUE`; do not loosen constraints or seed shared stock to manufacture a pass. The previous catalogue audit already found beach-wedding colour-specific stock gaps.

Finish with typecheck, lint, the appropriate production build and mobile/desktop browser checks for hierarchy, keyboard operation, dismissal and reference actions. Human review should assess whether the pairings feel useful and the offer feels proportionate.

## Delivery and success criteria

Implement in this order: eligibility/state and shared target resolution; catalogue retrieval and protocol/reference handling; visible UI and controls; regression coverage and live verification. The first release includes actual product previews, not just a more prominent “find accessories” button.

Gate the feature for staged rollout. Where existing opt-in analytics are enabled, distinguish primary and complementary impressions/actions without collecting conversation text. Monitor offer visibility, engagement, dismissal and response latency; preserve existing telemetry position constraints rather than appending extras to primary positions.

The release is ready when an eligible first beach-wedding response visibly suggests complementary products without prompting, suppression and budget cases pass, existing journeys have no new failures, and primary results remain usable when no complementary offer is available.
