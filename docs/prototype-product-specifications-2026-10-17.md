# Prototype catalogue specifications

Implemented and populated on 17 October 2026 (Australia/Sydney).

## Delivered

All **316 database products** now have stored, internally validated synthetic
specifications: 180 Clothing, 38 Bags, 58 Shoes and 40 Accessories. OpenAI authored
the specifications using the existing identity, material, colour, fit, style,
occasion and season of each product. The generator used the configured
`gpt-5.6-luna` model with Structured Outputs. These are fictional product
definitions for the prototype, not facts discovered about real merchandise.

A 14-product pilot covered all four categories before full generation. The job
used bounded concurrency and retries, saving each product locally so successful
records did not need to be generated again. It rejected category-inappropriate
fields, impossible bag capacities, contradictory care instructions and selected
unsupported performance claims. Seven generated bag capacities were corrected
using a documented conservative authoring rule: 70% of external volume, rounded
down to 0.1 litres. That calculation defines a synthetic specification; it is not
a physical capacity measurement. All final records passed validation.

Specifications include descriptions, construction details, care, lining,
pockets, straps, fastening and documented prototype use cases, plus category
fields such as sample garment length, bag dimensions/capacity/compartments and
shoe heel height/sole material. Inapplicable fields remain null.

## Database and application behaviour

Applied the additive migration
`20261017033000_prototype_product_specifications.sql` and inserted 316 records
into `public.prototype_product_specifications`. Each record carries
`source_kind=synthetic`, a dataset version, generator model/time and an identity
snapshot. Both the import and the runtime reject mismatched/stale product
identities. Public clients can read available products' specifications but
cannot create or edit them. Existing records are not silently overwritten by
the import utility.

The original 316 names, descriptions, materials, prices, stock, availability and
image references were checked against the pre-generation baseline and remain
unchanged. The supplier-verified feature table remains empty and untouched.
Interaction analytics remains disabled.

Product pages render the generated descriptions, details and care. Product
questions, feature requirements and value comparisons use the same stored
specifications. Synthetic benefits are labelled as prototype specifications in
comparison details; actual supplier-verified facts retain precedence in the
feature comparator. A discreet footer identifies the store's products/specs as
sample data. The chat never generates new product specs during a conversation.

The richer data exposed two conversation issues that were fixed: a successful
comparison now retains its original item for short priority follow-ups, and a
request to find a replacement no longer gets blocked by an accidental question
about comparing two already-displayed products. Explicit replacement feature
requirements remain filters on the returned candidates.

## Verification

- **28 offline suites passed**, including 31 commerce checks and 5 specification
  checks. All 316 saved specifications were validated, alongside stale/wrong
  identity rejection, source separation, known/unknown feature handling and
  consistent product-question answers.
- **10 live specification/integration checks passed** against the built
  production app, including complete public coverage, unchanged original data,
  pocket/care questions, feature-based upselling, follow-up continuity,
  zip-closure bag cross-selling and capacity answers.
- The existing **15-step live commerce journey passed** using the populated
  catalogue. **11 production HTTP checks passed**. TypeScript, ESLint and the
  Webpack production build passed.
- Browser verification confirmed the product's details/care and the live
  replacement workflow. Product photographs were not generated or repaired in
  this task; existing unavailable photos still use placeholders.

One measured live example: the A$95 Navy Maxi Dress has no pockets in the
prototype dataset. The stylist offered A$120 replacements with pockets, showed
the A$25 difference and retained the original item through the next priority
reply. This demonstrates the implemented workflow, not real-world fit, styling
accuracy or commercial uplift.

Evidence:
[database coverage/access](test-evidence/prototype-spec-database-verification-2026-10-17.json),
[import result](test-evidence/prototype-spec-import-2026-10-17.json),
[live specification checks](test-evidence/prototype-specs-live-2026-10-17.json),
[live commerce journey](test-evidence/commerce-live-2026-10-17T03-26-58-791Z.json),
[offline regression](test-evidence/regression-2026-10-17T03-28-15-356Z.txt),
[production route checks](test-evidence/prototype-production-http-2026-10-17.txt),
[production build](test-evidence/prototype-production-build-2026-10-17.txt),
[product-page screenshot](test-evidence/prototype-product-specifications-2026-10-17.jpg),
[live comparison screenshot](test-evidence/prototype-stylist-upsell-2026-10-17.jpg).

## Try it

Open `/products/P1178` and expand Details and Material and Care. Then open the
stylist on that page and send these messages one at a time:

1. “Does this dress have pockets?”
2. “How should I wash this dress?”
3. “Compare a replacement with pockets under $150.”
4. “Pockets would be useful.”
5. “Keep Navy Maxi Dress for my outfit.”
6. “Find a bag with a zip closure to go with my kept dress under $100.”
7. “What is the capacity of the first bag?”

## Dataset and maintenance

`docs/data/prototype-specs-v1/` contains the 316 product JSON records, their
checksums, safe generation input, original-data baseline, generation reports and
a dataset manifest. Preserve these files to reproduce the demonstrated version.
Supplier evidence is not required for this synthetic dataset.

Generation and SQL preparation commands:

```bash
node --env-file=.env.local --import tsx scripts/generate-prototype-specs.mjs docs/data/prototype-specs-v1/generation-input.json all
node --import tsx scripts/prepare-prototype-spec-import.mjs docs/data/prototype-specs-v1/generation-input.json docs/data/prototype-specs-v1 /tmp/prototype-specifications.sql
```

The generator reuses valid saved records and refuses stale identities. It does
not change the database. SQL preparation requires every expected product, checks
content hashes and identities, and produces a transaction for review. It refuses
to overwrite conflicting existing specs. A future intentional catalogue revision
needs an archived prior dataset and a reviewed replacement/import strategy.

No hosting deployment was performed. The hosted database is populated; deploying
the branch's application changes is required for an older hosted application to
display and use the new specifications. Local app builds already use them.
