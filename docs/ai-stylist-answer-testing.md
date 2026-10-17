# Testing the stylist's shopping answers

Run the development app and open **AI Stylist**. Send each numbered prompt as a
separate message in the same chat. Product names and results depend on the live
catalogue. Use **New chat** between the separate scenarios below.

For complete customer journeys, use the [customer scenario test pack](ai-stylist-customer-scenarios.md):
direct shopping, guided shopping, open-ended discovery and matching owned items.

## Explain a recommendation and retain the product

1. `Show me dresses under $150`
2. `Why would you recommend the second dress for a beach wedding?`
3. `What is it made of?`
4. `Can this arrive by Friday?`
5. `Find a bag to match it`

Expected: the explanation identifies the second displayed dress, uses its
recorded occasion and attributes, and discloses an occasion mismatch if present.
The question about material refers to that same dress and acknowledges missing
data. Friday delivery receives a specific limitation answer, without a promised
date. The bag request still refers to the discussed dress. Product questions
do not change the original budget or rerun the dress search. A matching bag
depends on available catalogue products and pairing rules.

## Compare products

1. `Show me dresses under $150`
2. `Compare the first and second dresses: price, material and fit.`

Expected: both products are named; prices and differences come from their
catalogue records. Missing material or fit is acknowledged. Higher price is not
presented as proof of higher quality. The original cards stay available.

## Check whether unsupported claims are handled honestly

After a dress search, try these independently:

- `Will the first dress fit me? What sizes are available?`
- `Is the first dress breathable and comfortable? Can I machine wash it?`
- `Does the first dress have pockets?`
- `Is the first dress in stock?`
- `Can I return this? Is return postage free?`
- `Do you accept PayPal?`

Expected: recorded sizes, fit and availability can be reported. The assistant
does not invent measurements, care instructions, comfort, pockets, payment
methods, free returns or stock reservations. Returns use the existing product-page
copy: 30 days after delivery; other conditions are unknown. This change does
not introduce a new merchant policy.

## Resolve ambiguity and keep both parts of a request

1. `Show me dresses under $150`
2. `Why this dress, and show me a cheaper option?`
3. `The first dress`

Expected: with several dresses and no focused item, the assistant asks which
one. Once clarified, it explains that dress and searches below its recorded
price while keeping the saved restrictions. If nothing qualifies, it explains
that instead of changing the budget or repeating the reference product.

## Keep an unfinished shopping request

1. `Show me dresses under $150`
2. `Find a bag to match one of these dresses`
3. `Can this arrive by Friday?`
4. `The second dress`

Expected: the delivery answer preserves the outstanding “which dress?” question.
The final short reply resumes the bag request.

## Automated checks

Offline regression:

```sh
node scripts/run-regression.mjs
```

Live model and catalogue checks (requires the configured local development
server and credentials; makes model calls):

```sh
node --import tsx scripts/test-conversation-answers-live.mjs http://localhost:3000
```

The live script saves request/response evidence under `docs/test-evidence/`.
`LIVE_SCENARIO` optionally filters scenario names with a regular expression.

## Current boundaries

Answers use typed intents and deterministic text assembled from fresh catalogue
records, rather than allowing the model to invent product claims. Product
questions fetch the referenced records by ID; policy-only questions do not
search the catalogue. Answers link to product details and the shared delivery
and returns copy when a product is in context.

There is no carrier integration, delivery estimate service, garment measurement
source or complete merchant-policy database. The customer conversation endpoint
works in development and production; server-side model and catalogue credentials
are still required for live requests.
