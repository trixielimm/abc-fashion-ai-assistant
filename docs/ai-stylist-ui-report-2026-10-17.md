# AI Stylist UI improvement report

17 October 2026 · Local implementation and browser verification

**Status: 11 issues resolved; product photography partially resolved because catalogue assets are missing.**

## Every issue from the UI review

1. **Missing product imagery — PARTIALLY RESOLVED.** The stylist now accepts the existing catalogue-authorised product image route, so genuine storage photographs can render. Removed a local mapping that pointed to a nonexistent file. Verified Pink Crossbody Bag and Pink Slip Dress photos in the live interface. Unavailable images use a smaller branded fallback, and image frames align across a product row. The configured bucket contains 80 objects; 78 of the 316 catalogue product references match stored objects. The remaining 238 references need the correct photo assets or corrected catalogue paths. No substitute product photographs were invented.

2. **New results scroll past the introduction and photos — RESOLVED.** The transcript now anchors to the start of the newest reply instead of the end of the conversation. Short replies retain preceding context when there is insufficient content to scroll farther. Verified that the result introduction and image row are encountered before the purchase controls.

3. **Product cards are too tall and repeat a large “complete the look” section — RESOLVED.** Removed the repeated heading, paragraph, and separate button block. Replaced it with one compact “Style with…” action. Reduced image-frame height, product type sizes, price weight, padding, and gaps. Mixed rows of real images and fallbacks now align. Verified all four purchase buttons fit in the desktop result view. Carousel arrows disable at the ends and disappear when all cards already fit.

4. **Stylist styling differs from the storefront — RESOLVED.** Reused Inter and Cormorant Garamond, the site's colour tokens, restrained borders, editorial serif headings, and rectangular primary actions. Reduced excessive pill shapes and rounded corners.

5. **The mobile modal wastes space and exposes distracting background navigation — RESOLVED.** Phones now use a full-screen dialog, with the header and message composer fixed within the layout and the transcript scrolling independently. The dialog follows the visual viewport and includes safe-area padding. Tablet and desktop layouts retain a centred dialog. Verified that the dialog and message input fit narrow and short viewports without horizontal overflow.

6. **The welcome screen has an unstructured blank area — RESOLVED.** Added a deliberate centred composition with an editorial heading, short introduction, grouped starting prompts, and a concise hint. Prompts appear in one row on desktop and stack on phones.

7. **Too much explanatory text pushes products down — RESOLVED.** Product responses show the opening summary immediately and place supporting paragraphs in an accessible “Details about these picks” disclosure. Per-product alternative differences remain visible on their cards. Necessary questions and responses without products remain expanded.

8. **“Reset” is an unclear control label — RESOLVED.** Renamed the control to “New chat” and updated the related recovery instruction. Verified it clears the conversation and draft and restores the welcome screen.

9. **The close control needs a familiar visual treatment — RESOLVED.** Replaced the text button with the existing close icon, an accessible label, tooltip, and 44px control. Verified closing through the button and Escape, then reopening.

10. **The loading state lacks visual feedback — RESOLVED.** Added three subtle animated dots beside the existing loading message. The animation has a reduced-motion fallback. Verified the live loading state and its animation styles; cancellation remains available.

11. **The textarea exposes a resize handle and does not grow naturally — RESOLVED.** Disabled manual resizing and added automatic height adjustment, capped at 128px with internal scrolling for longer drafts. Verified growth from 44px to 118px for a multiline message, the absence of a resize handle, 16px phone input text, and Enter submission.

12. **Privacy information needs a compact, readable treatment — RESOLVED.** Kept the OpenAI disclosure visible beneath the composer. Moved the full context/product disclaimer and terms/privacy link into an expandable “Privacy & details” disclosure. Verified expansion and the accessible link. Phone footer text is 11px; expanded explanatory text is 12px.

## Validation

- `npm run lint` — PASS.
- TypeScript — PASS, including the final production build's type check.
- `node scripts/run-regression.mjs` — PASS, 22/22 suites. This includes 32 shopping-presentation checks covering image sources and product/image identity validation.
- `node --import tsx scripts/test-product-images.ts` — PASS.
- `npm run build -- --webpack` — PASS. The default Turbopack build could not finish in this execution environment because its worker could not bind an internal port; the supported Webpack production build succeeds.
- `git diff --check` — PASS.
- Browser checks — welcome, loading, single and multiple product results, genuine photo rendering, missing-photo fallback, result positioning, disclosures, input growth, keyboard submission, carousel navigation, pending-question controls, New chat, close button, and Escape.
- Responsive checks — 320×568, 390×844, 390×450, 768×1024, and 1440×1000. Dialog geometry and input visibility passed, without horizontal dialog overflow. Short viewport checks simulate reduced space; they do not replace a physical iOS/Android keyboard test.

Regression evidence: [22-suite run](test-evidence/regression-2026-10-17T00-21-16-386Z.txt).

## Remaining dependency

For all catalogue cards to display real product photography, correct or supply the 238 image references that do not match objects in the currently configured storage bucket. The UI route and fallback are implemented; this remaining work concerns catalogue assets. No catalogue rows, storage permissions, or stored objects were changed.

## Implementation notes

The UI changes are in `ConversationChat.tsx`, `ShoppingProductResults.tsx`, `ShoppingConversation.module.css`, `StylistModal.tsx`, and the dialog rules in `app/globals.css`. Image delivery and validation are in `lib/stylist/catalogueImages.ts` and `conversationProtocol.ts`.

Validation also exposed existing missing image imports in the legacy `StylistChat.tsx` component and missing optional catalogue fields in the exported search-product type. These small compile fixes and the matching test fixture were corrected so lint and the production type check pass. Pre-existing conversation-planning changes were left in place.

## Screenshots

![Updated desktop welcome screen](/Users/salvi/.codex/visualizations/2026/10/17/01a1472d-c182-7cc3-b02d-2c4281fee953/ai-stylist-desktop-welcome.png)

![Updated desktop results with a genuine product photo and aligned purchase controls](/Users/salvi/.codex/visualizations/2026/10/17/01a1472d-c182-7cc3-b02d-2c4281fee953/ai-stylist-desktop-results.png)

![Updated full-screen phone welcome screen](/Users/salvi/.codex/visualizations/2026/10/17/01a1472d-c182-7cc3-b02d-2c4281fee953/ai-stylist-mobile-welcome.png)

![Genuine product photo in the phone stylist](/Users/salvi/.codex/visualizations/2026/10/17/01a1472d-c182-7cc3-b02d-2c4281fee953/ai-stylist-mobile-product.png)

## Follow-up: compact outfit and visible search

- **Your outfit — RESOLVED.** Replaced the always-expanded list with a 45px collapsed row showing the item count. Desktop users expand the list inline; phone users open a separate native dialog sheet with thumbnails and remove controls. The count briefly highlights when it changes, without automatically expanding the list. The section disappears when the final item is removed and there are no owned categories. Verified selecting a real result, desktop expansion/collapse, mobile sheet opening, Escape dismissing only the sheet, and removing the last item while keeping the stylist open.
- **Viewing context — RESOLVED.** Moved the full-width product strip into a small chip below the stylist title. Long names truncate within the header; the full name and price remain available in its tooltip.
- **Search bar visibility — RESOLVED.** Removed the breakpoint rule that hid the header search between 1024px and 1279px. The search field is now visible from tablet widths upward; phones have a visible full-width search row below the logo. Removed the duplicate search form from the mobile menu. Verified visibility at 320px, 390px, 768px, 1024px, 1100px, and 1280px, and a real query navigated to `/search?q=pink+bag` and displayed two matching products. The desktop field was widened to 200px so its placeholder fits.

Follow-up checks: lint, TypeScript, Webpack production build, whitespace checks, and 30 stylist-commerce checks passed. Outfit selection/removal did not add products to the cart.

![Compact phone outfit row and persistent message input](/Users/salvi/.codex/visualizations/2026/10/17/01a1472d-c182-7cc3-b02d-2c4281fee953/ai-stylist-compact-outfit.png)

![Mobile outfit sheet](/Users/salvi/.codex/visualizations/2026/10/17/01a1472d-c182-7cc3-b02d-2c4281fee953/ai-stylist-outfit-sheet.png)

![Restored desktop search at 1024px](/Users/salvi/.codex/visualizations/2026/10/17/01a1472d-c182-7cc3-b02d-2c4281fee953/visible-search-desktop.png)
