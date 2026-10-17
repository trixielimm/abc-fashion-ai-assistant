# Shared-budget customer scenario retest transcripts

17 October 2026. Real configured model, isolated synthetic catalogue; no shared catalogue writes.

The complete 24-case run passed 72/72 repeats. These are the four new shared-budget cases, each repeated three times. Raw JSON contains the exact plans and state.

## B1 — run 1 — Pass

[Shared total for formal dress and shoes, then reduce total](test-evidence/customer-scenarios-2026-10-17T05-58-21-970Z/B1-run-1.json)

**Customer:** I want a dress and shoes for formal events, my budget for both of them is 400 aud

**AI Stylist:** Here is one complete set: BUDGET-DRESS Dress (A$250.00) + BUDGET-SHOES Shoes (A$150.00). Total: A$400.00 of your A$400.00 combined budget; A$0.00 remaining.

Products: BUDGET-DRESS (Clothing, A$250.00); BUDGET-SHOES (Shoes, A$150.00).

Status: matches. Check: Pass.

**Customer:** Make the combined budget $350 instead. Keep everything else.

**AI Stylist:** I couldn't find a complete set within your A$350.00 combined budget. I haven't raised the total or dropped any requested items or requirements.

Status: no_match. Check: Pass.

**Customer:** Make the combined budget 400 aud again, keeping everything else.

**AI Stylist:** Here is one complete set: BUDGET-DRESS Dress (A$250.00) + BUDGET-SHOES Shoes (A$150.00). Total: A$400.00 of your A$400.00 combined budget; A$0.00 remaining.

Products: BUDGET-DRESS (Clothing, A$250.00); BUDGET-SHOES (Shoes, A$150.00).

Status: matches. Check: Pass.

**Customer:** What material is the dress in this set?

**AI Stylist:** BUDGET-DRESS Dress
The recorded material is Polyester. A material label doesn't verify the full composition or certifications.

Status: answered. Check: Pass.

## B1 — run 2 — Pass

[Shared total for formal dress and shoes, then reduce total](test-evidence/customer-scenarios-2026-10-17T05-58-21-970Z/B1-run-2.json)

**Customer:** I want a dress and shoes for formal events, my budget for both of them is 400 aud

**AI Stylist:** Here is one complete set: BUDGET-DRESS Dress (A$250.00) + BUDGET-SHOES Shoes (A$150.00). Total: A$400.00 of your A$400.00 combined budget; A$0.00 remaining.

Products: BUDGET-DRESS (Clothing, A$250.00); BUDGET-SHOES (Shoes, A$150.00).

Status: matches. Check: Pass.

**Customer:** Make the combined budget $350 instead. Keep everything else.

**AI Stylist:** I couldn't find a complete set within your A$350.00 combined budget. I haven't raised the total or dropped any requested items or requirements.

Status: no_match. Check: Pass.

**Customer:** Make the combined budget 400 aud again, keeping everything else.

**AI Stylist:** Here is one complete set: BUDGET-DRESS Dress (A$250.00) + BUDGET-SHOES Shoes (A$150.00). Total: A$400.00 of your A$400.00 combined budget; A$0.00 remaining.

Products: BUDGET-DRESS (Clothing, A$250.00); BUDGET-SHOES (Shoes, A$150.00).

Status: matches. Check: Pass.

**Customer:** What material is the dress in this set?

**AI Stylist:** BUDGET-DRESS Dress
The recorded material is Polyester. A material label doesn't verify the full composition or certifications.

Status: answered. Check: Pass.

## B1 — run 3 — Pass

[Shared total for formal dress and shoes, then reduce total](test-evidence/customer-scenarios-2026-10-17T05-58-21-970Z/B1-run-3.json)

**Customer:** I want a dress and shoes for formal events, my budget for both of them is 400 aud

**AI Stylist:** Here is one complete set: BUDGET-DRESS Dress (A$250.00) + BUDGET-SHOES Shoes (A$150.00). Total: A$400.00 of your A$400.00 combined budget; A$0.00 remaining.

Products: BUDGET-DRESS (Clothing, A$250.00); BUDGET-SHOES (Shoes, A$150.00).

Status: matches. Check: Pass.

**Customer:** Make the combined budget $350 instead. Keep everything else.

**AI Stylist:** I couldn't find a complete set within your A$350.00 combined budget. I haven't raised the total or dropped any requested items or requirements.

Status: no_match. Check: Pass.

**Customer:** Make the combined budget 400 aud again, keeping everything else.

**AI Stylist:** Here is one complete set: BUDGET-DRESS Dress (A$250.00) + BUDGET-SHOES Shoes (A$150.00). Total: A$400.00 of your A$400.00 combined budget; A$0.00 remaining.

Products: BUDGET-DRESS (Clothing, A$250.00); BUDGET-SHOES (Shoes, A$150.00).

Status: matches. Check: Pass.

**Customer:** What material is the dress in this set?

**AI Stylist:** BUDGET-DRESS Dress
The recorded material is Polyester. A material label doesn't verify the full composition or certifications.

Status: answered. Check: Pass.

## B2 — run 1 — Pass

[Per-item affordability must not bypass combined total](test-evidence/customer-scenarios-2026-10-17T05-58-21-970Z/B2-run-1.json)

**Customer:** Find a dress and shoes for formal events under $400 total.

**AI Stylist:** I couldn't find a complete set within your A$400.00 combined budget. I haven't raised the total or dropped any requested items or requirements.

Status: no_match. Check: Pass.

## B2 — run 2 — Pass

[Per-item affordability must not bypass combined total](test-evidence/customer-scenarios-2026-10-17T05-58-21-970Z/B2-run-2.json)

**Customer:** Find a dress and shoes for formal events under $400 total.

**AI Stylist:** I couldn't find a complete set within your A$400.00 combined budget. I haven't raised the total or dropped any requested items or requirements.

Status: no_match. Check: Pass.

## B2 — run 3 — Pass

[Per-item affordability must not bypass combined total](test-evidence/customer-scenarios-2026-10-17T05-58-21-970Z/B2-run-3.json)

**Customer:** Find a dress and shoes for formal events under $400 total.

**AI Stylist:** I couldn't find a complete set within your A$400.00 combined budget. I haven't raised the total or dropped any requested items or requirements.

Status: no_match. Check: Pass.

## B3 — run 1 — Pass

[Separate dress and shoe sizes and colours](test-evidence/customer-scenarios-2026-10-17T05-58-21-970Z/B3-run-1.json)

**Customer:** Find a black dress in size 10 and silver shoes in size 38 for formal events under $400 total.

**AI Stylist:** Here is one complete set: COLOUR-DRESS Dress (A$250.00) + COLOUR-SHOES Shoes (A$150.00). Total: A$400.00 of your A$400.00 combined budget; A$0.00 remaining.

Products: COLOUR-DRESS (Clothing, A$250.00); COLOUR-SHOES (Shoes, A$150.00).

Status: matches. Check: Pass.

**Customer:** Show the same set with a combined budget of $399. Keep the colours and sizes.

**AI Stylist:** I couldn't find a complete set within your A$399.00 combined budget. I haven't raised the total or dropped any requested items or requirements.

Status: no_match. Check: Pass.

## B3 — run 2 — Pass

[Separate dress and shoe sizes and colours](test-evidence/customer-scenarios-2026-10-17T05-58-21-970Z/B3-run-2.json)

**Customer:** Find a black dress in size 10 and silver shoes in size 38 for formal events under $400 total.

**AI Stylist:** Here is one complete set: COLOUR-DRESS Dress (A$250.00) + COLOUR-SHOES Shoes (A$150.00). Total: A$400.00 of your A$400.00 combined budget; A$0.00 remaining.

Products: COLOUR-DRESS (Clothing, A$250.00); COLOUR-SHOES (Shoes, A$150.00).

Status: matches. Check: Pass.

**Customer:** Show the same set with a combined budget of $399. Keep the colours and sizes.

**AI Stylist:** I couldn't find a complete set within your A$399.00 combined budget. I haven't raised the total or dropped any requested items or requirements.

Status: no_match. Check: Pass.

## B3 — run 3 — Pass

[Separate dress and shoe sizes and colours](test-evidence/customer-scenarios-2026-10-17T05-58-21-970Z/B3-run-3.json)

**Customer:** Find a black dress in size 10 and silver shoes in size 38 for formal events under $400 total.

**AI Stylist:** Here is one complete set: COLOUR-DRESS Dress (A$250.00) + COLOUR-SHOES Shoes (A$150.00). Total: A$400.00 of your A$400.00 combined budget; A$0.00 remaining.

Products: COLOUR-DRESS (Clothing, A$250.00); COLOUR-SHOES (Shoes, A$150.00).

Status: matches. Check: Pass.

**Customer:** Show the same set with a combined budget of $399. Keep the colours and sizes.

**AI Stylist:** I couldn't find a complete set within your A$399.00 combined budget. I haven't raised the total or dropped any requested items or requirements.

Status: no_match. Check: Pass.

## B4 — run 1 — Pass

[Three-piece outfit under one total](test-evidence/customer-scenarios-2026-10-17T05-58-21-970Z/B4-run-1.json)

**Customer:** Build a complete outfit with a dress, shoes and bag for formal events under $350 total.

**AI Stylist:** Here is one complete set: THREE-DRESS Dress (A$200.00) + THREE-SHOES Shoes (A$100.00) + THREE-BAG Bag (A$50.00). Total: A$350.00 of your A$350.00 combined budget; A$0.00 remaining.

Products: THREE-DRESS (Clothing, A$200.00); THREE-SHOES (Shoes, A$100.00); THREE-BAG (Bags, A$50.00).

Status: matches. Check: Pass.

## B4 — run 2 — Pass

[Three-piece outfit under one total](test-evidence/customer-scenarios-2026-10-17T05-58-21-970Z/B4-run-2.json)

**Customer:** Build a complete outfit with a dress, shoes and bag for formal events under $350 total.

**AI Stylist:** Here is one complete set: THREE-DRESS Dress (A$200.00) + THREE-SHOES Shoes (A$100.00) + THREE-BAG Bag (A$50.00). Total: A$350.00 of your A$350.00 combined budget; A$0.00 remaining.

Products: THREE-DRESS (Clothing, A$200.00); THREE-SHOES (Shoes, A$100.00); THREE-BAG (Bags, A$50.00).

Status: matches. Check: Pass.

## B4 — run 3 — Pass

[Three-piece outfit under one total](test-evidence/customer-scenarios-2026-10-17T05-58-21-970Z/B4-run-3.json)

**Customer:** Build a complete outfit with a dress, shoes and bag for formal events under $350 total.

**AI Stylist:** Here is one complete set: THREE-DRESS Dress (A$200.00) + THREE-SHOES Shoes (A$100.00) + THREE-BAG Bag (A$50.00). Total: A$350.00 of your A$350.00 combined budget; A$0.00 remaining.

Products: THREE-DRESS (Clothing, A$200.00); THREE-SHOES (Shoes, A$100.00); THREE-BAG (Bags, A$50.00).

Status: matches. Check: Pass.
