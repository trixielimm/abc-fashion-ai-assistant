# Image loading performance — 22 October 2026

Product photographs now use responsive, compressed variants through the existing
catalogue-authorised image route. The change preserves product selection, prices,
cart URLs, layout, CSS crops, transparency, aspect ratio and storage permissions.

## Delivery changes

- Product cards, search results, galleries, cart images, footer previews and stylist
  cards request a supported width instead of downloading the full original.
- The server returns WebP at quality 85, with PNG for clients without WebP. It does
  not enlarge small originals. Unsupported formats and failed transforms retain
  the existing original-image redirect.
- Original downloads and derived files have separate process-local caches with a
  combined 64 MiB byte budget and 60-second lifetimes. Concurrent requests for the
  same file share their work. Every request still checks current catalogue RLS
  before reading cached bytes. Responses remain `private, no-store`; temporary
  signatures are not saved in the cart or the shared Next.js optimizer cache.
- The image endpoint reads only `image_key` instead of the full product record,
  and storage requests reuse the S3 client.
- Hero image download sizes now match its rendered width. Its layout and crop are
  unchanged, and it uses the installed Next.js version's `preload` prop.
- Removed the fixed 600 ms page-cover timer. Existing route loading screens still
  display while navigation is pending.

## Measurements

Read-only samples from the configured live catalogue through the local site:

- P1031: 1,427,663-byte original PNG; 11,822-byte card WebP at 384 px; 33,354-byte
  gallery WebP at 828 px. The card file is 99.17% smaller.
- P1032: 1,862,384-byte original PNG; 9,294-byte card WebP at 384 px; 31,384-byte
  gallery WebP at 828 px. The card file is 99.50% smaller.
- Warm production card requests completed in approximately 210–265 ms in these
  samples, including the catalogue access check.

These are local image-transfer samples without artificial network throttling,
not a measurement of deployed whole-page speed. Process caches reset when a
server instance restarts. Files overwritten at the same storage key refresh after
the short cache lifetimes; image-key changes select a new cache entry immediately.
Raw measurements are in
[the test evidence](test-evidence/image-performance-2026-10-22.json).

## Verification

- All 48 offline regression scripts passed, including 13 new delivery/cache checks
  and the existing product-image reference tests.
- Type checking and lint passed.
- Production build passed with `npm run build -- --webpack`. The default Turbopack
  build was blocked by an environment restriction on binding a worker port.
- Production HTTP checks passed for homepage, search, product and cart pages;
  resized images returned 200, unknown products 404, invalid widths 400, and
  existing direct image URLs retained their original 307 redirects.
- Desktop browser checks confirmed loaded responsive product images. At a 390 px
  mobile viewport the 350 px product gallery selected a 384 px image and loaded
  successfully. Product photography retained its composition and appearance.
- A production browser smoke test selected size S, added P1031 to the bag,
  confirmed its image, size and price in the cart, and removed the test item.
  The test cart ended empty.

Existing unrelated local edits were preserved. No database, storage objects,
catalogue rules, recommendations or checkout behaviour were changed.
