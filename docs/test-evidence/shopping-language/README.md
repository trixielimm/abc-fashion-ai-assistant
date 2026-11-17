# Shopping language and no-results fixes, 17 November 2026

The pasted request is a valid shopping request. The original browser session was not available, so this investigation reproduced equivalent conversation states through the real local API and public catalogue.

The main confirmed defect was switching from shirts to dresses while retaining `product_type: Shirt`. Both are in Clothing, so the earlier reset checked only the top-level category and allowed an impossible Dresses + Shirt combination. The fix clears the incompatible old type while preserving unmentioned budget, size and exclusions. It also repairs the known incompatible family in older saved sessions. A real A$100 cap was a separate valid reason for no results: currently available lavender dresses start at A$150. The reply now explains that specific blocker.

The spelling audit covered colours, garments, footwear, bags, fabric, occasion and size. Examples include `lavendar`, `burgandy`, `dres`, `skrit`, `shrit`, `blous`, `sneekers`, `handbg`, `cotten`, `weddding` and `meduim`. Corrections use an explicit allowlist, keep the original message and exact evidence quotations, and do not turn lilac into lavender or discard unsupported physical requirements. Generic sneakers, sandals, heels and boots use catalogue-backed families. The audit also found that Burgundy was missing from deterministic colour grounding; this is now recognised along with recorded shades such as Sage and Olive.

No-results explanations use diagnostic searches with the same stock, exclusion, shared-context and feature eligibility rules. A diagnostic search never changes saved filters or displays products above the cap. Colour previews appear only when eligible alternatives exist and keep rejected/cart products excluded. Owned or saved garments remain styling references; their colours do not become filters on a different requested purchase.

Final verification:

- `npm test`: 50/50 regression scripts passed, including 40 new shopping-language checks.
- `npm run lint` and `npm run typecheck`: passed.
- `npm run build -- --webpack`: passed, including the build TypeScript check. The initial sandboxed attempt could not resolve Google Fonts; the successful build used network access for the layout's existing fonts.
- Production live checks: 20/20 scenarios passed across 25 API turns against the final production build. Every recorded source hash matches the final files.
- Browser review at a narrow viewport: shirts followed by `i want a lavendar dres` returned Lavender Maxi Dress and Lavender Wrap Dress; an A$100 request explained the A$150 minimum; an explicit colour preview returned four labelled alternatives at or below A$100.

Run the offline suite with `npm test`. To repeat the live matrix, start the local app in one terminal, then run in another:

```sh
npm run dev -- --webpack --hostname 127.0.0.1 --port 3002
npm run test:shopping:live -- http://127.0.0.1:3002
```

Use the same second command against a production server started with `npm run start -- --hostname 127.0.0.1 --port 3002` after building. The live command calls the configured model and reads current public stock. It performs no cart or catalogue writes. The current fixture expects the audited A$150 lavender minimum, no Black skirts, no White blouses, and numeric dress sizes; refresh those inventory assumptions if catalogue data changes.

Evidence:

- [Final production results](2026-11-17T09-15-25-642Z/results.json), including original requests, parsed replies, state assertions and source hashes.
- [Verification metadata](verification.json), [regression log](regression.log), [production build](production-build.log), [production live log](production-live.log).
- [Baseline fresh prompts](baseline-fresh-prompts.json), [baseline conversation state](baseline-conversation-state.json), [catalogue audit](catalogue-audit.json).
- [Dress cards](browser-dresses.jpg), [budget explanation](browser-budget.jpg), [colour preview](browser-colour-preview.jpg).

Intermediate live runs are retained in the timestamped directories. The first run passed 14/17 scenarios: it exposed a sneakers failure and two incorrect stock assumptions, since Black skirts and White blouses do not exist in the audited catalogue. The second run passed 17/20 and exposed inconsistent Burgundy grounding. A later development run passed 20/20; the final production run above verifies the completed source without changes during the run. An intermediate full regression failure caught a saved Olive dress colour being transferred to a shoe search; the final full suite includes the passing recovery check.

These results cover the listed prompts, assertions and current inventory. They are not a general model reliability estimate or deployment verification. All application changes remain in this workspace.
