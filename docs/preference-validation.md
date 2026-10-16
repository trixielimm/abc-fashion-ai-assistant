# Preference validation contract

POST `/api/extraction` accepts `{ "message": "..." }` and returns:

- `preferences`: the full ShoppingPreferences object, with recognised strings canonicalised and duplicate colours removed. Unsupported values remain intact.
- `issues`: entries with `field`, `value`, `code`, `reason` and `blocking`.
- `needs_clarification`: true if any issue blocks retrieval.

Retrieval must stop when `needs_clarification` is true. Do not drop unsupported hard constraints to produce matches. For non-blocking issues, do not use that field/value in an exact database filter; preserve it for later clarification or ranking decisions. No semantic aliases are applied automatically: Casual is not rewritten to Relaxed or moved from style to occasion.

Category relationships and size labels come from Supabase reference tables. Other vocabulary comes from the public product_catalog view, subject to RLS, so an unsupported value means unrecognised in the currently visible catalogue, not necessarily absent from all database rows. Reads are paginated. An unavailable/empty vocabulary causes a generic HTTP 500 rather than silently reporting validation success. This checks vocabulary, not stock or whether all preferences jointly match a product.

Checks include category/subcategory compatibility and minimum price not exceeding maximum price. Existing Zod enums already enforce canonical gender, category and brand-line spelling before this step.

Run local tests:

```bash
node --import tsx scripts/test-preference-validation.ts
```

Run read-only live catalogue checks:

```bash
node --env-file=.env.local --conditions=react-server --import tsx scripts/test-preference-validation.ts --live
```
