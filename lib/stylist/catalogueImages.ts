// Add a mapping only after you have the matching catalogue product photograph.
// Store the file under public/images/catalogue/ and use its exact product ID.
// Example format (not an active mapping):
// "P1002": "/images/catalogue/abc_1002.jpg",
export const PRODUCT_IMAGE_PATHS: Readonly<Record<string, string>> = {
  "P1002": "/images/catalogue/abc_1002.jpg",
};

export function safeLocalImagePath(value: unknown): value is string {
  return typeof value === "string" &&
    /^\/images\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:png|jpe?g|webp|avif)$/i.test(value);
}

export function catalogueImageSource(
  product: { product_id: string | null; image_key?: string | null },
  mapping: Readonly<Record<string, string>> = PRODUCT_IMAGE_PATHS
): string | null {
  const mapped = product.product_id ? mapping[product.product_id] : undefined;
  if (safeLocalImagePath(mapped)) return mapped;
  // A stored, usable local path is acceptable. A bare image_key is not a URL.
  return safeLocalImagePath(product.image_key) ? product.image_key : null;
}