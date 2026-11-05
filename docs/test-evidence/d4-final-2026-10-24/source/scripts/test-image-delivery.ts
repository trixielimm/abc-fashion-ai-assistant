import assert from "node:assert/strict";
import sharp from "sharp";
import { ImageCache } from "../lib/storage/image-cache";
import { createProductImageHandler } from "../lib/storage/product-image-delivery";

async function main() {
  let passed = 0;
  async function check(name: string, test: () => Promise<void> | void) {
    await test();
    passed++;
    console.log(`PASS: ${name}`);
  }

  await check("Concurrent requests share one download and subsequent requests use its bytes", async () => {
    const cache = new ImageCache(100, 1000);
    let calls = 0;
    const load = async () => { calls++; return Buffer.from("photo"); };
    const results = await Promise.all([cache.get("one", load), cache.get("one", load)]);
    assert.equal(calls, 1);
    assert.deepEqual(results[0], results[1]);
    await cache.get("one", load);
    assert.equal(calls, 1);
  });

  await check("Cached files expire and least-recently-used files leave the memory budget", async () => {
    let now = 0;
    let calls = 0;
    const cache = new ImageCache(6, 1000, () => now);
    const load = async () => { calls++; return Buffer.from("abc"); };
    await cache.get("one", load);
    await cache.get("two", load);
    await cache.get("one", load);
    await cache.get("three", load);
    await cache.get("one", load);
    assert.equal(calls, 3);
    await cache.get("two", load);
    assert.equal(calls, 4);
    now = 1000;
    await cache.get("two", load);
    assert.equal(calls, 5);
  });

  await check("Failures and oversized files are never retained in the cache", async () => {
    const cache = new ImageCache(3, 1000);
    await assert.rejects(cache.get("one", async () => { throw new Error("Temporary failure"); }));
    assert.equal((await cache.get("one", async () => Buffer.from("ok"))).toString(), "ok");
    let calls = 0;
    const load = async () => { calls++; return Buffer.from("oversized"); };
    await cache.get("big", load);
    await cache.get("big", load);
    assert.equal(calls, 2);
  });

  const source = await sharp({ create: { width: 800, height: 1200, channels: 4, background: { r: 85, g: 25, b: 170, alpha: 0.5 } } }).png().toBuffer();
  let key: string | null = "products/photo.png";
  let authorisations = 0;
  let reads = 0;
  let signatures = 0;
  const handler = createProductImageHandler({
    async getImageKey() { authorisations++; return key; },
    async getStorageUrl() { signatures++; return "https://storage.example.test/photo?signature=temporary"; },
    async readImage() { reads++; return source; },
  });
  const request = (query = "?w=384", accept = "image/webp,image/*") =>
    new Request(`https://shop.example.test/api/products/P1/image${query}`, { headers: { accept } });

  await check("Resizing preserves image proportions and transparency without changing the crop", async () => {
    const result = await handler(request(), "P1");
    assert.equal(result.status, 200);
    assert.equal(result.headers.get("content-type"), "image/webp");
    assert.equal(result.headers.get("cache-control"), "private, no-store");
    assert.equal(result.headers.get("vary"), "Accept");
    const metadata = await sharp(Buffer.from(await result.arrayBuffer())).metadata();
    assert.equal(metadata.width, 384);
    assert.equal(metadata.height, 576);
    assert.equal(metadata.hasAlpha, true);
    assert.equal(signatures, 0);
  });

  await check("Warm resized images still check access and different widths share the original", async () => {
    const before = authorisations;
    assert.equal((await handler(request(), "P1")).status, 200);
    assert.equal((await handler(request("?w=256"), "P1")).status, 200);
    assert.equal(authorisations, before + 2);
    assert.equal(reads, 1);
  });

  await check("A hidden product cannot read previously cached image bytes", async () => {
    key = null;
    const result = await handler(request(), "P1");
    assert.equal(result.status, 404);
    assert.equal((await result.arrayBuffer()).byteLength, 0);
    assert.equal(reads, 1);
    key = "products/photo.png";
  });

  await check("Browsers without WebP receive a transparent PNG, and small originals are not enlarged", async () => {
    const result = await handler(request("?w=1920", "image/png"), "P1");
    assert.equal(result.headers.get("content-type"), "image/png");
    const metadata = await sharp(Buffer.from(await result.arrayBuffer())).metadata();
    assert.equal(metadata.width, 800);
    assert.equal(metadata.height, 1200);
    assert.equal(metadata.hasAlpha, true);
  });

  await check("Old cart and direct-image URLs still redirect to a fresh original", async () => {
    const result = await handler(request(""), "P1");
    assert.equal(result.status, 307);
    assert.equal(result.headers.get("location"), "https://storage.example.test/photo?signature=temporary");
    assert.equal(result.headers.get("cache-control"), "private, no-store");
  });

  await check("Invalid or duplicate widths cannot trigger arbitrary transformations", async () => {
    const before = reads;
    for (const query of ["?w=1", "?w=99999999", "?w=abc", "?w=", "?w=384&w=640", "?w=3.84e2"]) {
      assert.equal((await handler(request(query), "P1")).status, 400);
    }
    assert.equal(reads, before);
  });

  await check("Transform errors preserve original delivery and a transient failure can recover", async () => {
    let broken = true;
    const recoverable = createProductImageHandler({
      async getImageKey() { return "photo.png"; },
      async getStorageUrl() { return "https://storage.example.test/original"; },
      async readImage() { if (broken) throw new Error("Temporary failure"); return source; },
    });
    const fallback = await recoverable(request(), "P1");
    assert.equal(fallback.status, 307);
    assert.equal(fallback.headers.get("location"), "https://storage.example.test/original");
    broken = false;
    assert.equal((await recoverable(request(), "P1")).status, 200);
  });

  await check("Unsupported formats retain their original delivery", async () => {
    const handler = createProductImageHandler({
      async getImageKey() { return "photo.svg"; },
      async getStorageUrl() { return "https://storage.example.test/original.svg"; },
      async readImage() { return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"/>'); },
    });
    assert.equal((await handler(request(), "P1")).status, 307);
  });

  await check("Local image references keep their existing redirect and never access storage", async () => {
    const handler = createProductImageHandler({
      async getImageKey() { return "/images/product-blouse.jpg"; },
      async getStorageUrl() { assert.fail("Local photos must not be signed"); },
      async readImage() { assert.fail("Local photos must not access storage"); },
    });
    const result = await handler(request(), "P1");
    assert.equal(result.status, 307);
    assert.equal(result.headers.get("location"), "https://shop.example.test/images/product-blouse.jpg");
  });

  await check("Catalogue failures return a generic non-cacheable error without storage details", async () => {
    const handler = createProductImageHandler({
      async getImageKey() { throw new Error("Sensitive provider details"); },
      async getStorageUrl() { assert.fail("Failed authorisation must not sign an image"); },
      async readImage() { assert.fail("Failed authorisation must not read an image"); },
    });
    const result = await handler(request(), "P1");
    assert.equal(result.status, 503);
    assert.equal(result.headers.get("cache-control"), "private, no-store");
    assert.equal(await result.text(), "");
  });

  console.log(`${passed} image delivery checks passed.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
