# AI stylist: 20 reactive live demos

Run date: 19 October 2026 (Sydney). Tested the running local Next.js app through its live `/api/conversation-search` HTTP endpoint, using the configured model and catalogue. Each scenario began with a separate fresh conversation state. I read each response before writing the next customer message; follow-ups were not taken from a fixed script. The complete request, response, timing, and accepted conversation state for every turn are in [the evidence JSON](../test-evidence/reactive-stylist-demos-2026-10-19.json). The runner used to preserve state and record each exchange is [here](../../scripts/run-reactive-stylist-demos.mjs).

There were **20 scenarios and 55 successful live HTTP turns**. One initial connection attempt failed while the local server was being started; it is retained in S1's evidence and excluded from the 55. Assessment: **9 pass, 6 partial, 5 fail**. “Pass” means the observed path met the main scenario expectation, not that every catalogue item or user interface state was independently verified. This run did not inspect rendered cards in the browser or confirm live delivery or manufacturer data. Product details labelled synthetic remain prototype specifications.

## Scenario results

1. **Precise black dress — Partial.** The stylist found no black size 10 dress under A$150 and kept the colour, size, budget, and “no extras” preference. Asked whether any eligible dress was available without changing those limits, it responded as though the customer had referred to a specific product, rather than answering the availability question. Evidence: S1 turns 2–3.

2. **No idea where to start — Pass.** The stylist asked which collection to browse. After “both” and everyday wear, it offered five varied items and a question about what felt closest. When the customer chose the White Denim Jacket as a reference and set A$100, it found a Grey Denim Jacket for A$55. Evidence: S2 turns 1–3.

3. **Outdoor wedding on grass — Partial.** The stylist asked for a combined budget, then correctly said it could not verify grass suitability. After the customer explicitly accepted provisional browsing, it showed two dresses and two shoes with a combined A$300 limit and retained “shoes suited to grass” in the unverified-requirements field. It did not address whether anything could arrive by the weekend. Evidence: S3 turns 1–3.

4. **Three pieces on one budget — Fail.** The initial dress, shoe, and bag groups respected the A$400 combined budget. The customer then named a displayed dress, shoes, and bag and asked for their total. Twice, the stylist repeated individual prices without stating the A$245 sum; it also compared shoe and dress prices as if that answered the outfit question. Evidence: S4 turns 1–3.

5. **Owned navy blazer — Partial.** The stylist kept the blazer as a customer-owned reference, requested a total purchase budget, and found trousers plus a shirt for A$175 within the A$220 limit. When asked to assess those named items with the blazer, its outfit review said only one piece was selected and requested another selection, rather than evaluating the named candidates. Evidence: S5 turns 1–3.

6. **Change red to blue — Pass.** After a no-match red size 10 dress search, “blue instead” replaced red while size 10 and A$150 remained saved. The revised search still returned no match, without violating the constraints. Evidence: S6 turns 1–2.

7. **Strict linen request — Pass.** The catalogue did not offer “Linen” as the requested material value. The stylist explained the unsupported value, preserved linen, size 12, and A$50 in state, and showed no substitute when the customer reaffirmed all three. Evidence: S7 turns 1–2.

8. **Browse without knowing size — Pass.** The stylist showed clearly marked alternatives for work dresses without inventing a size. Asked why the Burgundy Maxi Dress was an alternative, it explained that its recorded occasion was Brunch, not Work, and listed size labels without promising fit. Evidence: S8 turns 1–2.

9. **Compare commuting bags — Pass.** The stylist showed four bags, then compared two named ones using recorded prices, dimensions, zip closures, and compartment counts. It labelled those detailed specifications as synthetic prototype data and did not infer a quality winner from price. Evidence: S9 turns 1–2.

10. **Gift for a friend — Partial.** The stylist treated “dislikes large bags” as unverified, which was appropriate. It then rejected “green” as an unsupported colour value, although a Sage Sling Bag was available. Once the customer explicitly accepted sage and unverified size, it showed that bag under A$100 as a provisional alternative. Evidence: S10 turns 1–3.

11. **Sensitive to rough fabric — Fail.** The stylist correctly said it could not verify fabric softness, but after explicit consent to browse with that detail unverified it repeatedly asked whether to browse men's, women's, or both collections. It did not accept “both” and ended with an interpretation failure after “women's clothing.” No useful options appeared. Evidence: S11 turns 1–4.

12. **Conservative office, bright colours — Partial.** The stylist asked for a collection, then treated “Bright” as an unsupported colour value. After the customer chose red, it saved the conservative style, work occasion, red, and A$180 limit and showed five labelled alternatives. It did not clearly explain the office suitability of the individual alternatives. Evidence: S12 turns 1–3.

13. **Small travel wardrobe — Fail.** After two broad discovery prompts, the stylist offered unrelated individual products rather than a compact layered wardrobe within A$300. When the customer narrowed the request to a jacket and shirt, it rejected “Jackets” as an unrecognised subcategory. Evidence: S13 turns 1–4.

14. **Dressy shoes for long standing — Pass.** The stylist would not claim that a shoe met an unverifiable low-heel requirement, then showed explicitly provisional shoes after the customer accepted that uncertainty. Asked about Sage Ballet Flats, it gave the recorded 0 cm heel height and declined to guarantee comfort. Evidence: S14 turns 1–3.

15. **Zip closure becomes mandatory — Pass.** The stylist first showed bags under A$100, answered a factual zip question about the Black Shoulder Bag without changing the search, then saved `zip_closure` as a required feature only after the customer explicitly made it mandatory. It returned five bags within budget. Evidence: S15 turns 1–3.

16. **Reject one dress — Partial.** The stylist saved the rejected Burgundy Maxi Dress ID and omitted it from the next two alternatives. However, the follow-up also silently saved “Maxi Dress” as a product type, narrowing the customer's broader request for work dresses. Evidence: S16 turns 1–2.

17. **Try a bolder concert style — Fail.** The stylist asked for a collection, then failed to interpret the customer's answer and request for a bolder look. A concrete red dress search returned no match, but the original discovery task never produced a range of ways to try a bolder style. Evidence: S17 turns 1–3.

18. **Changing body and flexible fit — Fail.** The stylist first asked for a collection, then misread a request for women's clothing and fit information as a question about an unidentified product. A more concrete adjustable-waist request remained blocked because that feature was unverified. It did not guess a size, but it never gave a useful flexible-fit shortlist or explanation. Evidence: S18 turns 1–3.

19. **Only a silver necklace — Pass.** The stylist found no silver necklace under A$80. When the customer reaffirmed the colour, price, and single-item scope, it kept those restrictions and did not add unrelated accessories. Evidence: S19 turns 1–2.

20. **Missing waterproof and laptop facts — Pass.** After showing bags under A$150, the stylist did not claim the Black Shoulder Bag was waterproof or laptop-sized. It later supplied recorded dimensions, 30 × 22 × 8 cm, without inferring laptop fit, and labelled the measurement as synthetic prototype data. Evidence: S20 turns 1–3.

## Main issues to address

1. **Specific outfit totals:** S4 should answer direct arithmetic about selected displayed products. The requested total was A$245, even though the response listed all three prices.
2. **Clarification and discovery loops:** S11, S13, S17, and S18 show that broad or mixed requests can repeat collection questions, become generic discovery, or be misclassified as product questions.
3. **Named outfit review:** S5 should distinguish named displayed candidates from selected pieces and either assess them as candidates with appropriate caveats or ask a precise selection question.
4. **Vocabulary and scope:** S10 and S12 expose literal colour validation for “green” and “bright”; S13 rejected “Jackets” despite jacket products being visible elsewhere. S16 turned a rejected product's type into a new shopping restriction.
5. **Question intent:** S1 treated a collection-level availability question as a product-reference question.

No claim here establishes supplier-verified attributes, actual fit, delivery timing, or browser presentation. The evidence reflects this local app, model configuration, and catalogue at the run time; live catalogue changes may alter the exact product list.
