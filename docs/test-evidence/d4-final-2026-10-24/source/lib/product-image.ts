export function getProductImageEndpoint(productId: string): string {
  return `/api/products/${encodeURIComponent(productId)}/image`;
}

// Store this stable app URL in the cart, never a temporary storage signature.
export function getProductImageSrc(
  productId: string | null,
  imageKey: string | null | undefined,
): string | null {
  const key = imageKey?.trim();
  if (!key) return null;
  if (key.startsWith("/images/") && !key.includes("..") && !/[?#\\]/.test(key)) return key;
  return productId ? getProductImageEndpoint(productId) : null;
}

export function getStorageImageKey(
  imageKey: string,
  bucket: string,
  allowedOrigins: string[],
): string | null {
  let key = imageKey.trim();
  if (/^https?:\/\//i.test(key)) {
    try {
      const url = new URL(key);
      if (url.username || url.password || !allowedOrigins.includes(url.origin)) return null;
      const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
      if (!match || decodeURIComponent(match[1]) !== bucket) return null;
      key = decodeURIComponent(match[2]);
    } catch {
      return null;
    }
  } else if (/^[a-z][a-z\d+.-]*:/i.test(key)) {
    return null;
  }

  // Object paths are relative to the configured bucket.
  if (!key || key.startsWith("/") || key.includes("\\")) return null;
  if (key.split("/").some((part) => !part || part === "." || part === "..")) return null;
  return key;
}
