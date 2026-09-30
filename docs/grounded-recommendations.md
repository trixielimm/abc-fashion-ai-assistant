# Grounded recommendation wording

The live stylist flow is `/api/extraction` followed by `/api/stylist-search`. Search applies catalogue constraints and returns at most four real products. Only then does `generateRecommendation()` call OpenAI.

The second OpenAI call receives structured preferences and **only the returned shortlist**, with approved evidence phrases for each product. The prompt asks for one product ID and evidence code per item. The server validates every ID and code against that product's evidence and renders the message from catalogue facts. The model cannot supply a new product, price, size or attribute in the user-facing text. The route returns the existing search message if generation fails, while keeping the real product shortlist.

`occasion` and `style` are stated as matches only when their catalogue labels equal the requested values. Budget and size claims likewise require a checked price or available-size label. Unmatched or missing attributes are never presented as matches.

This covers a single request; conversation state and full outfit suggestions are future work. The separate development-only `/api/recommendations` route still uses its own deterministic explanations.

Run the grounding tests:

```bash
node --conditions=react-server --import tsx scripts/test-grounded-recommendation.ts
```

For a live check, start `npm run dev` and POST a complete `ShoppingPreferences` object to `/api/stylist-search`. A successful match response includes catalogue product cards and a message that names only products from those cards.
