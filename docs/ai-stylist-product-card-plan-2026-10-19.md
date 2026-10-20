# AI stylist product card improvement plan

19 October 2026 · Review of the current local working tree and live localhost UI

Implemented locally on 19 October. See the [implementation and verification report](ai-stylist-product-card-implementation-2026-10-19.md). The remaining content dependency is 238 missing catalogue photo assets.

## Direction

Make each card answer three questions quickly: **What is it? Why does it fit my request? What can I do next?** Keep ABC Fashion's restrained typography, neutral colours and rectangular buttons. Prioritise genuine photography, compact layouts and a clear primary action.

This is a plan. No application code was changed. Existing uncommitted work was included in the review.

## What I checked

- Live `http://localhost:3000`: a four-dress result, a single Pink Mini Dress with a missing photo, and Pink Slip Dress with a working catalogue photo.
- Desktop at 1440×1000 and phone at 390×844, using browser viewport emulation. This was a focused visual review, not a full responsive acceptance run or a physical phone test.
- The active implementation is `ShoppingProductResults.tsx`, rendered by `ConversationChat.tsx`; the storefront's `components/commerce/ProductCard.tsx` is a separate component.
- The saved image audit at `docs/reports/products-without-matching-images.json`, checked 18 October 2026 at 12:47 UTC. Its catalogue-wide counts were not rerun for this review.

## Findings, in priority order

### 1. Product photography is the largest quality gap

All four results from “Find a dress” showed the large “ABC / Photo unavailable” fallback. The saved audit reports **238 of 316 products without matching image objects**, about 75%. Pink Slip Dress (P1092) rendered a real photo, so image delivery works for at least that item; the missing assets/references need separate attention.

**Plan:** correct image references and supply real catalogue photos. Retain useful text results when a photo is unavailable, with a quieter fallback. Do not replace a missing garment with an unrelated or generated product photo, or change relevance simply to hide missing assets. Verify each repaired product ID against its image.

For clothing packshots, fit the whole garment within a bounded frame; use cropping only when the source photography supports it. The current multi-product cards use a square frame with `object-fit: cover`, which can crop portrait photographs. Check actual source images before choosing fit rules. Do not introduce a taller portrait frame everywhere: that would worsen the current height problem.

### 2. Multi-product cards are too tall for the chat viewport

The four desktop cards measured **232px wide × approximately 531px tall**. On the phone they measured **252px × approximately 551px**, before expanded explanations. In the phone result, the first card started around y=299, and its two main buttons started around y=754, below the transcript's visible bottom at approximately y=741. Users could scroll to them, but could not see them in the initial result view.

**Plan:** use a bounded image around 190–210px high on desktop, combine low-priority metadata, and remove permanently expanded secondary controls. Target roughly **400px or less for a standard desktop card** with short content, excluding expanded details. This is a design target to validate, not a fixed height that clips text.

On phones, use **full-width horizontal cards in a vertical list**: approximately 96–112px wide image beside the name, price and metadata; controls span the full width underneath. Start with a 220–280px card-height target for short content. This replaces the nested horizontal carousel on phones and avoids moving both vertically and horizontally to reach the controls. Keep desktop carousels for result sets that overflow.

### 3. The next action needs a stronger hierarchy

Each current card can contain a size dropdown, Select for outfit, Add to cart, More like this, Style with…, and Skip this item. The current implementation already changes button emphasis for outfit mode; build on that distinction.

**Plan:** show one filled primary action and one secondary action:

- **Browsing:** primary “Choose size”, changing to “Add to cart” when a valid size is selected; secondary “Add to outfit”. A supplied valid size can remain preselected and editable. “One size” keeps its existing automatic behaviour.
- **Building an outfit:** primary “Add to outfit” / “In your outfit”; secondary “Shop item”, opening the size and purchase controls only when requested. Removing an outfit selection remains a distinct, accessible action.
- Put “More like this”, “Style with…” and “Skip item” in a labelled “More options” control, only when those actions are available. Test whether discovery mode benefits from surfacing “More like this” as its secondary action instead.
- Expand the size picker only after shopping intent. Preserve explicit clothing-size choice; never assume a lone remaining clothing size fits. Do not add to cart when the user is selecting an outfit.

The image and product name remain recognisable links. Keep clear keyboard focus, accessible names, and at least 44px main control targets.

### 4. Improve information order and make the stylist's reason useful

The observed cards show name, brand, price and colour as separate blocks. The sample dress cards offered no visible per-item reason; the code supports an optional explanation and longer pairing/comparison disclosures.

**Plan:** order the content as:

1. Product image.
2. Product name and clearly visible AUD price; allow a two-line title budget with the full name accessible.
3. A compact “Brand · Colour” line, omitting absent values.
4. One short, supported reason when useful, such as matching the requested colour, budget or recorded occasion. Omit it if it only repeats the name. Use existing catalogue/context data, without adding a model call for each card.
5. Primary and secondary actions.
6. Further detail on request.

Keep alternative mismatches, price differences and material limitations visible. Supporting explanation can collapse, but essential exceptions must remain visible beside the claim they qualify. Avoid unverified badges such as “Best fit”, “Perfect match” or “Only 2 left”. The card payload does not provide per-size stock counts or a match-confidence score.

### 5. Keep detail and feedback local to the item

Opening a product image/name navigates to the product page and closes the stylist. The current carousel uses shared subgrid rows, so expanding one card's explanation can also increase neighbouring cards' shared row height. Cart success uses a long sentence; selection is repeated in the title and button.

**Plan:** give the selection one clear visible state, and use concise item-specific feedback such as “Added · Size 10” with a View cart link. Preserve the existing live status announcement and error recovery. Keep an explicit action for adding another unit rather than making a success state accidentally add a duplicate.

As a later enhancement, add **Quick view** inside the stylist for larger photography, explanations and purchase controls, with a product-page link retained. Reuse the existing native dialog approach for a phone detail sheet; restore focus and preserve chat/scroll position. Keep long detail outside shared carousel tracks so expanding one product does not stretch the entire row.

### 6. Make results easier to compare

**Plan:** retain aligned prices and primary actions on desktop without forcing every card to match an expanded card's height. Keep count and group labels; show arrows only when there is overflow. If a carousel remains at tablet widths, add a readable position indicator and advance by whole cards. On phones, use the vertical list above. Keep the current compact outfit summary and message composer.

## Implementation order

### Pass 1 — Card hierarchy and responsive layout

- Restructure the active card into image, summary, actions and optional detail regions.
- Implement desktop density improvements and the full-width phone list.
- Consolidate brand/colour, use consistent title sizing for one and multiple results, and cap normal image height without clipping text.
- Introduce the mode-specific primary/secondary actions and compact size flow.
- Retain mismatch disclosures and existing cart/outfit behaviour.

Primary files: `components/stylist/ShoppingProductResults.tsx`, `components/stylist/ShoppingConversation.module.css`, and `components/stylist/ConversationChat.tsx` for result/mode wiring.

### Parallel content track — Restore catalogue photography

Use `scripts/audit-missing-product-images.mjs` and the existing missing-image report to prioritise clothing results, correct references or add approved assets, then repeat the audit. This is a catalogue/storage task with an asset dependency; styling changes alone cannot complete it. Avoid changing unrelated storefront cards or image permissions as part of this UI pass.

### Pass 2 — Explanations and interaction polish

- Add concise, grounded reasons where data supports them.
- Improve selection/cart feedback and the availability-aware options menu.
- Add Quick view if the first pass still sends users out of the conversation too often.
- Verify carousel navigation and detail expansion without losing position.

Reuse `lib/stylist/productActions.ts`, the current image route, existing recommendation event positions/IDs, and the cart helpers. Only extend the product protocol if a required fact is unavailable; the first pass should work with the existing payload.

## Acceptance checks before shipping

- At 390×844, the first standard result's identity, price and primary action are visible together after the reply anchors; long content scrolls naturally. Recheck this at 320×568, 390×450, 768×1024 and 1440×1000, plus a physical phone with the keyboard open.
- Single, four-item, five-option grouped-outfit and mixed-photo results remain usable. No horizontal page overflow, cropped controls or full-name loss at larger text/zoom settings.
- Missing/loading/failed images have stable reserved space. Real clothing photography shows the whole garment where appropriate, and image identity matches the product.
- Clothing cannot enter the cart without a valid size. Saved sizes are editable; one-size products still work; outfit selection and removal do not alter the cart.
- Pending and stale replies retain their existing action restrictions. Each new control respects the appropriate busy state.
- Alternative differences, pairing limitations and upgrade costs remain readable. Long detail does not stretch all neighbouring cards.
- Keyboard users can operate actions, pick sizes, dismiss menus/details and return focus. Screen readers announce selected and cart states; reduced motion remains supported.
- Run lint, the relevant stylist-commerce/product-image regressions, and a production build after implementation. Capture before/after screenshots for the same catalogue products at the same viewports.

## Source pointers

- `components/stylist/ShoppingProductResults.tsx:41` — size/selection state and cart behaviour.
- `components/stylist/ShoppingProductResults.tsx:85` — image, metadata, disclosures and card actions.
- `components/stylist/ShoppingProductResults.tsx:172` — result layout and carousel navigation.
- `components/stylist/ShoppingConversation.module.css:71` — 232px columns and shared subgrid tracks.
- `components/stylist/ShoppingConversation.module.css:81` — square image frame and cover fit.
- `components/stylist/ShoppingConversation.module.css:135` — phone layout rules.
- `components/stylist/ConversationChat.tsx:285` — result-group and action wiring.
- `lib/stylist/conversationProtocol.ts:32` — current card payload.
- `lib/stylist/productActions.ts:35` — explicit clothing-size guard.
- `docs/reports/products-without-matching-images.json` — saved catalogue image audit.
