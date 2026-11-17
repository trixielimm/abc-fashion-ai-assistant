import assert from "node:assert/strict";
import { getImageProps } from "next/image";
import { getProductImageSrc, getStorageImageKey } from "../lib/product-image";
import productImageLoader from "../lib/product-image-loader";

const origin = "https://example.supabase.co";
const resolve = (key: string) => getStorageImageKey(key, "photos", [origin]);

assert.equal(getProductImageSrc("ABC/001", "products/main.jpg"), "/api/products/ABC%2F001/image");
assert.equal(getProductImageSrc("ABC001", null), null);
assert.equal(getProductImageSrc("ABC001", "  "), null);
assert.equal(getProductImageSrc("demo", "/images/product-blouse.jpg"), "/images/product-blouse.jpg");
assert.equal(resolve("products/main photo.jpg"), "products/main photo.jpg");
assert.equal(resolve(`${origin}/storage/v1/object/public/photos/products/main%20photo.jpg`), "products/main photo.jpg");
assert.equal(resolve(`${origin}/storage/v1/object/sign/photos/products/main.jpg?token=expired`), "products/main.jpg");
assert.equal(resolve(`${origin}/storage/v1/object/public/other-bucket/main.jpg`), null);
assert.equal(resolve("https://untrusted.example/storage/v1/object/public/photos/main.jpg"), null);
assert.equal(resolve(`${origin}/storage/v1/object/public/photos/%ZZ`), null);
assert.equal(resolve("https://"), null);
assert.equal(resolve("../private.jpg"), null);
assert.equal(resolve("/private.jpg"), null);
assert.equal(resolve("products/../private.jpg"), null);
assert.equal(resolve("file:private.jpg"), null);
assert.equal(resolve(""), null);

const src = getProductImageSrc("P1", "products/photo.png")!;
const { props } = getImageProps({ src, alt: "Product", fill: true, sizes: "104px", loader: productImageLoader });
assert.match(props.srcSet ?? "", /\/api\/products\/P1\/image\?w=256 256w/);
assert.match(props.src, /\/api\/products\/P1\/image\?w=3840$/);
assert.equal(src, "/api/products/P1/image");

console.log("Product image references, expired URLs, and storage boundaries passed.");
