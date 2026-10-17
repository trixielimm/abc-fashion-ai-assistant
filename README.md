This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Install dependencies, then copy `.env.example` to `.env.local`. Set the
server-only `OPENAI_API_KEY` value to enable the AI Stylist's conversation
interpreter. The chat sends each message to `/api/conversation-search` and shows
grounded answers and matching catalogue products.

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

## Stylist tests

Run `npm test` for the offline regression suites and `npm run lint` for lint.
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

Storage photos bypass Next.js image optimization so the browser can follow
fresh storage signatures without caching them in the optimizer. Upload suitably
sized product photos (such as 1200px on the longest side). Local demo photos
still use Next.js optimization. Homepage and related-product lists currently
use demo catalogue data.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
