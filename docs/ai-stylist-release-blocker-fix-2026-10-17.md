# AI stylist release-blocker fix report

Date: 17 October 2026. Scope: the current working tree and a local production build.

## Outcome

The customer chat endpoint now works in production mode. The previously reported
legacy-chat import errors and recommendation-writer type errors are also resolved
in the current working tree. All checks below passed. No deployment was performed.

## What caused the production failure

`ConversationChat.tsx` sends customer messages to `/api/conversation-search`.
That route began by returning HTTP 404 whenever `NODE_ENV` was not `development`,
before validating or processing any message. A correctly configured production
server therefore rejected the same requests that worked in development.

I reproduced this with the actual route under `NODE_ENV=production`: a valid
cancellation request returned 404 instead of the expected 200. The before-fix
assertion is saved in [the baseline evidence](test-evidence/release-blockers-before-2026-10-17.txt).

## What changed in this request

- Removed the development-only guard from the customer conversation route.
- Kept its origin checks, JSON/schema validation, 64 KB body limit, no-store
  responses and retry handling.
- Added `scripts/test-conversation-production.mjs`, which exercises the actual
  handler in production mode. It also supports checking a running local server
  over HTTP. Its 11 checks cover successful requests, the UI envelope, same-origin
  requests, cancellation state, rejected origins, malformed JSON, invalid input,
  unsupported content types, oversized bodies and expired retries.
- Added that suite to `scripts/run-regression.mjs` with production mode and the
  server module condition explicitly configured.
- Updated the answer-testing guide to remove its outdated development-only note.

The separate diagnostic/prototype endpoints retain their existing restrictions.
The active conversation endpoint executes its shopping operations directly; it
never needs to call those restricted endpoints.

## Status of the reported import and type errors

These fixes were already present when this request began; no additional changes
were necessary in these files:

- `components/stylist/StylistChat.tsx` imports `ProductImage` from the commerce
  component and `getProductImageSrc` from `lib/product-image`.
- `lib/search/preferenceSearch.ts` includes optional nullable `occasion` and
  `style` fields on `StylistProduct`, and copies both from catalogue records.
  The recommendation writer can read those fields without a type mismatch.
- The grounded-recommendation test covers occasion/style evidence selection.

I verified these fixes with repository-wide lint, TypeScript and the production
build rather than making duplicate edits.

## Verification

- `npm run lint`: passed across the repository.
- `npx tsc --noEmit --incremental false`: passed after the production build completed.
- `node scripts/run-regression.mjs`: 24/24 offline suites passed, including 11
  production-handler checks with network access disabled.
- The same 11 production-route checks passed over HTTP against `next start` on
  `127.0.0.1:3102`.
- `npm run build -- --webpack`: passed compilation, Next.js TypeScript checks,
  static generation and build tracing.
- 23/23 live requests passed against that built production app using the real
  configured model and catalogue. These covered search, explanations, delivery
  and returns questions, comparisons, missing product data, matching bags,
  mixed explanation/cheaper requests and clarification continuations.

Evidence:

- [Offline regression](test-evidence/regression-2026-10-17T01-36-47-048Z.txt)
- [Production HTTP checks](test-evidence/release-production-http-2026-10-17.txt)
- [Production build](test-evidence/release-webpack-build-2026-10-17.txt)
- [Live production conversations](test-evidence/answers-live-2026-10-17T01-36-28-703Z.json)

## Build environment limitation

The default Turbopack build was attempted twice, including with local execution
access, but this environment denied its PostCSS worker's attempt to bind a local
port (`Operation not permitted`). The supported Webpack build completed and
produced the app used for the production HTTP and live tests. The default build
command and bundler configuration were not changed to work around this local
restriction. Successful default Turbopack compilation is therefore not claimed.

## Reproduce the production checks

Build, then start the production app:

```sh
npm run build -- --webpack
npm run start -- --hostname 127.0.0.1 --port 3102
```

In another terminal:

```sh
NODE_ENV=production node --import tsx scripts/test-conversation-production.mjs http://127.0.0.1:3102
node --import tsx scripts/test-conversation-answers-live.mjs http://127.0.0.1:3102
```

Live conversation checks require the server's model and catalogue configuration
and make model calls. The offline production checks do not require credentials:

```sh
NODE_ENV=production node --conditions=react-server --import tsx scripts/test-conversation-production.mjs
```
