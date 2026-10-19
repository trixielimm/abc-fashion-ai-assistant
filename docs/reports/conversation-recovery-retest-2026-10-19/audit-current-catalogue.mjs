import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const [products, specifications] = await Promise.all([
  db.from("product_catalog").select("*").order("product_id").abortSignal(AbortSignal.timeout(30000)),
  db.from("prototype_product_specifications").select("product_id").abortSignal(AbortSignal.timeout(30000)),
]);
if (products.error || specifications.error) throw new Error("Public catalogue audit could not complete.");
const baseline = JSON.parse(readFileSync(new URL("../../data/prototype-specs-v1/catalogue-baseline.json", import.meta.url), "utf8"));
const originalIds = new Set(baseline.map(product => product.product_id));
const specificationIds = new Set(specifications.data.map(product => product.product_id));
const changes = [];
for (const original of baseline) {
  const current = products.data.find(product => product.product_id === original.product_id);
  if (!current) { changes.push({ product_id: original.product_id, field: "missing" }); continue; }
  for (const field of ["product_name", "description", "material", "stock_qty", "is_available", "price_aud"]) {
    if (JSON.stringify(current[field]) !== JSON.stringify(original[field])) changes.push({ product_id: original.product_id, field });
  }
  if (createHash("sha256").update(JSON.stringify(current.image_key)).digest("hex") !== original.image_key_sha256) changes.push({ product_id: original.product_id, field: "image_key" });
}
const result = {
  audited_at: new Date().toISOString(), catalogue_count: products.data.length,
  specification_count: specifications.data.length, baseline_count: baseline.length,
  new_product_ids: products.data.filter(product => !originalIds.has(product.product_id)).map(product => product.product_id),
  missing_specification_ids: products.data.filter(product => !specificationIds.has(product.product_id)).map(product => product.product_id),
  baseline_field_changes: changes,
};
writeFileSync(new URL("catalogue-audit.json", import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
