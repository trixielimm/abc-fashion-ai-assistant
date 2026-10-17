# AI stylist: customer scenario test pack

These scenarios test whether the stylist adapts its level of assistance to the
customer. The four journeys are **direct shopping**, **guided shopping**,
**discovery**, and **styling around owned items**. Each has a main conversation
and two variations: 12 cases in total.

Status: **test specification; these conversations have not been executed as part
of creating this document**. Expected behaviour describes the acceptance target,
not a claim that the current implementation passes.

## How to run

1. Open AI Stylist and start a **New chat** for each case, including variations.
2. Send the customer messages one at a time. Wait for each response. Suggested
   assistant wording illustrates the intent; exact wording is not required.
3. Where a step refers to a displayed product, record its name and ID first.
   Only send that step if the referenced product exists. If the catalogue cannot
   supply it, assess the no-match response and mark the remaining steps
   **Blocked: catalogue setup** rather than inventing a product or counting the
   full journey as passed.
4. Prices are in AUD. Use the catalogue's recorded size labels; a size match is
   not a guarantee that a garment will fit.
5. Save the transcript, displayed product IDs, prices and relevant catalogue
   attributes. Record the app version/commit, model configuration and test date
   so another tester can reproduce the run.

For reliable repeat runs, prepare a fixed catalogue fixture with eligible
products, a cheaper alternative, and a deliberate empty-result combination.
Live stock changes must not turn a missing fixture into an AI behaviour failure.

## 1. Direct shopping: customer knows what they want

**Customer:** Has a complete brief and wants efficient product discovery with
minimal guidance.

### S1-A — Fulfil the brief without an interview

Customer messages:

1. `Show me black dresses in size 10 under $150. I only need a dress, no other items.`
2. `Show me cheaper options than the first dress, keeping my other requirements.`
3. `What material is the first dress in the new results?`

Expected behaviour:

- Search after message 1. Do not ask for colour, size or budget again, or require
  an occasion before showing eligible results.
- Show only dresses satisfying the recorded colour, size and price restrictions.
  If none qualify, explain the gap and keep the restrictions.
- Message 2 uses the original first dress as the price reference. New options
  cost less than that dress and retain black, size 10 and the original ceiling.
  Returning no cheaper option is acceptable when none exists.
- Message 3 answers about the first dress in the **new** results, using recorded
  material information or acknowledging that it is unknown. It does not restart
  shopping or turn the material question into a new requirement.
- Do not proactively recommend shoes, bags or premium replacements after the
  customer has said they only need a dress.

**Fail examples:** repeats the intake questions; loses size during “cheaper”;
claims a dress fits perfectly; recommends an extra bag despite “no other items”.

### S1-B — Change one requirement

1. `Show me black dresses in size 10 under $150.`
2. `Actually, blue instead of black. Keep everything else.`
3. `My maximum is now $100.`

Expected: replace black with blue, then change only the maximum price. Size 10
and the dress category survive both edits. Do not retain black as a second
preferred colour or infer a different size.

### S1-C — No eligible product

Setup: confirm that the fixture has no black dress in size 10 at or below $1.

1. `Show me black dresses in size 10 under $1.`
2. `Keep the $1 limit. Don't show other colours or sizes.`

Expected: explain that no eligible product is available and keep the stated
restrictions. The assistant may offer a possible next step, but cannot apply it
without the customer's agreement. No over-budget or wrong-size product cards.

## 2. Guided shopping: customer has some requirements

**Customer:** Knows the purpose or budget but needs help narrowing the choice.

### S2-A — Help refine an incomplete brief

Customer messages:

1. `I need a dress for a beach wedding under $150, but I don't know which colour or style.`
2. `Let's try blue. I don't know my size yet; can I browse first?`
3. `Compare the first and second dresses and explain the differences.`
4. `I'd prefer something more relaxed. Keep blue and the same budget.`

Expected behaviour:

- Use the known category, occasion and budget immediately. Offer a small,
  explained shortlist when possible; an optional question can help refine it.
  Missing colour, style and size are not reasons to block browsing.
- Briefly explain why options may suit the stated occasion, using catalogue
  evidence. Disclose a contextual mismatch rather than calling every option a
  wedding match.
- Message 2 adds blue and leaves size unknown. Do not guess a size.
- Compare the actual two displayed dresses on supported facts, such as price,
  material, recorded fit and occasion. Clearly identify missing information.
- Message 4 retains blue and the price ceiling. Explain the interpretation of
  “more relaxed”, or ask one focused question if it cannot be resolved safely.

Example of a useful optional question: “Would you prefer a relaxed or more
formal look?” The customer should still be able to browse without answering it.

**Fail examples:** demands a completed questionnaire; invents a size; treats a
higher price as proof of better quality; forgets the occasion after a colour edit.

### S2-B — Customer rejects the suggestions

1. `Show me dresses for work under $120.`
2. `I don't like the first dress. Don't show it again.`
3. `Show me other options, still for work under $120.`

Expected: retain the rejection across the next search, preserve the brief, and
avoid repeating the rejected product ID. If no other eligible option exists,
say so. Do not treat rejection of one dress as rejection of all dresses.

### S2-C — Customer is unsure about a feature

1. `Show me bags under $100.`
2. `Does the first bag have a zip closure?`
3. `I only want bags with a zip closure. Keep the $100 limit.`

Expected: message 2 is a factual question, not a saved requirement. Answer from
available specifications and acknowledge missing data. Message 3 explicitly
adds a must-have: recommend only bags with verified supporting feature data,
or explain that qualifying products cannot be verified. Unknown is not “yes”.

## 3. Discovery: customer has no fixed requirements

**Customer:** Wants inspiration and may need help expressing a shopping goal.

### S3-A — Turn uncertainty into a useful direction

Customer messages:

1. `I feel like buying something new, but I have no idea what I want.`
2. `Something for everyday wear. Maybe a dress, but I'm open to ideas.`
3. `Let's start with dresses. Any colour, and I haven't set a budget.`
4. `I like the first dress. Show me similar options under $100.`

Expected behaviour:

- Respond helpfully to uncertainty. Ask one easy starting question, such as
  “Is this for everyday wear or a particular occasion?”, or offer a few clear
  shopping directions. Do not invent a category, gender, size or budget.
- Use everyday wear as context. If a category still needs confirmation, ask a
  focused follow-up instead of requesting every preference at once.
- After message 3, show eligible dresses without insisting on colour, size or
  budget. Display prices so the customer can make an informed choice.
- Message 4 introduces a real $100 maximum and a reference product. Retain the
  dress category and relevant context. Explain which recorded attributes make
  an option similar, or clarify which aspect matters if necessary.
- “I like” does not automatically add the dress to the outfit or cart.

**Fail examples:** repeatedly says “provide more details”; invents a $150 budget;
assumes that the most expensive option is the best starting point; silently
adds the liked dress to the cart.

### S3-B — Customer declines to narrow the search

1. `I'd like to browse dresses for inspiration.`
2. `I'm not sure about colour, size or budget. Just show me some options.`

Expected: show a small selection from the available assortment with useful
descriptions. Optional preferences remain optional. A varied selection is a
styling quality target; judge it against the actual catalogue, not exact wording.

### S3-C — Customer changes direction

1. `Show me blue dresses in size 10 under $150.`
2. `Actually, forget dresses. I want a black bag under $80.`

Expected: start a bag search with black and $80. Do not carry dress size 10,
blue or the dress category into the bag search. No dress was explicitly kept,
so it must not appear as a selected outfit piece.

## 4. Owned-item styling: customer wants a matching addition

**Customer:** Wants to use something they already have rather than replace it.

### S4-A — Match an owned catalogue item

Setup: use a catalogue dress and at least one eligible bag for it. The initial
search makes the owned product addressable in the test conversation; it does
not simulate buying it.

Customer messages:

1. `Show me dresses under $150.`
2. `I already own the first dress. Keep it as an owned piece in my outfit.`
3. `Find a bag to go with my owned dress, under $80. I don't need another dress.`
4. `Why does the first bag go with my dress?`

Expected behaviour:

- Record the exact dress as owned, retaining its identity after the bag search.
  Marking it owned does not add it to the cart.
- Search for bags under $80 and use the owned dress as the pairing anchor.
  Do not treat the original dress budget as the bag budget, recommend another
  dress, or recommend buying the owned dress again.
- Give specific, supported pairing reasons, such as recorded colour
  relationships or occasion/style alignment. Distinguish styling suggestions
  from product facts and acknowledge limited evidence.
- The explanation in message 4 still refers to the owned dress and the first
  displayed bag. It does not create a new search or replace the owned anchor.

**Fail examples:** loses the dress when bags are displayed; matches against an
unselected dress; says a bag matches perfectly without evidence; offers a new
dress as the requested addition.

### S4-B — Match something bought elsewhere

1. `I already own a plain navy midi dress from another shop. I want shoes to match it for a wedding, under $100.`
2. `I don't have a product link or photo. Please work from that description.`

Desired experience: retain the customer-provided description, ask only for
details that materially affect the suggestion, and offer qualified shoe ideas
within budget. Do not invent the dress's material, exact shade or product ID.

Current implementation boundary: outfit pieces require a known catalogue
product ID, and general ownership records only the category. There is no
structured external-garment record for the described dress. Evaluate this case
in two parts:

- **Honest handling:** acknowledge the limitation and offer a useful fallback,
  such as browsing wedding shoes under $100. Do not present a fallback as a
  verified match to an external dress.
- **Styling capability:** record a feature gap if the assistant cannot preserve
  the described garment and use it for subsequent matching. Honest refusal does
  not count as completing the desired styling journey.

### S4-C — Respect multiple owned items

Setup: have an owned dress in the outfit using the setup from S4-A.

1. `Show me bags.`
2. `I already own the first bag too. Keep it as an owned piece in my outfit.`
3. `Find shoes to go with both my owned dress and bag, under $120.`
4. `No extra recommendations after the shoes.`

Expected: retain both product IDs, consider both pieces when ranking shoes,
and use $120 only for the requested shoes. Explain any conflicting styling
signals rather than quietly ignoring one anchor. Do not suggest replacing the
owned pieces or continue proactive offers after message 4.

## Assessing each run

Record **Pass**, **Fail**, **Blocked** or **Feature gap**, with the exact failing
turn and evidence. A blocked setup is not a pass. A feature gap still needs
product work even if the assistant explains the limitation honestly.

Check these dimensions across all four journeys:

- **Appropriate assistance:** direct for a complete brief; focused help for a
  partial brief; easy starting choices for uncertainty; additions around owned
  pieces for matching requests.
- **Requirement fidelity:** stated price, size, category, exclusions and
  must-haves survive until the customer explicitly changes them. Distinguish
  item-specific restrictions from requirements explicitly shared across items.
- **Conversation memory:** references resolve to the intended product; edits,
  rejections, ownership and unanswered questions survive relevant follow-ups.
- **Grounded explanations:** product claims match the catalogue, missing facts
  remain unknown, and styling judgments are presented as suggestions.
- **Customer control:** no automatic purchase, cart addition, ownership,
  selection or relaxation of a restriction. “No extras” is respected.
- **Useful outcome:** an eligible shortlist and an understandable next step,
  or a specific explanation of why the request cannot currently be fulfilled.

Any violated hard restriction, invented product fact, wrong product reference,
or unauthorised cart action makes the affected case **Fail**, regardless of how
polished the response sounds. Have a human reviewer assess pairing taste and
shortlist usefulness; matching catalogue labels alone does not establish that
an outfit looks good.

Suggested result record: case ID; fixture/catalogue version; transcript and
product IDs; result; failing turn; expected versus actual behaviour; issue link.
Run each main journey more than once when evaluating model consistency, and
retain every run instead of reporting only the best response.

## Related checks

See [shopping answer tests](ai-stylist-answer-testing.md) for product questions,
comparisons and policy handling, and the [commerce implementation notes](ai-stylist-commerce-implementation-2026-10-17.md)
for current outfit and recommendation boundaries.

Existing regression and live scripts cover parts of these behaviours; they do
not yet automate this complete customer scenario pack. In particular, discovery
conversation quality, external-item styling and human judgments of outfit taste
need separate assessment.
