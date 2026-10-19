# Ask for the clothing collection first

19 October 2026. Implementation plan based on the current local working tree. Application code has not been changed for this plan.

## Intended behaviour

When a shopper requests clothing without identifying a collection, ask which collection they want before recommending products. Prioritise new shoppers and broad requests such as “I don't know what I want, can you show me some formal clothes”. Ask about the products they want to browse, without asking about or guessing their personal gender.

Example:

> **Shopper:** I dont know what I want, can you show me some formal clothes
>
> **Assistant:** Sure. Would you like men's clothing, women's clothing, or both?
>
> **Choices:** Men's · Women's · Both / no preference
>
> **Shopper:** Men's
>
> **Assistant:** Continue with formal clothing from the men's collection, including eligible Unisex products under the existing search rules.

The last line describes the intended search behaviour; final customer copy depends on the products actually available. The collection question shows no product cards. Retain “formal”, Clothing, and any other stated constraints while awaiting the answer. Do not ask everyday versus occasion when the shopper has already supplied a formal direction. Choosing a collection is enough to browse; budget and size remain optional.

## Current implementation

- `lib/ai/preferenceSchema.ts` already supports `gender: Men | Women | Unisex | null`.
- `lib/search/preferenceSearch.ts` filters a specified collection and includes Unisex products for Men or Women. With `gender=null`, collection is unrestricted.
- `lib/stylist/discovery.ts` currently starts with direction, routine or occasion questions. It remembers asked/skipped questions and caps discovery at two questions, but has no collection checkpoint.
- Naming an item/category can advance discovery straight to browsing. The new checkpoint must also cover initial clothing searches, so “formal clothes” cannot bypass it simply by setting category=Clothing.
- `lib/ai/interpretConversation.ts` already prohibits inferring gender from uncertainty or an occasion, but does not require asking which collection to browse.
- `ConversationChat.tsx` already renders suggested reply buttons. Those buttons are disabled while a blocking `pending` clarification exists, so the collection checkpoint must use a compatible reply/state flow.

## Decision rules

1. **Apply the checkpoint to clothing shopping intent.** Initial clothing searches and open-ended clothing discovery need a resolved collection before recommendations. Greetings, policy questions and factual product questions do not trigger it. Existing product-specific actions and active outfit workflows retain their relevant product/request context.
2. **Use explicit information first.** “Men's formal clothes”, “women's workwear”, a previously confirmed collection, or an explicit Unisex request proceeds without this question. An item name can identify the category, but does not by itself establish the shopper's collection preference.
3. **Ask once when unresolved.** Show one collection question and three choices: Men's, Women's, Both / no preference. Accept equivalent typed answers and apostrophe variations. Do not infer a collection from names, sizes, colour, pronouns or occasion. Viewing a product alone does not confirm a session collection preference.
4. **Make unrestricted browsing explicit.** Both means search across eligible collections. Unisex means the catalogue's Unisex collection only. Do not encode Both as `gender=Unisex`.
5. **Allow an easy skip.** In response to this question, “either”, “both”, “no preference”, “skip” or “just show me ideas” resolves the checkpoint as unrestricted browsing. Repeated uncertainty should offer an easy way forward without selecting Men or Women on the shopper's behalf. The checkpoint must not trap the conversation in a loop.
6. **Resume the saved request.** A short answer such as “women's” changes the collection and continues the original formal-clothing search. A compound answer such as “women's, under $150, no red” also applies the new explicit constraints. It must not replace the original request with an empty search.
7. **Remember the choice for this browsing session.** Preserve it across subsequent clothing categories and history truncation. An explicit new request can override it, including shopping for somebody else. Keep the existing shared/item restriction conflict rules; do not silently relax a shared restriction. Resetting the chat clears the choice.

## Implementation sequence

### 1. Represent collection resolution and the suspended request

Extend the session/request/reply schemas with the small amount of state needed to distinguish an unresolved collection from an explicitly unrestricted choice. Both currently appear as `gender=null`, so checking that field alone is insufficient.

Keep `gender` as the actual catalogue filter; no new value is needed in the product preference enum. Remember the effective collection choice and the original action/brief needed to resume. Define one consistent precedence rule for explicit current-request collection, saved browsing default, and shared restrictions. Do not copy size, colour or budget into shared scope as a side effect.

Primary files: `lib/stylist/conversationProtocol.ts`, `lib/stylist/conversationPlan.ts`, and `lib/stylist/discovery.ts`. Follow the existing request/session storage contract, including older sessions with no new field. Review `conversationStore.ts` for state signing, retries and replay compatibility.

### 2. Add the checkpoint before product retrieval

After grounding and applying explicit changes, resolve whether the collection is known. If an eligible clothing/discovery request is unresolved, return the collection question and no products before search executes. This check must apply to both model-generated plans and deterministic shortcuts, including plans that already identify Clothing or a subcategory.

Use the existing `no_action` plus suggested replies pattern with explicit checkpoint/resume metadata, keeping it distinct from blocking `pending` shopping clarifications. Preserve unrelated pending requests and existing restrictions. Count the collection question toward the discovery question limit, and let already stated details satisfy later questions. Once “formal” and collection are known, browse immediately.

Primary files: `lib/stylist/conversationPlan.ts`, `lib/stylist/conversationTurn.ts`, `lib/stylist/conversationSearch.ts`, and `lib/stylist/discovery.ts`.

### 3. Align AI interpretation, grounding and exact answers

Update the interpreter instructions to prioritise collection resolution for unresolved clothing requests, preserve the full brief, and never guess a collection. Teach the model that a collection answer resumes the saved request and that Both differs from Unisex. A quoted phrase such as “formal clothes” must not be accepted as evidence for an inferred Men or Women change.

Add deterministic handling for the exact button messages when the collection checkpoint is active. Send compound answers through the interpreter so additional requirements are retained. Ensure resumed changes obey the existing quotation/evidence rules rather than copying old evidence into the latest turn. Review the current rule requiring explicit global wording before writing shared preferences; a session browsing choice must have a defined, compatible scope.

Primary files: `lib/ai/interpretConversation.ts`, `lib/stylist/conversationGrounding.ts`, `lib/stylist/conversationTurn.ts`, and, only if needed, `lib/ai/conversationModelPlan.ts`.

### 4. Reuse the chat controls

Render the question and three existing suggested reply buttons. Verify they remain clickable during this checkpoint, support keyboard interaction, and submit complete answer messages. Keep collection decisions in server-validated state rather than deriving them from visible transcript text.

Primary file: `components/stylist/ConversationChat.tsx`; presentation/schema wiring may also touch `lib/stylist/shoppingPresentation.ts` and `lib/stylist/conversationProtocol.ts`. A new modal or settings screen is unnecessary.

## Acceptance checks

- The exact example request asks collection first, returns zero products, and saves formal clothing intent.
- Men's and Women's answers resume the same request with the corresponding collection filter and existing eligible Unisex inclusion.
- An explicit Unisex request restricts to Unisex; Both retains unrestricted collection eligibility and never repeats the question.
- “Men's formal clothes” and “women's formal clothes” skip the collection question.
- “I don't know what I want” asks collection before optional direction questions; a later formal answer does not cause redundant occasion questions.
- A specific clothing category without a collection cannot accidentally bypass the checkpoint.
- Compound initial requests and answers retain budgets, exclusions, sizes and supported feature requirements.
- A confirmed collection survives a new clothing category, history truncation, retries and the normal session lifecycle; explicit switching and chat reset work.
- Product answers, greetings, cart actions and existing outfit workflows do not acquire an unrelated onboarding question.
- A model plan that omits the checkpoint cannot return clothing recommendations; a plan that guesses gender from “formal” is rejected or corrected before retrieval.
- Existing discovery regressions are updated for collection-first ordering, including the question limit, skipping and the difference between unknown and unrestricted browsing.

Add focused offline cases to `scripts/test-guided-discovery.mjs` and the relevant conversation/protocol tests. Add a customer scenario using the exact example, plus Men's, Women's and Both continuations. After implementation, run the relevant regressions, lint and a production build; inspect the three-choice interaction in the browser. This planning task did not run application tests.

Before writing application code, read the relevant installed Next.js guides under `node_modules/next/dist/docs/`, as required by this repository's `AGENTS.md`.
