# AI Stylist remediation plan

19 October 2026 · Based on the [42-message customer evaluation](report.md)

## Objective and completion standard

Make the stylist handle an evolving shopping conversation without losing the brief, trapping the customer in clarification loops or claiming more than the catalogue supports. Cover all nine evaluation findings, including product photos and specification provenance.

A completed journey means the shopper receives eligible options and can refine or assemble them, or receives a specific, honest explanation of why the request cannot be fulfilled and can change that requirement without restarting. Stock shortages are a valid outcome. Generic rephrase loops, unnamed conflicts and fabricated certainty are not.

This document proposes implementation work. No application fixes, migrations, deployments or new live test runs were performed while preparing it. The eleven source files fingerprinted in the evaluation still match the saved hashes. The working tree contains earlier changes; implementation must preserve and account for that baseline.

## Product and engineering decisions

1. **Keep authoritative catalogue execution.** The interpreter proposes intent and changes; server validation resolves identities, applies constraints, reads current prices and builds grounded responses. Retain evidence checks and the bounded plan-repair attempt.
2. **Separate the current task from lasting preferences and the saved look.** Replacing a search clears the superseded task and its pending questions. Explicit shared restrictions and saved garments survive unless the customer changes them. New chat remains the full reset.
3. **Make blocked requests explainable.** Preserve typed validation issues through to the customer-facing response. A known invalid size, a missing feature, an ambiguous reference, an interpretation failure and an empty stock result must have different explanations.
4. **Allow provisional exploration only when authorized.** If the shopper explicitly permits browsing with an unverified requirement, retain the requirement and label each unknown. Never label those products exact matches or include a product with a known violation of an active hard rule.
5. **Use one budget calculation for the same set of purchases.** Selected garments count toward a stated combined purchase budget; owned garments are styling references. Re-read prices before making a total claim. A saved card price is a snapshot.
6. **Use optional discovery to help browsing.** Apply volunteered information first. Ask only a relevant missing question and immediately honor “show me ideas.” No need to guess a size to browse.
7. **Ship compatible, reviewable increments.** Extend the existing schemas and functions. Keep each bundle independently verifiable and preserve existing price, size, identity, alternative and cart invariants.

## Execution order and responsibilities

Work packages are identified W0–W8 below. The dependency order is: W0 establishes the baseline; W1 can ship independently; W2 precedes W3; W3 precedes W4 and W5; W6 builds on the conversation contracts; W7 can progress alongside conversation work; W8 validates the integrated result.

Primary responsibilities are roles, not assumed assignments: conversation/backend for state, validation and budgets; frontend for cards and recovery controls; catalogue/content for image and specification evidence; QA for independent customer journeys. One engineer can cover multiple roles. No parallel agents or new chats are required by this plan.

### Review bundle boundaries

- Bundle A: W0 diagnostics and baseline capture.
- Bundle B: W1 truthful card copy and relevant event guidance.
- Bundle C: W2 structured issue contract and rendering.
- Bundle D: W3 task replacement, cancellation and unresolved requirements.
- Bundle E: W4 references and catalogue vocabulary.
- Bundle F: W5 saved-look budget continuation.
- Bundle G: W6 discovery and complete, source-labelled answers.
- Bundle H: W7 image health and discovery photo quality.
- Bundle I: W8 integration evidence and release readiness.

Each bundle includes its affected contract checks and focused regressions. Broader verification follows integration. These are proposed review boundaries; no branches or PRs have been created.

## W0 — Capture the baseline and diagnose the actual rejection

**Priority:** foundation. **Depends on:** none. **Primary:** conversation/backend and QA. **Findings:** F1–F5 diagnostic support.

### Work

- Record current source hashes, dependency lockfile, configured model identifier and relevant feature flags without recording keys or secret values. Preserve the prior evaluation and dirty working tree. Establish which existing changes belong in the implementation baseline before editing overlapping files.
- Convert the observed failures into reproducible diagnostic inputs. Begin with S2's pre-reset dress conflict, S3's compound jacket reference, S5's fresh medium/regular/work-shirt brief, and S2's saved-dress shoe request.
- Add a server-side trace around interpretation, plan validation, vocabulary validation, scope composition, reference resolution, retrieval and presentation. Include request correlation, stage, retry count, typed rejection code, affected field/scope, task generation and timing. Capture structured before/after state differences using safe enum/number values rather than raw customer text by default.
- Keep diagnostics separate from existing optional recommendation-click analytics. Extend the existing server logger first; a new database or analytics vendor is unnecessary for the initial fix. Diagnostic failure must not block a shopping reply. Full development traces belong in explicitly enabled local evidence capture, with secrets and signed URLs omitted.
- Distinguish a failed model interpretation from a valid plan rejected by a catalogue label or saved restriction. Review rejected plans before changing the prompt, token budget or model configuration.

**Main files:** [conversation-search route](../../../app/api/conversation-search/route.ts), [interpretConversation.ts](../../../lib/ai/interpretConversation.ts), [conversationPlan.ts](../../../lib/stylist/conversationPlan.ts), [conversationSearch.ts](../../../lib/stylist/conversationSearch.ts). Reuse the current recommendation telemetry boundary rather than placing debugging payloads in click events.

### Exit criteria

For each of the four diagnostic inputs, the evidence identifies the failing stage and field, or shows a valid no-match result. The trace separates observed facts from hypotheses. Baseline test failures are recorded before implementation so later regressions are attributable.

## W1 — Ship the two directly confirmed UI fixes

**Priority:** P1 size wording; P2 event relevance. **Depends on:** baseline capture in W0. **Primary:** frontend. **Findings:** F6, F7.

### Work

- Change the size reason derived from `sizes_available` to “Size 12 is listed.” Keep catalogue item availability distinct from variant stock, reservation and fit. Do not add a variant-stock claim until that data actually exists and is verified.
- Render event guidance only when the active task has relevant event intent. The existence of an outfit request alone is insufficient. Work and casual outfits must not display a formal-event picker.
- Preserve wedding and cocktail information already supplied. Add cocktail as a supported event context with explicit, reviewed guidance; separate it from the coarser catalogue occasion label. Avoid inventing a literal catalogue value to represent a dress code.
- Keep buttons, selected state and accessible names consistent with the active task. Old reply entries must not display controls for a superseded task.

**Main files:** [productCardPresentation.ts](../../../lib/stylist/productCardPresentation.ts), [ConversationChat.tsx](../../../components/stylist/ConversationChat.tsx), [OutfitGuidance.tsx](../../../components/stylist/OutfitGuidance.tsx), [dressCode.ts](../../../lib/stylist/dressCode.ts), [commerceSchema.ts](../../../lib/stylist/commerceSchema.ts).

### Exit criteria

S1's card agrees with its later stock explanation. Dad's office outfit has no formal-event picker. A winery cocktail-wedding brief is acknowledged without asking the customer to repeat the event. Use focused behavior checks; a text-only copy change does not require a new test suite.

## W2 — Carry structured blockers from validation to recovery controls

**Priority:** P1. **Depends on:** W0. **Primary:** conversation/backend and frontend. **Finding:** F1.

### Work

- Introduce a shared issue schema with a stable code, affected field, item/shared scope, supplied value, conflicting value when present, constraint/reference IDs and supported recovery actions. Candidate codes include invalid preference, shared conflict, unverified requirement, ambiguous reference, stale product and interpretation failure. No-match results carry a separate reason rather than pretending to be malformed input.
- Preserve the existing `PreferenceIssue` details instead of flattening them to a string and subsequently replacing that string. Return scope-composition conflicts as structured values too. Carry them through search results, presentation, pending state and `TurnReplySchema`.
- Generate concise customer wording from the issue, using actual values. Example: “Your saved rule applies Formal to every item. This dress search asks for Wedding Guest. Replace that rule for this task?” Show that question only if those are the actual conflicting values.
- Add typed, scoped recovery actions. A choice refers to the current issue and task generation, preventing a stale button from modifying a newer task. Customers can still answer in natural language.
- Offer valid options from the catalogue vocabulary where helpful. Do not expose schema paths, raw provider failures or internal prompts in shopping UI.
- Handle exhausted interpretation repair as its own issue: acknowledge which action could not be understood and retain the proposed brief for correction. Keep bounded retries; do not repeatedly call the model until a plan passes.

**Main files:** [validatePreferences.ts](../../../lib/ai/validatePreferences.ts), [preferenceScope.ts](../../../lib/stylist/preferenceScope.ts), [conversationSearch.ts](../../../lib/stylist/conversationSearch.ts), [shoppingPresentation.ts](../../../lib/stylist/shoppingPresentation.ts), [friendlyShoppingMessage.ts](../../../lib/stylist/friendlyShoppingMessage.ts), [conversationProtocol.ts](../../../lib/stylist/conversationProtocol.ts), [ConversationChat.tsx](../../../components/stylist/ConversationChat.tsx).

### Contract decisions

Start with optional/defaulted fields so older valid requests remain accepted. Update model transport, domain schema, client parser and reply validation together wherever the change crosses those boundaries. `z.strictObject` requests require explicit additions; a UI-only change cannot safely introduce new request properties. Keep a distinct protocol version if incompatible budget/task semantics are introduced. Deploy server acceptance before a client starts sending a new shape, and keep compatibility during rollback.

### Exit criteria

Size 999 identifies size. An actual shared conflict names the field and values. Unsupported waist-stretch data names waist stretch. The shopper can correct each with one response. A model-plan failure is never mislabelled as absent catalogue data.

## W3 — Make task changes, cancellation and browsing explicit state transitions

**Priority:** P1. **Depends on:** W2. **Primary:** conversation/backend. **Finding:** F2.

### Work

- Add task identity/generation metadata around the existing preference, pending and styling state. Keep those existing objects as the sources of their respective values; avoid maintaining a second independent copy of the full brief.
- Distinguish continuing a task, modifying it, replacing it, answering a product question, cancelling a pending change and resetting the chat. Validate transitions server-side using the customer's current evidence.
- A task replacement clears its pending shopping question, pending answer continuation, reference candidates, obsolete item constraints, collection checkpoint and superseded outfit request. Retain explicitly global preferences and saved look pieces unless the customer changes them. “Forget trousers, show skirts” is a task replacement; “Are these in stock?” is an answer-only turn.
- Track unresolved requirements with stable identity, subject, scope and origin. Accept group removals such as “drop the fabric, waist and length checks.” A restriction should not survive on an unrelated item merely because it is stored as an unstructured sentence. Only explicit all-item language creates a shared restriction. Treat legacy constraints with unknown origin conservatively and explain any necessary choice.
- Make pending changes transactional. Extend the current `before_scopes` rollback semantics to other task fields the pending operation actually changes. Cancellation restores the pre-change task, including its outfit request and unresolved requirements. It must not undo independent, committed Save to look actions or touch the cart.
- Preserve a rejected proposed brief separately from accepted preferences. A correction can complete that draft without accidentally applying unverified filters or losing the customer's safe, stated budget. Explain which part is still pending.
- Detect repeated blocker signatures for the same task and offer targeted recovery after the second repeat. Do not repeatedly ask the same question after the customer has supplied an answer.
- Add provisional browsing as an explicit permission-bearing transition. Retain the unknown requirement; apply all verifiable constraints; exclude known violations; label unknowns per card. Extend alternative/reply validation for this specific mode rather than allowing general relaxation. With no permission, the hard unknown remains blocking.

**Main files:** [conversationPlan.ts](../../../lib/stylist/conversationPlan.ts), [conversationTurn.ts](../../../lib/stylist/conversationTurn.ts), [conversationProtocol.ts](../../../lib/stylist/conversationProtocol.ts), [conversationChanges.ts](../../../lib/stylist/conversationChanges.ts), [preferenceScope.ts](../../../lib/stylist/preferenceScope.ts), [collectionPreference.ts](../../../lib/stylist/collectionPreference.ts), [conversationModelPlan.ts](../../../lib/ai/conversationModelPlan.ts), [interpretConversation.ts](../../../lib/ai/interpretConversation.ts).

### Exit criteria

S2 reaches the valid dress-only search without New chat. S1's explicit group relaxation removes exactly those constraints. Reapplying no polyester works. An unrelated question leaves requirements intact. Cancelling a failed outfit change restores a consistent prior task. Repeated clarification produces a specific escape route. Provisional cards never claim to satisfy the retained unknown requirement.

## W4 — Resolve compound references and normalize everyday garment language

**Priority:** P1. **Depends on:** W2 and W3. **Primary:** conversation/backend. **Findings:** F3, F4.

### Work

- Resolve identity against a stable displayed-result snapshot: explicit full name or ID, explicit ordinal in that snapshot, then a unique role such as “the jacket.” Use existing role matching. A conflicting number and name asks which one the shopper means; a role matching two jackets remains ambiguous.
- Store the candidate IDs and result-set identity with the clarification. Separate the reference phrase from remaining edits so “Number 3, the Beige Cropped Jacket, under $120 and no beige” selects the product and applies all edits in one turn.
- Route clear new searches away from an old reference question. Do not force a shopper to identify a prior product to browse a different category.
- Introduce a small, centrally reviewed catalogue-family/alias mapping shared by interpretation grounding and retrieval. Cover jackets, shirts, trousers/bottoms and common fit/size spellings. Reuse family predicates consistently in preference validation, `relatedLabel` matching, retrieval and reply-contract checks.
- Map “both collections” to no gender restriction unless an explicit shared restriction requires a choice. Map “medium” to the actual M vocabulary where equivalent. Preserve numeric size systems and garment categories; do not convert AU 12 into an unverified measurement or shoe size.
- Treat broad jacket/shirt requests as supported unions of relevant catalogue types. Preserve qualifiers such as cropped, wide leg and regular fit as their own constraints. Use W0 traces to identify the actual failures before adding aliases; do not add rules for strings that were never responsible.

**Main files:** [productReference.ts](../../../lib/stylist/productReference.ts), [conversationTurn.ts](../../../lib/stylist/conversationTurn.ts), [conversationGrounding.ts](../../../lib/stylist/conversationGrounding.ts), [validatePreferences.ts](../../../lib/ai/validatePreferences.ts), [preferenceSearch.ts](../../../lib/search/preferenceSearch.ts), [preferenceValues.ts](../../../lib/catalogue/preferenceValues.ts), [conversationProtocol.ts](../../../lib/stylist/conversationProtocol.ts).

### Exit criteria

S3's compound answer resolves P1241 and keeps both exclusions and the A$120 cap. A second jacket creates a real ambiguity. A fresh jackets or medium/regular/work-shirt brief reaches retrieval or a named no-match/unsupported constraint. Changing from dresses to shoes does not carry the dress size across categories.

## W5 — Unify purchase totals and saved-look continuation

**Priority:** P1. **Depends on:** W3 and W4. **Primary:** conversation/backend and frontend. **Finding:** F5.

### Work

- Reuse `OutfitPieceSchema.ownership`: selected pieces are planned purchases and owned pieces are styling anchors. Add explicit membership in the active budgeted purchase set where needed so an unrelated saved garment is not charged to every future request.
- Centralize a purchase-budget calculation in integer cents. Re-read catalogue prices for participating selected items. Calculate the remaining allowance before retrieving a new component. If price or availability cannot be verified, explain that issue and refrain from claiming a verified complete total.
- For S2, the selected A$155 dress participates in the A$280 purchase set, leaving A$125 for shoes. For an already-owned dress, count zero new spend. For a changed dress price, recalculate and explain the changed allowance. Replacing a selected garment subtracts the replaced purchase once.
- Separate styling-only `anchor_product_ids` from purchases already fixed in the budget. Current outfit request/budget schemas require at least two new components and treat anchors as zero-cost styling references. Introduce a compatible budget-summary contract for one remaining component plus fixed purchases instead of forcing the saved dress into an owned anchor or duplicating it as a new result.
- Keep component-specific colour, size and fit requirements local. Preserve explicit shared restrictions. A total of A$280 is not a per-item maximum of A$280.
- Reuse grouped-search feasibility and maximum-combination checks. The fixed-purchase sum plus the maximum price from each remaining group must stay within the total. Update reply validation and the look summary from the same calculation.
- Distinguish an impossible total from unavailable component stock, missing facts and unsupported vocabulary. A no-match explanation should name the limiting component and retain the budget. Practical venue guidance such as grass does not become a guarantee of comfort or traction.

**Main files:** [commerceSchema.ts](../../../lib/stylist/commerceSchema.ts), [outfitBudgetSchema.ts](../../../lib/stylist/outfitBudgetSchema.ts), [outfitBudgetSearch.ts](../../../lib/search/outfitBudgetSearch.ts), [conversationSearch.ts](../../../lib/stylist/conversationSearch.ts), [outfitReview.ts](../../../lib/stylist/outfitReview.ts), [conversationProtocol.ts](../../../lib/stylist/conversationProtocol.ts), [OutfitSummary.tsx](../../../components/stylist/OutfitSummary.tsx), [outfitPresentation.ts](../../../lib/stylist/outfitPresentation.ts).

### Exit criteria

The saved-dress search returns eligible shoes at no more than A$125 and a verified total at no more than A$280, or a precise blocker. Selected versus owned, unrelated saved pieces, changed prices, removal, replacement and an already-over-budget set all produce correct totals. Every displayed grouped combination remains affordable. Saving a piece stays separate from adding it to the cart.

## W6 — Make discovery responsive and product answers complete

**Priority:** P2. **Depends on:** W2–W4; integrate budget-aware answers after W5. **Primary:** conversation/backend, frontend and content. **Findings:** F8 and the conversation portion of F9.

### Work

- Merge all volunteered facts before choosing a discovery question. “Both collections, ordinary weekend, show ideas” resolves collection and routine together. Do not infer a required purchase occasion, budget or size from navigation alone.
- Record answered discovery topics as well as asked/skipped topics. Keep “show me ideas” available and non-blocking. Preserve reactions and dislikes through refinement without promoting an item-specific dislike to a permanent global exclusion.
- Turn multi-part questions into explicit requested answer slots. Material, waist stretch, length, sizes, availability, care and policy each receive a supported answer or a specific unknown. A missing topic must not disappear because another topic was answerable.
- Assemble those answers from the existing catalogue and policy sources. Deduplicate repeated facts, especially measurements. Preserve the correctly demonstrated distinction between a recorded fit label and a fit guarantee, and between a returns window and exchange eligibility.
- Attach provenance to claims: catalogue label, reviewed feature, synthetic prototype specification or unknown. Reuse current specification metadata and verified-feature records. Label synthetic measurements and care information next to the affected claims; do not present generated specifications as manufacturer-verified instructions.
- Explain adversarial/unsupported administrative requests briefly and return to useful shopping help. Maintain the observed refusal to invent secrets, prices, products, policy entitlements or fit guarantees. A mixed request can still execute its legitimate shopping portion when the intent and constraints are verifiable.

**Main files:** [discovery.ts](../../../lib/stylist/discovery.ts), [collectionPreference.ts](../../../lib/stylist/collectionPreference.ts), [answerPlan.ts](../../../lib/stylist/answerPlan.ts), [conversationAnswers.ts](../../../lib/stylist/conversationAnswers.ts), [productSpecifications.ts](../../../lib/stylist/productSpecifications.ts), [conversationGrounding.ts](../../../lib/stylist/conversationGrounding.ts), [ConversationChat.tsx](../../../components/stylist/ConversationChat.tsx).

### Exit criteria

S3 does not repeat the weekend question. A request for three product details receives three explicit responses with no duplicate length sentence. Synthetic facts have visible provenance. Gift shopping allows browsing without guessing the recipient's size. Unpublished exchange terms remain unknown, and all five adversarial attempts from S4 still fail to corrupt facts.

## W7 — Repair image coverage and use image health in inspiration

**Priority:** P2 product/content workstream. **Depends on:** W0; integrate discovery ranking with W6. **Primary:** catalogue/content and frontend. **Finding:** visual portion of F9.

### Work

- Reuse [audit-missing-product-images.mjs](../../../scripts/audit-missing-product-images.mjs) to inventory missing keys, wrong bucket paths, absent objects and empty objects. Extend it to distinguish valid local image files from storage objects. Record coverage over a defined catalogue snapshot.
- Check actual browser image load/decode success through the existing product-authorized image route. An `image_key` or successful redirect alone does not prove the photo renders. Classify transient storage errors separately from permanently missing assets.
- Correct exact SKU-to-photo mappings using real matching product assets. Some missing photography requires a catalogue/content owner; application code cannot create truthful product photos from missing source assets. Keep a list of unresolved SKUs and whether matching assets exist.
- Expose a bounded health signal for discovery ranking. Among otherwise eligible, suitable products, prefer working photos while retaining diversity. Never select an off-budget or excluded product just because it has an image. Do not issue a storage probe for every product on each chat turn; use an audited/cacheable signal with a refresh policy, initially refreshed for each evaluation snapshot and after asset corrections.
- Retain the placeholder and useful type/shape text when suitable products lack photos. Explain the limitation once. Avoid implying that the stylist has visually compared missing images.
- Preserve RLS-authorized image resolution and stable product image URLs. Keep storage credentials and expiring signatures out of persisted product/client state.

**Main files:** [catalogueImages.ts](../../../lib/stylist/catalogueImages.ts), [product image route](../../../app/api/products/[productId]/image/route.ts), [discovery.ts](../../../lib/stylist/discovery.ts), [ShoppingProductResults.tsx](../../../components/stylist/ShoppingProductResults.tsx), [product-image.ts](../../../lib/product-image.ts).

### Exit criteria

Where enough suitable photo-backed stock exists, the initial discovery set uses working matching photos. Sparse or missing imagery is honestly explained without weakening shopping constraints. Saved evidence reports unique SKU coverage and displayed-card coverage separately; the original 14/19 appearances are not treated as catalogue-wide coverage.

## W8 — Validate the complete behavior and release in stages

**Priority:** release gate. **Depends on:** W1–W7. **Primary:** QA with conversation/backend and frontend.

### Layer 1: deterministic contracts and state transitions

Extend the existing suites for the behaviors affected: plan recovery, conversation foundation, answer handling, product references, preference validation, collection/discovery, shopping presentation, saved outfit review, shared budgets and product specifications. Add focused cases to those suites instead of creating a second overlapping framework.

Use a small controlled catalogue with feasible options, absent stock, unknown facts, ambiguous references and known conflicting attributes. Assert final state and result invariants, not an exact friendly sentence. Include stale recovery controls, cancelling a partially proposed task, answer-only turns, size-category switches and old request shapes. Add a focused suite only where the existing tests cannot express the new task/budget transition.

### Layer 2: real endpoint and browser integration

Run the app's actual conversation endpoint with the configured model and a documented catalogue snapshot. Verify request/reply compatibility and capture stage traces for any failure. In the browser, check visible issue wording, recovery buttons, old-card control state, saved look totals, size selection, images, focus and keyboard behavior on narrow and wide viewports. Cover loading, cancellation and retry; telemetry failure must not block the shopper.

Use the bundled Next.js documentation before implementation changes, as required by AGENTS.md. Current guidance includes [route handlers](../../../node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md) and [browser testing](../../../node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md). Use the existing browser-control workflow where sufficient; adding a test framework is not a prerequisite for the repairs.

### Layer 3: another improvised customer evaluation

Use the five original personas as coverage, not a fixed script. Start with one fresh conversation per persona, each with at most 10 customer messages. Read every reply before deciding the next message. Include changes of mind, frustration, terse replies, a polite shopper, conflicting instructions, mixed valid/invalid requests and unknown sizing. Repeat an affected persona with new wording when a failure, code change or unresolved nondeterministic behavior justifies it; use up to three independent diagnostic variants, each with the same message cap. Keep every transcript and record UI resets explicitly. Deterministic transcript replay remains a separate result from fresh model behavior.

### Release gates

- **All nine findings have evidence:** implemented or explicitly blocked by a named external asset/data requirement, with the remaining user impact documented. Full remediation is not declared while that requirement is unresolved.
- **No invariant violations:** returned eligible products respect active hard constraints; unknowns and alternatives are labelled; no fabricated product facts, policy promises, fit guarantees or cart actions.
- **Conversation recovery:** all observed loop seeds either retrieve, give a precise stock/data blocker or ask a specific unresolved question. None require New chat merely to replace the task. No materially identical clarification persists after a complete answer to that clarification.
- **Reference and discovery behavior:** unique references resolve with accompanying edits; real ambiguities are retained; volunteered collection/weekend details are not asked again.
- **Budget correctness:** selected versus owned prices, one remaining component, price changes and every displayed combination pass the budget invariants.
- **Truthful UI and answers:** size wording, event relevance, answer completeness and provenance match their evidence. The adversarial checks remain grounded.
- **Engineering checks:** affected suites pass, then `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run build` pass against the implementation baseline. Live/browser results are reported separately. No new unexplained baseline failure is accepted as an implementation success.

### Rollout and rollback

Release truthful copy/render changes first. Introduce compatible issue fields and server acceptance next, followed by client controls and task transitions. Gate task/budget behavior behind a small server-controlled feature flag during integration; do not fork the whole stylist into two permanent implementations. Enable it in staging/local verification, complete the release gates, then enable it for the intended release audience.

If production traffic is available, compare task recovery, named-blocker frequency, interpretation rejection, task reset usage, budget validation and response timing for comparable requests. Record the model/configuration and catalogue version so changes can be interpreted. Baseline latency is not yet measured, so establish it in W0 before setting a performance threshold. Added diagnostics and image health must not add per-product network work to each chat turn.

Roll back the new behavior flag or the affected review bundle if hard constraints, budget validation, cart separation or task continuity regress. Retain server compatibility with the client shape already released; prevent a rollback from making in-flight requests unparsable. Keep diagnostics available to explain the failure. Schema/data migrations are unnecessary for the initial logger/copy fixes; if persistent health or provenance data needs a migration later, use an additive, separately reviewed change.

## Coverage of every evaluation finding

- **F1, vague blockers:** W0 diagnoses; W2 preserves and renders typed issues; W3 supplies usable recovery.
- **F2, stuck task state:** W3 handles replacement, cancellation, requirement scope and provisional browsing.
- **F3, compound references:** W4 resolves identity plus edits; W3 prevents stale pending tasks from intercepting a new search.
- **F4, ordinary garment vocabulary:** W0 distinguishes the cause; W4 aligns family matching across interpretation, search and reply validation.
- **F5, saved-look budgets:** W5 centralizes active purchase accounting and supports one remaining component.
- **F6, size-stock wording:** W1 fixes the card; W6 keeps answer claims consistent.
- **F7, event relevance:** W1 gates guidance and preserves actual event context; W6 avoids redundant discovery.
- **F8, incomplete answers/provenance:** W6 covers every subquestion and labels evidence sources.
- **F9, inspiration and photos:** W6 uses volunteered preferences and reactions; W7 fixes and measures image health.

W8 verifies that the combined changes work as a customer experience. The original [report](report.md), [transcripts](transcripts.md), [raw captures](evidence.json) and [source hashes](environment.json) remain the baseline evidence.

## First implementation slice

Begin with baseline capture and tracing of the four diagnostic inputs, then ship the truthful size wording and conditional event picker. Next complete the structured issue contract before changing pending-task semantics. This gives the larger state and budget repairs a measurable cause, a compatible contract and a concrete customer-facing recovery behavior.
