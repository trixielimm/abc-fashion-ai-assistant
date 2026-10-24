import audit from "./image-health.json";
type ImageAudit = { checked_at: string; images: Record<string, { key_fingerprint: string; object_present: boolean }> };
const health = audit as ImageAudit;
function fingerprint(value: string) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}
// This is a bounded storage-object audit, not a claim of visual compatibility.
// Changed keys and audits older than a day are unknown until the audit is refreshed.
export function auditedImagePresent(product: { product_id: string | null; image_key?: string | null }, now = Date.now()): boolean | null {
  const row = product.product_id ? health.images[product.product_id] : null;
  if (!row || now - Date.parse(health.checked_at) > 86_400_000 || row.key_fingerprint !== fingerprint(product.image_key?.trim() ?? "")) return null;
  return row.object_present;
}
