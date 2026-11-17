# Audience-led AI Stylist presentation

The presentation build reuses the existing storefront, Stylist dialog, product cards, outfit controls, product pages and cart. Replies come from a local scripted engine. It has exactly 24 audience journeys: two occasions, three refinements and four final questions.

## Launch

Prepare the production build before the presentation:

```sh
npm run build:demo
npm run start:demo
```

Open [the stage demo](http://127.0.0.1:3001/demo). The Stylist opens automatically. Keep the terminal running during the presentation. The first build can require internet access to download the app's existing fonts; the production build serves fonts, photos, products and chat replies locally.

For editing, use `npm run dev:demo` instead. Do not run the development and production demo servers on port 3001 at the same time. The demo uses `.next-demo`, separate from the normal `.next` build. Normal `npm run dev`, `npm run build` and `npm run start` retain the live application behavior. `/demo` is unavailable in a normal build.

## The stage script

Allow about five seconds per vote. Ask the audience to hold up the option number, then click that option in the Stylist. The button sends the full prepared prompt, which appears as a normal user message. You can also type its exact prompt, an accepted alias, or its option number into the composer.

1. **Where are we going?** About 25 seconds for the vote, response and explanation.
   - Beach wedding: “Find me a dress for a beach wedding under A$200.”
   - Work dinner: “Find me a dress for a work dinner under A$200.”
2. **What should we change?** About 25 seconds.
   - Budget: “Reduce the budget to A$150, keeping the same occasion.”
   - Colour: “Show me lavender options, keeping my occasion and budget.”
   - Size: “Only show size 10, keeping my occasion and budget.”
3. **What should we ask next?** About 35 seconds.
   - Matching bag: “Find a matching bag for the second dress under A$80.”
   - Cheaper dress: “Find something cheaper than the second dress.”
   - Comparison: “Compare the first two dresses.”
   - Fabric question: “What material is the second dress made from?”
4. **Finish shopping.** About 20 seconds. Save a favourite to the look, choose a size if necessary, and add an item to the cart. For comparison and fabric routes, the previous dress cards remain available. For accessory and cheaper routes, the new product cards are available.

Lavender replaces the proposed blue vote because the source catalogue did not contain enough matching blue dress photos. The three lavender photographs retain their original colours. This gives every colour route two products to compare and a strictly cheaper option.

The 24-route limit covers these three audience votes. Saving, removing, marking an item as owned, skipping, matching finishing touches, previewing other colours, and cart actions are reusable controls rather than extra audience decisions. Free-form conversation outside the prepared choices returns a recovery message and does not call live AI.

## Presenter controls

- **Option/Alt + 1, 2, 3 or 4:** send the corresponding choice for the current vote while the Stylist is open. Only the available choices are active.
- **Reset demo** or **Option/Alt + R:** stop the current request and clear the chat, audience progress, saved look, demo offer memory and demo cart.
- **Stop icon:** cancel a pending reply. A cancelled request does not consume a vote.
- **Close and reopen:** retain the current conversation. The reset shortcut is inactive while the dialog is closed.

Reset before every rehearsal and immediately before going on stage. Reloading starts a new conversation but retains the demo cart until reset. Ties or no response can use option 1 without changing the route structure.

Searches wait 1.25 seconds, refinements and cheaper results 0.9 seconds, matching bags 1.1 seconds, answers 0.8 seconds, and outfit actions 0.3 seconds. These fixed delays use the existing loading and stop controls. Timing is defined in `lib/demo/transport.ts`.

## Isolation and product data

`NEXT_PUBLIC_STYLIST_DEMO=true` is set by the demo scripts at build and startup. It is a build-time setting. Changing it after building does not convert a live build into a demo build.

- Twelve fixed sample products, consisting of eight dresses and four bags, live in `lib/demo/catalogue.json`. Their IDs start with `DEMO-`.
- Existing catalogue photos were copied locally on 5 November 2026 into `public/images/demo`. The fixture uses stage-only prices, stock and some display names. It is not a statement of current live availability or pricing.
- A few demo dresses deliberately omit size 10, so the size vote changes the shortlist.
- Chat replies and audience progress run in the browser and still pass through the normal `acceptReply` validation. Progress commits only after a reply is accepted.
- The demo has no automatic live-AI fallback. The live conversation-search endpoint is disabled in this build. Storefront loading, product pages, search, image thumbnails and auth proxy use local demo paths for the presentation journey.
- Recommendation telemetry and Vercel analytics are disabled in the demo.
- Demo cart storage uses `abc-fashion-demo-cart`; live cart storage uses `abc-fashion-cart`. Resetting a demo does not clear the live cart.
- The normal app's checkout remains unavailable. This presentation ends at adding products to the bag.

## Verification

Run `npm run test:demo` for all 24 paths, protocol validation, preserved filters, exact product references, selection actions, cancellation, retry, local assets and cart isolation. The demo suite also runs as part of `npm test`.

Browser evidence from the production build is stored in `docs/test-evidence/stage-demo-2026-11-05/`. Browser and offline checks are specific to the scripted presentation; they do not measure the live model's accuracy or latency.
