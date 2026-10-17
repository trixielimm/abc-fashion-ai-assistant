# Plan: outfit-aware cross-selling and useful upselling

Date: 17 October 2026. This is an implementation plan grounded in the current
working tree, a read-only catalogue audit and controlled checks of the current
functions. Proposed quality targets are release criteria, not measured results.

## Recommendation

Build a hybrid recommender: the conversation model interprets the customer's
goal; the server selects eligible products, scores compatibility and compares
value; the response layer explains the resulting evidence and trade-offs.

Start with a transparent, merchant-reviewed baseline on the existing catalogue.
Improve it with verified product features, expert-labelled outfits and measured
customer feedback. Introduce visual compatibility models or learned ranking only
after they outperform this baseline on the actual assortment.

The system should help the customer choose a useful addition or replacement.
Keeping the original item, buying nothing extra and saying “I cannot establish a
useful upgrade” must remain valid outcomes.

## 1. What the review confirmed

### Cross-sell selects a category rather than a compatible product

`lib/search/crossSell.ts` reads the primary item's single `cross_sell_category`,
resolves that category and passes its candidates through ordinary preference
search. The primary item's colour, occasion, style and season do not enter a
pair-compatibility score. A synthetic counterfactual check changed an anchor
from a summer beach-wedding dress to a winter work dress; the bag ranking stayed
`B1, B2` in both cases. This is a behavioural demonstration, not a customer study.

The same function returns `no_rule` when the customer explicitly requests shoes
but the stored category is Bags, even if a separate shoes search could run.
That protects against substituting the wrong category, but makes an approved
pairing category a rigid dependency for an explicit customer request.

The database can store multiple cross-sell rules, but `product_catalog` exposes
only the highest-priority category. The additional rules cannot currently help
the active conversation choose an outfit role.

### Upsell has a narrow but useful safety rule

`lib/search/upsell.ts` requires a higher-priced replacement of the same category,
subcategory and exact product type. It must preserve existing occasion/style/
fit/season matches and add at least one previously missing match. With no active
context preference, or all such preferences already matched, it returns
`no_upsell`. Construction, features, intended activities and documented use cases
cannot establish value under that policy.

The refusal to equate price with quality is sound and should remain. The gap is
the limited evidence the comparator understands. Same-price improvements should
also be available as alternatives, even though they are not upsells.

### The active presentation and session need changes too

- `lib/stylist/shoppingPresentation.ts` independently reconstructs upsell reasons
  from the same four labels. A new backend comparator alone would leave stale
  wording in the chat.
- `ChatProductSchema` carries explanation text, but lacks typed compatibility
  evidence, feature differences, costs and trade-offs for the active cards.
- The session retains a focus and the latest four displayed products, rather
  than a persistent set of selected outfit pieces and their roles.
- The visible product cards offer the recorded cross-sell action. Their action
  type supports upsell, but a useful premium comparison needs a deliberate UI.
- The low-level retrieval functions accept excluded IDs, while the active
  conversation call sites do not supply a durable rejection/cart history.
- The active preference search caps results at four before presentation applies
  some shared-context checks. The new pipeline must apply all eligibility checks
  before final selection, so good candidates are not hidden by the cap.

### Catalogue readiness

The public catalogue audit found 316 visible products: 180 Clothing, 58 Shoes,
40 Accessories and 38 Bags. All 316 had nonempty basic styling labels,
descriptions, tags, pairing-category labels and image keys. This measures field
presence; it does not verify the labels, images or product claims.

The schema has no dedicated, source-backed fields for lining, closures, strap
adjustability, heel dimensions, capacity, garment measurements, construction
tests, care instructions or approved benefit statements. Sample descriptions
repeat the basic labels. One sample calls an item a “silk scarf” while recording
Viscose as its material; another uses “Woven” as a material. These require
semantic review: product-type wording does not establish fibre composition, and
weave should be separate from composition.

No recommendation-event or order-history integration was found in the inspected
app/schema. The cart currently lives in browser localStorage. Purchase-based
learning and sales-lift claims therefore need additional instrumentation and an
authoritative order integration.

Current functional suites passed: 15 cross-sell checks and 16 upsell checks.
They verify the existing policies, rather than measuring outfit quality.

Audit evidence: [catalogue profile](test-evidence/styling-catalogue-audit-2026-10-17.json)
and [controlled policy probes](test-evidence/styling-policy-probes-2026-10-17.json).

## 2. Architecture and evidence principles

Use separate candidate generation, scoring and final re-ranking. This follows
the established [Google recommendation architecture](https://developers.google.com/machine-learning/recommendation/overview/types).
At this catalogue's present size, scoring every eligible product is a sensible
first implementation. A new vector database or trained retrieval model is not
a prerequisite; reassess using measured latency as the assortment grows.

Use different objectives for substitutes and complements. Looking similar to
a dress is not the same as being a bag that goes with it. This distinction is
central to [type-aware fashion compatibility research](https://www.ecva.net/papers/eccv_2018/papers_ECCV/papers/Mariya_Vasileva_Learning_Type-Aware_Embeddings_ECCV_2018_paper.pdf).

Give every recommendation reason an evidence type:

- **Product fact:** a typed value with a catalogue/supplier source and review
  status. Conflicting or inferred values cannot establish a premium claim.
- **Styling judgment:** a merchant-reviewed compatibility rule, expert rating
  or validated model output. Present it as a styling suggestion.
- **Customer requirement:** an explicit preference with scope and turn evidence.
- **Unknown:** retained as unknown, never converted into a positive attribute or
  proof that the baseline item lacks a feature.

The model may select or phrase supported reasons. It cannot override inventory,
budget, exclusion rules, product identities or source evidence. Avoid uncalibrated
“97% compatible” claims and universal assertions about fashion taste.

## 3. Data contracts and merchant input

Add versioned, typed product-feature records rather than expanding freeform tags
into arbitrary quality scores. Proposed records include product ID, feature key,
value, unit, applicability, source reference, source version, review status and
review time. Keep verified facts separate from image-derived observations.

Prioritise features customers can actually use:

- Dresses: length, lining, transparency where verified, pockets, fastening,
  adjustability, garment measurements and care requirements.
- Shoes: heel height and shape, fastening, material composition, documented sole
  features and size-system information. Comfort needs appropriate evidence.
- Bags: dimensions/capacity, closure, compartments, strap length/adjustability
  and materials.
- Styling across categories: formality, silhouette/volume, pattern, colour
  family, visible texture and approved occasion/use mappings.

Seed a small, useful assortment of verified comparisons and curated outfit
pairs first. Establish which source wins when labels conflict; unresolved
contradictions block the affected claim. Existing non-conflicting labels can
already support a first pairing baseline. Hidden construction and performance
claims require better evidence before shipping premium reasons.

Price, brand, fibre name and “All Season” do not independently prove superior
quality, breathability, durability, comfort or versatility. “Premium” needs a
specific, relevant difference. Multiple recorded occasion labels alone are weak
evidence of real wardrobe versatility.

## 4. Cross-sell behaviour

1. Resolve the anchor item or explicitly selected outfit. Retrieve fresh product
   records and retain the customer's occasion, use and styling goal.
2. Resolve the requested role. “Shoes for this dress” searches Shoes; it does not
   become a bag request because of the stored rule. For a general “complete the
   look”, use approved role relationships and the full rule set, then identify
   genuinely missing roles. Do not offer another dress as an addition to a dress
   unless the customer requested an appropriate layering/substitution task.
3. Apply current stock, category/type, applicable size, price, explicit exclusions,
   material requirements, owned/cart items, rejected IDs and shared constraints
   before ranking. Preserve unsupported requirements as blocking when they
   cannot yet be verified.
4. Score each eligible addition against the anchor/outfit and brief: occasion
   suitability, formality, merchant-approved colour relationships, silhouette,
   pattern/texture balance and practical use. Use the relevant subset of those
   signals; missing attributes must reduce evidence coverage, not receive a
   guessed match.
5. Rank by customer relevance and compatibility, then diversify the shortlist
   where justified. A neutral, coordinated or contrasting option can be offered
   when the customer has not imposed an incompatible colour restriction.
   Never use palette rules to override an explicit colour requirement.
6. Explain one or two actual pairing reasons and any material mismatch. Return
   fewer products when only a few have sufficient evidence. An eligible product
   with weak pairing evidence can be labelled as an available alternative;
   eligibility alone does not make it a verified outfit match.

Merchant styling matrices and curated examples provide the initial weights and
thresholds. Tune them against held-out expert judgments. There is no universal
colour-wheel formula or fixed weighting that is best for every customer.

Final diversity belongs in the design, consistent with [Google's re-ranking
guidance](https://developers.google.com/machine-learning/recommendation/dnn/re-ranking).

## 5. Upsell and value comparison

First identify what “better” means for this customer. Use an existing requirement
such as secure closure, adjustable straps, easier care or a second occasion. If
that priority is genuinely unknown and changes the result, ask one focused
question, such as “Would you value more adjustability or easier care?” Do not
turn every comparison into a questionnaire.

Generate replacements from the same functional family. Preserve an explicit
requested product type. Where type was inferred, merchant-reviewed substitution
relationships may allow related types that serve the same need; do not silently
relax a customer-specified type, size or other requirement.

A higher-priced option qualifies only when it:

- Passes all hard requirements and the authorised budget.
- Has a verified, customer-relevant improvement over the original.
- Preserves must-have benefits, with meaningful trade-offs disclosed.
- Shows the original price, replacement price and extra cost calculated in cents.

Unknown baseline features do not count as absent. If the alternative has a
lining but the original's lining is unrecorded, describe the known detail and
uncertainty; do not assert that the upgrade “adds a lining”. Keep comfort and
quality claims out of the response unless there is evidence for those claims.

Use separate outcomes for a worthwhile upgrade, a same-price/cheaper improvement,
no meaningful benefit found and insufficient evidence to compare. Preserve the
original as a valid choice. An option with a trade-off can still be useful, but
must not be called universally better.

Illustrative future wording, only if the facts have been verified: “A$25 more:
this version has an adjustable strap, which addresses your request for easier
adjustment. It has the same verified capacity and a higher care requirement.”
This is not a claim about an existing catalogue product.

## 6. Conversation, outfit state and budgets

Add an explicit styling brief and selected outfit state alongside the current
preference scopes. Track selected product IDs and roles, owned versus newly
proposed items, occasion, practical priorities, palette intent, rejected items
and the active budget scope. Displayed cards must not automatically become
selected outfit pieces.

For “keep the dress and bag; find shoes”, score against both retained items.
For “why?”, use the exact evidence produced by that recommendation. Preserve
that outfit when another search replaces the latest four cards. For “already
own a bag”, suppress duplicate-role selling. “No extras” should stop proactive
cross-sell offers until the customer changes that instruction.

Budget types must distinguish per item, per replacement, added spend and total
outfit spend. Whole-outfit requests need a set selector that counts each product
once, uses current prices and preserves already-selected pieces. Exclude owned
items only when the customer says they are already owned. Explicitly describe
the amount as a merchandise subtotal when shipping/fees cannot be established.
If no feasible set exists, explain the constraint and ask which component or
limit the customer wants to change.

Use bounded set search over role-specific candidate pools for outfit assembly,
with all money calculations in cents. Keep affordable candidates in those pools
so early relevance pruning does not remove the only budget-feasible set. Expand
the search when necessary; an exhausted heuristic pool is not proof that the
entire catalogue has no feasible outfit.

Treat browser cart IDs as context to verify server-side, not trusted facts.
Use category-specific size needs; a dress size cannot become a shoe size.
Recommendations do not reserve stock or alter the cart without a customer action.

## 7. Implementation sequence

### Batch 1 — facts, policy and benchmark

Deliver the feature/evidence schema, data-quality checks, a merchant-reviewed
styling/benefit rubric and a frozen baseline evaluation set. Extend the existing
Supabase schema/catalogue read model and generated types where necessary. Keep
schema migrations additive. Collect expert judgments independently of model
answers and reserve a held-out set.

### Batch 2 — candidate selection and cross-sell compatibility

Separate eligibility and candidate retrieval from the four-card display cap.
Introduce shared modules for candidate selection, pair compatibility and
evidence. Update `lib/search/crossSell.ts` and
`lib/stylist/conversationSearch.ts`. Expose all relevant approved pairing rules
instead of the view's single winning target. Apply shared restrictions before
the cap. Ship the reviewed rule baseline first behind a feature flag.

### Batch 3 — value-aware replacement comparison

Introduce a benefit comparator and update `lib/search/upsell.ts`. Preserve the
existing price/stock/exclusion checks while expanding the benefit vocabulary.
Keep the existing context-match benefit as one valid reason. Add comparable
alternative outcomes and explicit insufficient-evidence reasons. Calibrate
benefit and trade-off thresholds with the merchant review set.

### Batch 4 — chat contract, cards and outfit selection

Update `conversationPlan.ts`, `conversationProtocol.ts`, `conversationTurn.ts`,
`shoppingPresentation.ts`, `friendlyShoppingMessage.ts`, `conversationAnswers.ts`,
`ConversationChat.tsx` and `ShoppingProductResults.tsx`. Add typed evidence and
cost/trade-off fields rather than regenerating old label-only explanations.
Update reference handling, pending questions, cancellation and retries to retain
outfit state. Revalidate the card evidence on the server and in the client
contract. Keep useful actions optional and avoid repeating sales offers.

### Batch 5 — measurement and gradual release

Instrument recommendation impressions, positions, selections, rejections,
add-to-cart actions and no-recommendation reasons with policy/data versions.
Add purchase/return attribution only through authoritative order data. Validate
events before using them for ranking or commercial conclusions. Roll out to a
small randomised audience with a flag that restores the prior policy.

These batches are the proposed build order. Feature verification and merchant
review are critical dependencies; assigning delivery dates without their scope
would give a false level of certainty.

## 8. Visual and learned recommendations after the baseline

Audit whether image keys resolve to accurate, authorised product photographs.
Never score placeholders or unrelated lifestyle photographs as the product.
Precompute visible attributes and embeddings offline, with missing-image
fallbacks; avoid one expensive vision-model call for every candidate on every
chat turn. Keep inferred observations separate from approved product facts.
An image cannot verify hidden lining, fibre composition, comfort or durability.

Version and cache relatively stable product features and compatibility data.
Revalidate price, availability and applicable sizes before showing a result and
again through the authoritative cart/checkout flow. A cached styling score must
not authorise stale stock or prices. Record the evidence and policy versions
used for each recommendation so decisions can be reproduced and rolled back.

Evaluate type-aware compatibility and whole-outfit models against the reviewed
baseline. Similarity alone is insufficient for complements. Eventually score
the whole selected outfit, because several acceptable pairs can still form a
poor overall set. [Text2Outfit](https://www.amazon.science/publications/text2outfit-controllable-outfit-generation-with-multimodal-language-models)
provides a relevant research example that evaluates both feature matching and
visual compatibility; its results do not establish performance on this shop.

Use curated outfit examples for cold start. Add behavioural signals only after
collecting enough reliable exposure and outcome data. Co-purchase is a noisy
signal about complementarity, and an unshown item is not a negative example.
Split evaluation by product/outfit or time to avoid near-duplicate leakage.
Train a new model only when data volume, measured quality gains and serving
cost justify it.

## 9. Acceptance tests and evaluation

Keep all existing safety and conversation regressions. Deliberately revise tests
that encode the old category-only/extra-label policies when the new, documented
contract replaces them. Add these scenarios:

- Changing the anchor from a summer beach wedding to winter work changes the
  ranking on a curated fixture where different additions are judged appropriate.
- Explicit shoes are searched even when the default pairing rule is Bags;
  irrelevant bags are never substituted.
- A higher-stock incompatible candidate cannot displace a lower-stock compatible
  candidate merely because inventory wins a tie-break.
- A useful lining/closure/adjustability improvement qualifies when verified and
  relevant; the extra cost is correct and all must-haves are preserved.
- Identical features with a higher price do not qualify. Unknown baseline
  features, unsupported durability claims and expensive materials do not create
  fabricated improvements.
- Same-price and cheaper improvements are available through the appropriate
  alternatives path. A budget of zero and exact price boundaries are respected.
- Owned/cart/rejected pieces are not repeatedly sold; multiple selected anchors
  remain available after new results, clarification and policy questions.
- A complete-outfit subtotal is enforced across the selected set, without
  silently turning the total into a per-item allowance.
- Missing or misleading images cannot create confident visual claims.
- No confident recommendation, provider failure and no eligible inventory have
  distinct, useful outcomes. No cart action occurs automatically.

Evaluate eligibility and styling separately. Use category-matched hard negatives
so an easy “bag versus dress” distinction cannot inflate a compatibility score.
Have at least two reviewers label a representative benchmark and adjudicate
disagreements. Cover realistic occasions, sizes, budgets, styles and metadata
gaps; fashion judgments should not assume one universal aesthetic.

Proposed initial gates: zero known hard-constraint violations or unsupported
factual claims in the release suite; measurable improvement over the current
policy on held-out expert preference/ranking judgments; acceptable abstention
and coverage; and no material latency/cost regression against agreed budgets.
Set numerical quality thresholds after baseline measurement, then freeze them
before evaluating the candidate policy. Report uncertainty rather than inventing
an accuracy guarantee from a small test set.

Track request success, candidate coverage, evidence coverage, eligible-result
precision, NDCG@4 where relevance labels exist, expert pairwise preference,
unsupported-claim rate, duplicate/rejection recurrence, p95 latency and cost.
An LLM judge may help triage, but must not be the sole judge of styling quality.

For commercial evaluation, measure incremental add-on purchase/attach rate and
revenue per eligible session, alongside conversion, satisfaction, dismissals,
returns/cancellations and recommendation quality. A higher average basket alone
can conceal lost conversions. Use session/user assignment appropriate to the
identity available, avoid mixing policies within an outfit, predefine stopping
rules and examine data quality and mature return cohorts. These controls follow
the metric-interpretation concerns described by [Microsoft Research](https://www.microsoft.com/en-us/research/publication/a-dirty-dozen-twelve-common-metric-interpretation-pitfalls-in-online-controlled-experiments/).

## 10. First release scope

The first release should deliver an anchor-aware, explainable cross-sell scorer,
a verified benefit comparator for a curated subset of products, optional value
comparison cards, selected-outfit memory and event instrumentation. Retain safe
abstention outside that coverage. Whole-outfit budget solving can follow as a
separate capability once set selection and budget semantics are implemented.

Success is useful, justified choices with measured customer outcomes. No sales
uplift percentage, universal compatibility threshold or model choice is promised
before local evaluation.
