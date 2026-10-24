# ABC Fashion AI Assistant

A Next.js storefront with catalogue search, a local shopping cart and an AI
stylist grounded in the Supabase product catalogue.

## Getting Started

Install dependencies, then copy `.env.example` to `.env.local`. Set the
server-only `OPENAI_API_KEY` value to enable the AI Stylist's conversation
interpreter. The chat sends each message to `/api/conversation-search` and shows
grounded answers and matching catalogue products.

Run `npm run dev` and open [http://localhost:3000](http://localhost:3000).
Use `npm run build` to check the production build and `npm start` to serve it.

The app is organised into routes and API handlers in `app/`, UI components in
`components/`, and catalogue, search and stylist logic in `lib/`. Maintenance
and regression scripts live in `scripts/`; database changes live in
`supabase/migrations/`.

For 2–4 named pieces, the stylist supports one combined AUD budget. For example,
“a dress and shoes for formal events, 400 AUD for both” shows up to five dresses
and five shoe options, in separate groups. Choosing one item from each group
always fits the shared budget. The response shows the possible total range and
optional questions about style or colour. Missing preferences allow browsing;
they are not guessed or required before showing products. Each piece retains
its own colour and size requirements. Sparse stock produces fewer choices, and
an unaffordable or incomplete set produces an honest no-match result.

Conversation memory carries the last three understood customer prompts and
their replies, plus the current and previous two product result sets. Saved
preferences stay active until explicitly changed or New chat is used. An
unrecognised intention does not evict useful history, erase the product context
or overwrite the current shopping requirements.

The stylist now returns named blockers and task-scoped recovery choices. A
customer can explicitly browse provisional options with unknown requirements
labelled, remove a requirement, or start a new shopping task while retaining
their saved look and shared rules. Selected purchases count toward a combined
budget; already-owned styling references have no new purchase cost. Product
cards distinguish a listed size from confirmed variant stock. Sample garment
measurements and care instructions are labelled as synthetic prototype data.

`STYLIST_TASK_RECOVERY_ENABLED=false` rolls back the new task transitions.
`STYLIST_DIAGNOSTICS_ENABLED=true` enables local stage, issue and timing logs;
raw messages and signed image URLs are excluded from those logs. See the
[implementation and improvised retest report](docs/reports/stylist-remediation-2026-10-19/report.md)
for evidence and remaining limitations.

## Stylist tests

The [everyday and pre-release journey pack](docs/ai-stylist-journey-pack.md)
defines 50 reusable journeys, with a 10-journey everyday subset, three opening
wordings per live journey, expected outcomes, and human review criteria.
With the local app running, use `npm run test:journeys:everyday` or
`npm run test:journeys:prerelease`. These make real model calls and save
transcripts, state checks and a review checklist under
`docs/test-evidence/stylist-journeys/`. Five pre-release recovery cases use
controlled offline faults. `-- --list` lists cases without making requests;
`-- --filter J18,J32 --repeat 5` narrows and repeats a pre-release run.
An automated pass still requires the listed human checks; missing catalogue
prerequisites are reported separately from failures. Pack validation and guide
generation need no credentials: `npm run test:journeys:check` and
`npm run test:journeys:guide`.

Run `npm test` for the offline regression suites, `npm run lint` for lint, and
`npm run typecheck` for TypeScript checks, including unused local code and parameters.
`npm run test:scenarios` runs all 25 customer scenarios three times using the
configured model and an isolated synthetic catalogue. It makes model calls and
saves every transcript, plan, fixture and result under `docs/test-evidence/`.
`SCENARIO_REPEATS=1` and `SCENARIO_FILTER='S4-B'` can narrow a diagnostic run.
The fixture products never change the shared catalogue.
Set `SCENARIO_REPLAY` to a recorded evidence directory to replay saved model
plans through the current turn handling and memory code. Replays execute fresh
replies and state transitions but make no new model calls; report their results
separately from fresh-model runs.

With the local app running, `npm run test:answers:live` exercises the actual
HTTP endpoint and live catalogue. Browser and human styling checks are recorded
separately; an offline or fixture result does not certify visual compatibility.
The shared-budget production probe can be run with
`node --env-file=.env.local --conditions=react-server --import tsx scripts/test-outfit-budget-live.mjs http://127.0.0.1:3002`
when the built app is running on that local port.
See [the fix and retest report](docs/ai-stylist-customer-scenarios-fix-and-retest-2026-10-17.md)
for the latest recorded results and the remaining prototype boundaries.
See [the shared-budget follow-up report](docs/ai-stylist-shared-budget-fix-and-retest-2026-10-17.md)
for the added multi-item cases and their verification.
See [the grouped discovery and memory report](docs/ai-stylist-grouped-discovery-memory-2026-10-17.md)
for the subsequent multiple-choice browsing and memory improvements.

## Product photos

Set the five `S3_*` variables from `.env.example` in `.env.local` using your
Supabase Storage S3 configuration. Keep the access key and secret server-only.
`S3_BUCKET_NAME` must be the actual bucket containing your product photos.

Store the bucket-relative object path in `products.image_key`, for example
`products/ABC001/main.jpg`. Existing public or signed Supabase object URLs are
also supported if they belong to the configured project and bucket; the app
extracts the object path and generates a fresh signature. Local `/images/`
demo photos continue to work.

Search, stylist results, product details and cart items use a stable
`/api/products/[productId]/image` URL. That server route checks catalogue access
through the existing RLS policies, then redirects to an S3 URL valid for five
minutes. It supports public and private buckets without changing bucket
permissions. Temporary signatures are never saved in the cart. Missing or
unavailable photos show the existing product placeholder.

The read-only `scripts/audit-missing-product-images.mjs` audit produces an image
health manifest and a list of missing assets. Discovery prefers photo-backed
eligible options when the audit is current. It never drops a shopping constraint
to obtain a photo. Missing source files still need real product photography;
the audit does not upload files or change storage permissions.

Product photo components request responsive widths through the same authorised
image route. The server returns a resized WebP (or PNG for browsers without
WebP), preserving proportions and transparency. Original downloads and resized
bytes use bounded, short-lived process caches, but every request still checks
current catalogue access. Responses remain `private, no-store`; signed URLs and
private images are never put in Next.js's shared image cache. Direct image URLs
without a width still redirect to a fresh original, and failed or unsupported
transforms also fall back to the original. Local demo photos continue to use
Next.js optimization. The homepage uses live catalogue data. Related
products and cart suggestions retain the demo catalogue in `lib/mock-data.ts`;
`lib/product-detail-mock.ts` supplies the matching demo product pages.
