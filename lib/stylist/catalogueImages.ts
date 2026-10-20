import { getProductImageEndpoint } from "../product-image";

// Add a mapping only after you have the matching catalogue product photograph.
// Store the file under public/images/catalogue/ and use its exact product ID.
// Example format (not an active mapping):
// "P1002": "/images/catalogue/abc_1002.jpg",
export const PRODUCT_IMAGE_PATHS: Readonly<Record<string, string>> = {};

export function safeLocalImagePath(value: unknown): value is string {
  return typeof value === "string" &&
    /^\/images\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:png|jpe?g|webp|avif)$/i.test(value);
}

export function safeProductImageSource(value: unknown): value is string {
  if (safeLocalImagePath(value)) return true;
  if (typeof value !== "string") return false;
  const match = value.match(/^\/api\/products\/([^/?#]+)\/image$/);
  if (!match) return false;
  try {
    const id = decodeURIComponent(match[1]);
    return id !== "." && id !== ".." && id.trim().length > 0 &&
      getProductImageEndpoint(id) === value;
  } catch {
    return false;
  }
}

export function catalogueImageSource(
  product: { product_id: string | null; image_key?: string | null },
  mapping: Readonly<Record<string, string>> = PRODUCT_IMAGE_PATHS
): string | null {
  const key = product.image_key?.trim();
  if (safeLocalImagePath(key)) return key;
  // Resolve storage keys through the existing catalogue-authorised image route.
  // Never expose a storage credential, signed URL, or arbitrary external URL.
  if (key && product.product_id) return getProductImageEndpoint(product.product_id);
  const mapped = product.product_id ? mapping[product.product_id] : undefined;
  if (safeLocalImagePath(mapped)) return mapped;
  return null;
}
