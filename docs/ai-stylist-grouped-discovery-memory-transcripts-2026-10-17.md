# Grouped discovery and memory: transcripts and case results

17 October 2026. Fresh-model journeys use an isolated synthetic catalogue. The production HTTP and browser evidence in the main report uses the real catalogue.

## Full fresh-model run by case

| Case | Journey | Pass | Fail |
| --- | --- | ---: | ---: |
| S1-A | Complete brief, cheaper, material | 3 | 0 |
| S1-B | Change colour and price only | 3 | 0 |
| S1-C | Deliberate no match | 3 | 0 |
| S2-A | Guided beach wedding shopping | 3 | 0 |
| S2-B | Reject a dress across searches | 3 | 0 |
| S2-C | Zip question becomes explicit must-have | 3 | 0 |
| S3-A | Uncertain customer to similar dresses | 3 | 0 |
| S3-B | Browse without preferences | 3 | 0 |
| S3-C | Switch from dresses to bags | 3 | 0 |
| S4-A | Pair a bag with an owned catalogue dress | 3 | 0 |
| S4-B | Style an external owned garment | 3 | 0 |
| S4-C | Pair shoes with two owned pieces | 3 | 0 |
| S5-A | Pockets justify A$25 more | 3 | 0 |
| S5-B | Replacement preserves all hard requirements | 3 | 0 |
| S5-C | No demonstrated improvement | 3 | 0 |
| S5-D | Same-price and cheaper adjustable alternatives | 3 | 0 |
| S5-E | Lining trade-off then both required | 3 | 0 |
| S5-F | Unknown lining cannot prove improvement | 3 | 0 |
| S6-A | Shoe size and construction details | 3 | 0 |
| S6-B | Silver necklaces and fastening facts | 2 | 1 |
| B1 | Shared total for formal dress and shoes, then reduce total | 3 | 0 |
| B2 | Per-item affordability must not bypass combined total | 3 | 0 |
| B3 | Separate dress and shoe sizes and colours | 3 | 0 |
| B4 | Three-piece outfit under one total | 3 | 0 |
| B5 | Grouped broad discovery, optional refinement and memory through unclear intent | 3 | 0 |

Full fresh-model total: **74 pass, 1 fail**. The failing S6-B browsing phrase was fixed and its fresh three-repeat journey retest passed. A separate final-code replay with frozen model plans passed 75/75; that is not a fresh-model score.

## New grouped discovery and memory journey

### B5 run 1 — Pass

[Raw plan, input, reply and state](test-evidence/customer-scenarios-2026-10-17T12-11-29-199Z/B5-run-1.json)

**Customer:** I want a dress and shoes for formal events, my budget for both of them is 400 aud

**AI Stylist:** Here are choices for dresses and shoes. Choose one item from each group; every displayed combination stays within your A$400.00 combined budget. Combinations range from A$180.00 to A$250.00.

**Optional follow-up:** Would you like a particular dress style or colour? Do you have a preferred shoe style or heel height? You can also keep browsing these options.

Dresses: DISC-MIDI (A$100.00); DISC-MAXI (A$120.00); DISC-WRAP (A$150.00).

Shoes: DISC-HEELS (A$80.00); DISC-FLATS (A$90.00); DISC-SANDALS (A$100.00).

Status: matches. Check: Pass. Source: live model.

Remembered customer prompts: 1. Intent understood: true.

**Customer:** I would like blue dresses. Keep the shoes as they are and the 400 AUD total.

**AI Stylist:** Here are choices for dresses and shoes. Choose one item from each group; every displayed combination stays within your A$400.00 combined budget. Combinations range from A$200.00 to A$220.00.

**Optional follow-up:** Would you like a particular dress style? You can also keep browsing these options.

Dresses: DISC-MAXI (A$120.00).

Shoes: DISC-HEELS (A$80.00); DISC-FLATS (A$90.00); DISC-SANDALS (A$100.00).

Status: matches. Check: Pass. Source: live model.

Remembered customer prompts: 2. Intent understood: true.

**Customer:** zibble flomp splatch

**AI Stylist:** Could you clarify what you’d like to search for or change?

Status: needs_clarification. Check: Pass. Source: live model.

Remembered customer prompts: 2. Intent understood: false.

**Customer:** Only show flat shoes. Keep the blue dress options and the $400 total.

**AI Stylist:** Here are choices for dresses and flats. Choose one item from each group; every displayed combination stays within your A$400.00 combined budget. Combinations range from A$210.00 to A$210.00.

Dresses: DISC-MAXI (A$120.00).

Flats: DISC-FLATS (A$90.00).

Status: matches. Check: Pass. Source: live model.

Remembered customer prompts: 3. Intent understood: true.

**Customer:** What material is DISC-WRAP Dress from earlier?

**AI Stylist:** DISC-WRAP Dress
The recorded material is Polyester. A material label doesn't verify the full composition or certifications.

Status: answered. Check: Pass. Source: live model.

Remembered customer prompts: 3. Intent understood: true.

### B5 run 2 — Pass

[Raw plan, input, reply and state](test-evidence/customer-scenarios-2026-10-17T12-11-29-199Z/B5-run-2.json)

**Customer:** I want a dress and shoes for formal events, my budget for both of them is 400 aud

**AI Stylist:** Here are choices for dresses and shoes. Choose one item from each group; every displayed combination stays within your A$400.00 combined budget. Combinations range from A$180.00 to A$250.00.

**Optional follow-up:** Would you like a particular dress style or colour? Do you have a preferred shoe style or heel height? You can also keep browsing these options.

Dresses: DISC-MIDI (A$100.00); DISC-MAXI (A$120.00); DISC-WRAP (A$150.00).

Shoes: DISC-HEELS (A$80.00); DISC-FLATS (A$90.00); DISC-SANDALS (A$100.00).

Status: matches. Check: Pass. Source: live model.

Remembered customer prompts: 1. Intent understood: true.

**Customer:** I would like blue dresses. Keep the shoes as they are and the 400 AUD total.

**AI Stylist:** Here are choices for dresses and shoes. Choose one item from each group; every displayed combination stays within your A$400.00 combined budget. Combinations range from A$200.00 to A$220.00.

**Optional follow-up:** Would you like a particular dress style? You can also keep browsing these options.

Dresses: DISC-MAXI (A$120.00).

Shoes: DISC-HEELS (A$80.00); DISC-FLATS (A$90.00); DISC-SANDALS (A$100.00).

Status: matches. Check: Pass. Source: live model.

Remembered customer prompts: 2. Intent understood: true.

**Customer:** zibble flomp splatch

**AI Stylist:** What would you like to search for or change?

Status: needs_clarification. Check: Pass. Source: live model.

Remembered customer prompts: 2. Intent understood: false.

**Customer:** Only show flat shoes. Keep the blue dress options and the $400 total.

**AI Stylist:** Here are choices for dresses and flats. Choose one item from each group; every displayed combination stays within your A$400.00 combined budget. Combinations range from A$210.00 to A$210.00.

Dresses: DISC-MAXI (A$120.00).

Flats: DISC-FLATS (A$90.00).

Status: matches. Check: Pass. Source: live model.

Remembered customer prompts: 3. Intent understood: true.

**Customer:** What material is DISC-WRAP Dress from earlier?

**AI Stylist:** DISC-WRAP Dress
The recorded material is Polyester. A material label doesn't verify the full composition or certifications.

Status: answered. Check: Pass. Source: live model.

Remembered customer prompts: 3. Intent understood: true.

### B5 run 3 — Pass

[Raw plan, input, reply and state](test-evidence/customer-scenarios-2026-10-17T12-11-29-199Z/B5-run-3.json)

**Customer:** I want a dress and shoes for formal events, my budget for both of them is 400 aud

**AI Stylist:** Here are choices for dresses and shoes. Choose one item from each group; every displayed combination stays within your A$400.00 combined budget. Combinations range from A$180.00 to A$250.00.

**Optional follow-up:** Would you like a particular dress style or colour? Do you have a preferred shoe style or heel height? You can also keep browsing these options.

Dresses: DISC-MIDI (A$100.00); DISC-MAXI (A$120.00); DISC-WRAP (A$150.00).

Shoes: DISC-HEELS (A$80.00); DISC-FLATS (A$90.00); DISC-SANDALS (A$100.00).

Status: matches. Check: Pass. Source: live model.

Remembered customer prompts: 1. Intent understood: true.

**Customer:** I would like blue dresses. Keep the shoes as they are and the 400 AUD total.

**AI Stylist:** Here are choices for dresses and shoes. Choose one item from each group; every displayed combination stays within your A$400.00 combined budget. Combinations range from A$200.00 to A$220.00.

**Optional follow-up:** Would you like a particular dress style? You can also keep browsing these options.

Dresses: DISC-MAXI (A$120.00).

Shoes: DISC-HEELS (A$80.00); DISC-FLATS (A$90.00); DISC-SANDALS (A$100.00).

Status: matches. Check: Pass. Source: live model.

Remembered customer prompts: 2. Intent understood: true.

**Customer:** zibble flomp splatch

**AI Stylist:** What would you like to search for or change about your formal dress-and-shoes outfit?

Status: needs_clarification. Check: Pass. Source: live model.

Remembered customer prompts: 2. Intent understood: false.

**Customer:** Only show flat shoes. Keep the blue dress options and the $400 total.

**AI Stylist:** Here are choices for dresses and flats. Choose one item from each group; every displayed combination stays within your A$400.00 combined budget. Combinations range from A$210.00 to A$210.00.

Dresses: DISC-MAXI (A$120.00).

Flats: DISC-FLATS (A$90.00).

Status: matches. Check: Pass. Source: live model.

Remembered customer prompts: 3. Intent understood: true.

**Customer:** What material is DISC-WRAP Dress from earlier?

**AI Stylist:** DISC-WRAP Dress
The recorded material is Polyester. A material label doesn't verify the full composition or certifications.

Status: answered. Check: Pass. Source: live model.

Remembered customer prompts: 3. Intent understood: true.

## Focused browsing fix retest

### S6-B run 1 — Pass

[Raw plan, input, reply and state](test-evidence/customer-scenarios-2026-10-17T12-19-48-022Z/S6-B-run-1.json)

**Customer:** Show me silver necklaces under $80. I only need a necklace.

**AI Stylist:** I've found 2 silver accessory options for you to explore.

These options range from A$40.00 to A$65.00. I've kept this selection within your A$80.00 per-item limit.

Have a look below. You can keep browsing, or tell me something like "cheaper" or "a different colour" to refine the selection.

Products: N-SILVER-40 (A$40.00); N-SILVER-65 (A$65.00).

Status: matches. Check: Pass. Source: live model.

**Customer:** What material and fastening does the first necklace have?

**AI Stylist:** N-SILVER-40 Necklace
The recorded material is Silver-tone Metal. A material label doesn't verify the full composition or certifications. Zip closure: No Fastening: clasp

Status: answered. Check: Pass. Source: live model.

**Customer:** Show me other necklaces, still silver and under $80.

**AI Stylist:** I've found 2 silver accessory options for you to explore.

These options range from A$40.00 to A$65.00. I've kept this selection within your A$80.00 per-item limit.

Have a look below. You can keep browsing, or tell me something like "cheaper" or "a different colour" to refine the selection.

Products: N-SILVER-40 (A$40.00); N-SILVER-65 (A$65.00).

Status: matches. Check: Pass. Source: production shortcut.

### S6-B run 2 — Pass

[Raw plan, input, reply and state](test-evidence/customer-scenarios-2026-10-17T12-19-48-022Z/S6-B-run-2.json)

**Customer:** Show me silver necklaces under $80. I only need a necklace.

**AI Stylist:** I've found 2 silver accessory options for you to explore.

These options range from A$40.00 to A$65.00. I've kept this selection within your A$80.00 per-item limit.

Have a look below. You can keep browsing, or tell me something like "cheaper" or "a different colour" to refine the selection.

Products: N-SILVER-40 (A$40.00); N-SILVER-65 (A$65.00).

Status: matches. Check: Pass. Source: live model.

**Customer:** What material and fastening does the first necklace have?

**AI Stylist:** N-SILVER-40 Necklace
The recorded material is Silver-tone Metal. A material label doesn't verify the full composition or certifications. Zip closure: No Fastening: clasp

Status: answered. Check: Pass. Source: live model.

**Customer:** Show me other necklaces, still silver and under $80.

**AI Stylist:** I've found 2 silver accessory options for you to explore.

These options range from A$40.00 to A$65.00. I've kept this selection within your A$80.00 per-item limit.

Have a look below. You can keep browsing, or tell me something like "cheaper" or "a different colour" to refine the selection.

Products: N-SILVER-40 (A$40.00); N-SILVER-65 (A$65.00).

Status: matches. Check: Pass. Source: production shortcut.

### S6-B run 3 — Pass

[Raw plan, input, reply and state](test-evidence/customer-scenarios-2026-10-17T12-19-48-022Z/S6-B-run-3.json)

**Customer:** Show me silver necklaces under $80. I only need a necklace.

**AI Stylist:** I've found 2 silver accessory options for you to explore.

These options range from A$40.00 to A$65.00. I've kept this selection within your A$80.00 per-item limit.

Have a look below. You can keep browsing, or tell me something like "cheaper" or "a different colour" to refine the selection.

Products: N-SILVER-40 (A$40.00); N-SILVER-65 (A$65.00).

Status: matches. Check: Pass. Source: live model.

**Customer:** What material and fastening does the first necklace have?

**AI Stylist:** N-SILVER-40 Necklace
The recorded material is Silver-tone Metal. A material label doesn't verify the full composition or certifications. Zip closure: No Fastening: clasp

Status: answered. Check: Pass. Source: live model.

**Customer:** Show me other necklaces, still silver and under $80.

**AI Stylist:** I've found 2 silver accessory options for you to explore.

These options range from A$40.00 to A$65.00. I've kept this selection within your A$80.00 per-item limit.

Have a look below. You can keep browsing, or tell me something like "cheaper" or "a different colour" to refine the selection.

Products: N-SILVER-40 (A$40.00); N-SILVER-65 (A$65.00).

Status: matches. Check: Pass. Source: production shortcut.
