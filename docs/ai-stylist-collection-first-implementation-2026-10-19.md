# Collection-first clothing discovery

Implemented 19 October 2026 against the existing local working tree.

Policy update later on 19 October: positive dress and skirt requests now use item-level Women defaults, with explicit collections taking precedence. Broad clothing/discovery requests retain collection-first onboarding. See [category defaults implementation](ai-stylist-category-collection-defaults-2026-10-19.md) for precedence, legacy-session recovery and current verification. The original behaviour below records the earlier collection-first implementation.

## Behaviour

An initial clothing request or open-ended discovery without a confirmed collection now asks:

> Sure. Would you like men's clothing, women's clothing, or both?

The existing chat buttons offer Men's, Women's, and Both / no preference. This reply has no products and no blocking `pending` question, so the buttons remain usable. The server preserves the original clothing brief before asking, including formal occasion, budgets, colours, exclusions and supported feature requirements.

A choice resumes that brief. A known collection skips the question. Both means unrestricted collections; Unisex retains its existing specific filter. A selected Men or Women filter retains the search engine's existing inclusion of eligible Unisex products. The choice remains in session state across new searches and history truncation, and New chat clears it.

Exact button messages and common short replies use deterministic handling. Compound replies go through the interpreter while retaining the saved brief. Skipping or repeating uncertainty permits unrestricted browsing without repeating the question. Collection counts toward the two-question discovery limit. A known formal-clothing direction proceeds straight to products after the collection answer.

The server checkpoint covers both model plans and deterministic search shortcuts. Collection changes require explicit collection wording; occasion, size, personal identity and a referenced owned garment cannot establish the requested collection. Shared collection rules need explicit global scope. Product questions, active outfit workflows and product-specific actions retain their existing context rather than acquiring a browsing default unnecessarily.

## Implementation

- `lib/stylist/collectionPreference.ts`: collection choice/checkpoint schemas, interpretation of explicit collection wording, and question/button copy.
- `lib/stylist/discovery.ts`: collection stage and discovery question accounting.
- `lib/stylist/conversationPlan.ts`: server checkpoint, effective browsing filter, collection evidence and scope validation.
- `lib/stylist/conversationGrounding.ts`: preserve the brief when resuming and ground “formal clothes” correctly.
- `lib/stylist/conversationTurn.ts`: deterministic answers, question presentation, cancellation and reply state.
- `lib/stylist/conversationProtocol.ts`: session transport and reply contract validation, with compatibility for earlier sessions lacking collection metadata.
- `lib/ai/interpretConversation.ts`: collection-first interpretation instructions and context.

No database migration, new model output field or new UI control was needed. The existing suggested reply controls render the choices. Unrelated uncommitted work was preserved.

## Verification

- **18 focused offline checks** in `scripts/test-collection-first.mjs`, covering the exact prompt, every choice, compound answers, skipping/repeated uncertainty, persistence, legacy sessions, explicit switching, shared conflicts, product questions, cancellation, changed requests and retry replay.
- **37/37 offline regression scripts passed**, including discovery, search, outfit, product answers, commerce and protocol coverage. Product-oriented fixtures now state the precondition that the shopper already chose all collections; fresh onboarding has dedicated coverage.
- **4/4 live model scenarios passed**, eight turns total, using isolated synthetic catalogue data: Men's, Women's, Both, and Women's plus budget/exclusion. These test actual interpretation and domain execution, not live stock.
- **Browser verification on localhost:3000:** the exact supplied prompt showed the collection question and three enabled buttons with zero product cards. Clicking Women's returned four formal clothing options without asking the shopper to repeat the occasion.
- **Lint passed.**
- **Production build and its TypeScript checks passed with `npx next build --webpack`.** Default Turbopack builds hit this environment's local worker-port restriction (`Operation not permitted`), including the escalated attempt. Webpack completed the full build without changing project configuration.
- `git diff --check` passed.

## Evidence

- [Final offline regression run](test-evidence/regression-2026-10-19T01-35-25-767Z.txt).
- [Live scenario summary](test-evidence/customer-scenarios-2026-10-19T01-33-01-504Z/summary.json), with individual COL-A through COL-D transcripts in the same folder.
- [Browser screenshot of the question](test-evidence/collection-first-question-2026-10-19.jpg).

The production build validates the current working tree, including existing work from before this change. The focused tests and recorded browser flow establish the collection behaviour described here.
