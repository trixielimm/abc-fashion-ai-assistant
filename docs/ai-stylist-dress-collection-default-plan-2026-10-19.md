# Default dress requests to the women's collection

19 October 2026. Plan only; no application code changed for this request. This revises the earlier collection-first rule for explicitly requested dresses.

Implemented after approval, with the subsequently agreed skirt default as well. Current behaviour and verification are recorded in [the category defaults implementation](ai-stylist-category-collection-defaults-2026-10-19.md).

## Expected experience

For “I want a dress for work under 200 aud”, search Clothing / Dresses from the women's collection, retaining Work and a maximum of A$200. Do not ask which collection to browse. Show eligible results when available, and a truthful no-match response otherwise.

For the reported existing conversation, repeating that complete dress request after an earlier “Men's, please” should apply the women's dress default to the new request. The old ordinary browsing choice must not trap the shopper in repeated men's dress searches.

This is a default for the requested product category, not an inference about the shopper's gender. Explicitly requesting “a men's dress”, “Unisex dresses” or “dresses from both collections” overrides the default. An explicit instruction such as “only show men's clothing throughout this chat” remains a shared restriction: ask a focused question before changing it.

## Why the current conversation fails

- The server's `needsCollection` check in `lib/stylist/conversationPlan.ts` treats Clothing / Dresses like any other unresolved clothing request.
- `explicitCollection()` recognises collection wording, but has no category default.
- Once Men's is chosen, `collection.choice` persists and gets reapplied to ordinary browsing searches.
- Grounding turns repeated same-category requests into `refine`, retaining the previous Men's filter. Repeating the dress request therefore repeats the same search.
- The model instructions and gender-change validator explicitly prohibit using garment type as collection evidence. Updating only the AI prompt would conflict with server validation.

## Collection precedence

Resolve the effective collection for each shopping request in this order:

1. Explicit collection requested for the target item in the latest message: Men, Women, Unisex or All.
2. A supported category default for a newly stated target: **a positive dress/dresses request defaults to Women**.
3. The current item's effective collection for short refinements such as “cheaper”, “under $150” or “show more”.
4. The saved browsing choice when the request has no stronger collection indication.
5. Ask the existing collection question when still unresolved.

Compose the result with shared restrictions before retrieval. A conflict with an explicit shared restriction needs clarification; it cannot silently widen results.

Treat the category default as item scope. Retain the shopper's explicit browsing choice separately: an inferred women's dress search should not silently rewrite Men's into a global Women preference for later generic clothing searches. Remember how the current collection was resolved, so a follow-up retains the effective Women filter rather than reapplying the older Men's session choice.

## Implementation sequence

### 1. Add a central, narrow category-default resolver

In `lib/stylist/collectionPreference.ts`, add a resolver that distinguishes explicit collection, category default, inherited item choice and saved browsing preference. Return the effective choice, source and supporting latest-turn text where relevant.

Initially support only a positive request for the Dresses category, including a tentative request such as “maybe a dress”. Do not extend defaults to shirts, suits, trousers, shoes or other categories without a separate decision.

Identify the requested target rather than matching `dress` anywhere in the message. Exclude “dress shirt”, “dress shoes”, “dress code”, “dress me for work”, negated requests, a dress mentioned only as an owned/matching garment, and factual questions about an existing dress. Use existing grounded category/subcategory information alongside the actual request text. Do not derive the rule from whether men's stock happens to exist.

### 2. Apply precedence before collection prompting and search

Update `lib/stylist/conversationPlan.ts` so a qualified dress request sets item `gender=Women` before composing preferences and deciding whether to ask collection. It must override an ordinary inherited Men's item filter when the latest message newly requests a dress, including a repeated same-category request grounded as `refine`.

Keep explicit latest-turn collection wording authoritative. A bare “Men's, please” answering an existing checkpoint is an explicit choice, so it resumes the saved request as Men. A subsequent full dress request without explicit collection applies the new category default. Short edits to that explicit men's dress search retain Men.

Adjust the gender evidence validator to allow the specific server-approved dress default with actual quoted dress-request evidence. Do not permit arbitrary collection inference from style, occasion, size or identity. Use the same resolver for model plans and deterministic shortcuts so their results cannot diverge.

### 3. Preserve the distinction between browsing preference and current item

Extend state minimally to record the effective item's collection source. Review `collection.choice`, `scopes.item.gender`, `makeTurn()` and `acceptReply()` together. Current item refinements must keep the effective collection; a genuinely new category should use the explicit browsing preference or ask if none is known.

Earlier sessions have no source metadata. Treat their saved `collection.choice` as an ordinary browsing preference, subject to the new positive dress-request default. Existing explicit shared restrictions remain authoritative. New chat clears both browsing and item-resolution metadata. Retry/replay must preserve the resolved decision.

Primary files: `lib/stylist/collectionPreference.ts`, `lib/stylist/conversationPlan.ts`, `lib/stylist/conversationProtocol.ts`, and `lib/stylist/conversationGrounding.ts` where needed for target identification and repeated requests.

### 4. Align the interpreter and user-facing recovery

Revise `lib/ai/interpretConversation.ts` to explain the narrow dress default and precedence, replacing the blanket prohibition on garment-based collection resolution. Keep full request extraction intact: Work, A$200, exclusions and all other stated constraints.

Keep the normal first response concise. If recovering from a previous Men's no-match, a short acknowledgement such as “I'll look in the women's dress collection for this request, keeping work and your A$200 limit” can explain the change. Claim matches only after catalogue validation.

If the shopper explicitly wants men's dresses and none match, respect that request. Explain which collection was searched and offer a concrete opt-in next step such as “Browse women's dresses” or “Browse both collections”, preserving work and the budget. Do not automatically replace a dress with a suit or relax price/availability requirements.

For broad “formal clothes” or “I don't know what I want” requests with no collection indicator, retain the existing collection-first question. No new onboarding screen is needed.

### 5. Update tests and documentation

Add focused coverage to `scripts/test-collection-first.mjs`, update any earlier assertions that every named clothing category must trigger collection, and add a live model scenario for the reported transcript. Update the earlier collection-first implementation documentation to explain this scoped exception.

## Acceptance cases

- Fresh chat: “I want a dress for work under 200 aud” searches Women / Clothing / Dresses / Work / max A$200 immediately, without a collection question.
- Existing ordinary Men's browsing preference plus the same complete request resolves to Women for that item, preserving all other constraints.
- The exact reported sequence is reproduced from a legacy checkpoint state: Men's answer is respected; a later full dress request applies Women and escapes the stale filter.
- “Men's dress for work under 200 aud” keeps Men; Unisex and Both remain distinct explicit choices.
- “Only men's clothing throughout” followed by an unqualified dress request asks whether to change the shared restriction before searching Women.
- “Under $150”, “show more” and “cheaper” retain the effective collection of the current dress request rather than reapplying a different browsing default.
- A women's dress default does not silently become a global Women preference for later generic clothing requests.
- “Dress shirt”, “dress shoes”, “dress code”, “dress me”, “not a dress”, “shoes to match my dress” and pure product questions never trigger the default.
- Broad “show me formal clothes” still asks collection when unresolved.
- No eligible women's work dresses under A$200 yields an honest no-match response; the rule does not guarantee stock or relax constraints.
- Older sessions, history eviction, retry replay and New chat retain their intended behaviour.

Run the focused checks, full offline regression suite, lint, TypeScript/production build, and the new live scenarios. Verify the original request and legacy recovery in the browser. Before application edits, read the relevant installed Next.js guides as required by `AGENTS.md`.
