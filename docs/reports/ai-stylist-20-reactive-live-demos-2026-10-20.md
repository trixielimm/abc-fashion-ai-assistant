# AI stylist: 20 reactive live demos

**Run:** 20 October 2026, Sydney time. **Surface:** the running local Next.js app at `http://127.0.0.1:3000/api/conversation-search`, using its configured model and live catalogue. **Evidence:** [complete JSON transcript](../test-evidence/ai-stylist-20-reactive-2026-10-20.json).

Each scenario started with a fresh conversation. After every live response, I wrote the next customer message from the actual clarification, product names, prices, or blocker returned. The [existing demo runner](../../scripts/run-reactive-stylist-demos.mjs) submitted the same turn envelope as the chat, accepted the reply into the next turn's state, and saved each full request, response, timing, and final state. The follow-ups were not a predetermined script. This exercised the live HTTP conversation flow; it did not inspect browser rendering, checkout, delivery, or supplier stock.

There were **20 scenarios and 64 successful HTTP turns**. Two local connection attempts during setup failed before a live reply; they remain in S1's evidence and are excluded from the 64. Assessment: **8 pass, 9 partial, 3 fail**. A pass means the observed conversation handled the main request and follow-up within the catalogue's limits. A partial result provided some useful behaviour but did not complete the scenario. A fail denotes a persistent blocker or a materially wrong answer on the tested path.

## Scenario results

1. **Unsure where to start — Pass.** The stylist asked which collection to browse, showed five varied everyday ideas after the customer chose both, then used the displayed White Denim Jacket as a reference. It found a Grey Denim Jacket for A$55 after the customer set an A$100 ceiling. Evidence: S1 live turns 1–3 (stored entries 3–5).

2. **Beach wedding guest — Partial.** The stylist asked for a combined dress-and-shoes budget. After A$250 was supplied, it refused to certify shoes as sand-friendly. The customer explicitly allowed provisional browsing, but no dress met the saved beach-wedding, relaxed-style, and A$150 dress limit. It retained the sand requirement as unverified and gave an honest no-match result. Evidence: S2 turns 1–3.

3. **Creative-agency interview — Partial.** After a collection question, the stylist offered five pieces under A$200. When the customer chose the displayed Pink Co-ord Set as a direction, it returned five co-ord alternatives, but labelled occasion and style mismatches such as Beach Wedding/Relaxed versus Work/Polished. It did not produce an exact interview shortlist. Evidence: S3 turns 1–3.

4. **Three pieces on one budget — Pass.** The stylist grouped dresses, shoes, and bags under a single A$350 budget. The customer named the displayed Sage Midi Dress, Red Block Heels, and Silver Envelope Clutch; the stylist correctly totalled A$135 + A$60 + A$50 as **A$245**, leaving A$105. Evidence: S4 turns 1–2.

5. **Style an owned navy dress — Fail.** The stylist correctly asked whether shoes and accessories should share a budget, but three direct answers, including “Yes,” produced interpretation failures and repeated the same question. Starting a new, narrower task finally yielded shoe alternatives under A$100 and kept the dress as an owned external item. The requested shoes-plus-accessories outfit was never completed. Evidence: S5 turns 1–5.

6. **Switch from work dress to birthday dinner — Partial.** A fresh conversation had no earlier black-dress search to replace. After choosing the women's collection, the stylist offered dresses under A$120 and correctly described the Burgundy Maxi Dress's recorded Brunch occasion as an uncertain birthday-dinner match. The saved task later had no birthday-dinner occasion, and the refined choices included navy and cream despite the request for colour. Evidence: S6 turns 1–3 and final state.

7. **Hot-weather commute — Partial.** The stylist would not verify comfort during a commute or full workday. A combined consent-and-search reply failed to parse; a simpler consent followed by a collection choice produced five provisional alternatives under A$150. It retained both comfort claims as unverified, but did not provide a confirmed full-day office option. Evidence: S7 turns 1–4.

8. **Rainy outdoor concert — Partial.** The stylist showed clothing and shoe groups within an A$220 combined budget. Its first answer about whether named pieces could handle rain merely listed prototype construction details; after a more direct waterproofing question, it explicitly said waterproofing was not established for either piece. The original rain concern was not retained in the final unverified-requirements field. Evidence: S8 turns 1–4 and final state.

9. **Sensitive to scratchy fabric — Partial.** The stylist said it could not verify scratchiness. A combined consent-and-shopping reply failed to parse, but explicit consent plus a collection choice produced loose-fit casual alternatives. For the displayed Sage Oversized Tee, it reported “Linen Blend” and declined to infer softness from the material label. It did not give material details for every displayed option in one answer. Evidence: S9 turns 1–5.

10. **Browse without knowing size — Pass.** The opening “these dresses” reference was ambiguous in a fresh chat and triggered an interpretation error. A concrete request then showed work-dress alternatives without inventing a size. Asked about the Burgundy Maxi Dress, the stylist listed its recorded sizes, said the item was generally available, and clearly declined to confirm stock for size 10 or guarantee fit. Evidence: S10 turns 1–3.

11. **Compare two bags — Pass.** The initial “first two bags” request had no product context, so the stylist asked which item was meant. After showing black bags, it compared the named Black Shoulder Bag and Black Envelope Clutch on price, recorded material, zip/fastening, and dimensions. It labelled the detailed specifications as synthetic prototype data and did not equate higher price with better quality. Evidence: S11 turns 1–3.

12. **Cheaper shoes in the same size — Fail.** The initial “first pair” reference lacked context. A new black work-shoe search then rejected size 38 because this catalogue lists single-digit shoe sizes. Twice, the customer tried to change to size 7, but the stylist returned interpretation failures and left size 38 saved. It never reached a cheaper-alternative comparison. Evidence: S12 turns 1–4 and final state.

13. **Strict blue dress under A$30 — Pass.** The stylist returned no match and did not loosen blue, size 10, or A$30 when the customer reaffirmed them. It offered a separate colour-preview path without silently changing the saved request. Evidence: S13 turns 1–2 and final state.

14. **Shoes for an eight-hour shift — Partial.** The opening request was misread as a question about an unidentified product. A narrower black work-shoe request produced two alternatives whose recorded occasions were Beach Wedding and Travel, not Work. For the named Black Platform Sandals, it supplied a 5.5 cm heel and rubber sole and declined to claim eight-hour comfort. Evidence: S14 turns 1–3.

15. **Carry-on travel wardrobe — Partial.** The stylist asked which collection to browse, then guided the customer toward a shirt and removable jacket under A$300. It produced separate shirt and outerwear groups, and correctly totalled the named Brown Linen Shirt and Grey Denim Jacket at A$95. It did not build a complete three-day set or answer the customer's dinner-suitability question in that final response. Evidence: S15 turns 1–4.

16. **Gift bag — Pass.** The stylist showed two black bags within A$100 without needing a clothing size. Asked about both displayed bags, it gave recorded zip closures and dimensions, marked those details as synthetic, and noted the A$15 price difference without claiming a quality winner. Evidence: S16 turns 1–2.

17. **Black dress and silver shoes under one limit — Fail.** The stylist found no complete set under A$400 and identified the dress as the current blocker. When asked which requirement was blocking the set, it answered as though the customer had referred to an unidentified product. It also retained shoe size 38 without surfacing the catalogue's single-digit size vocabulary, so the customer did not get a useful path to a valid set. Evidence: S17 turns 1–2 and final state.

18. **Reject a dress — Pass.** With no earlier dress in this fresh chat, the stylist first asked which one to exclude. The customer requested work dresses under A$120, then named the displayed Burgundy Maxi Dress. The next alternatives omitted that product, and its ID was saved in the rejection list while the work-dress budget remained. Evidence: S18 turns 1–3 and final state.

19. **Garden-party dress code — Partial.** After asking for the women's collection, the stylist asked for the occasion again even though “garden party” was in the opening prompt. It then offered varied ideas without assuming colour or budget. Asked about a named dress-and-flats pairing, it discussed their shared recorded Party occasion and style differences, but did not establish whether either was actually suited to this garden party. Evidence: S19 turns 1–4.

20. **Only a silver necklace — Pass.** The catalogue returned no silver necklace under A$80. When the customer reaffirmed all limits, the stylist kept the necklace-only scope and showed no unrelated items. Evidence: S20 turns 1–2 and final state.

## Highest-priority findings

1. **Repair clarification loops.** S5 could not accept a plain “Yes” to its own combined-budget question; S12 could not apply a clear correction from size 38 to 7. Both remained blocked after repeated reasonable replies.
2. **Preserve scenario details through discovery.** S6 lost the birthday-dinner occasion, S8 did not keep rain suitability as an unverified requirement, and S19 asked for an occasion already supplied. Rechecking saved state after each discovery step would make these failures visible.
3. **Classify collection-level questions correctly.** S17's “which part is blocking?” and S14's initial request were handled as questions about a single unidentified product. S15's answer supplied arithmetic but omitted the other question about dinner suitability.
4. **Keep uncertainty explicit on the first answer.** S8 eventually stated that waterproofing was unknown, but only after a second, more direct question. S7 and S9 showed good caution about comfort and scratchiness once they reached product results.

## Limits of this report

The exact result set depends on the live catalogue and model response at run time. A `200` response proves the endpoint replied, not that a product is appropriate, an individual size is in stock, or delivery is possible. Garment dimensions, closures, heel heights, and similar detailed specifications in this prototype are synthetic unless supplier-verified data is provided. Browser rendering and visual outfit compatibility were not assessed here.
