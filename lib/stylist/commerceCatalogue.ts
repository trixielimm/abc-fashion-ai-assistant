import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseEnv } from "../supabase/env";
import type { CatalogueProduct } from "../recommendations/catalogue";
import { VerifiedFeatureSchema } from "./commerceSchema";
import type { Database } from "../database.types";
import { SyntheticSpecificationSchema, getProductSpecification } from "./productSpecifications";

const ruleSchema = z.object({ product_id: z.string(), priority: z.number(), categories: z.object({ category_name: z.string() }) });

export async function enrichCommercialCatalogue(products: CatalogueProduct[]): Promise<CatalogueProduct[]> {
  if (!products.length) return products;
  const { url, publishableKey } = getSupabaseEnv();
  const db = createClient<Database>(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const ids = products.map(product => product.product_id).filter((value): value is string => Boolean(value));
  const facts: unknown[] = [], rules: unknown[] = [], specifications: unknown[] = [];
  let status: CatalogueProduct["feature_data_status"] = "available";
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const [features, pairings, specs] = await Promise.all([
      db.from("stylist_product_features").select("product_id,feature_key,value,source_reference,source_version,review_status,verified_at")
        .in("product_id", batch).eq("review_status", "verified").abortSignal(AbortSignal.timeout(10_000)),
      db.from("cross_sell_rules").select("product_id,priority,categories!cross_sell_rules_target_category_id_fkey(category_name)")
        .in("product_id", batch).order("priority", { ascending: false }).abortSignal(AbortSignal.timeout(10_000)),
      db.from("prototype_product_specifications").select("*").in("product_id", batch).abortSignal(AbortSignal.timeout(10_000)),
    ]);
    if (features.error) {
      status = ["42P01", "PGRST205"].includes(features.error.code) ? "not_configured" : "unavailable";
    } else facts.push(...(features.data ?? []));
    if (!pairings.error) rules.push(...(pairings.data ?? []));
    if (!specs.error) specifications.push(...(specs.data ?? []));
  }
  const verified = facts.flatMap(row => {
    const result = VerifiedFeatureSchema.safeParse(row);
    return result.success ? [result.data] : [];
  });
  const approvedRules = rules.flatMap(row => {
    const result = ruleSchema.safeParse(row);
    return result.success ? [result.data] : [];
  }).sort((a, b) => b.priority - a.priority);
  const approvedSpecs = specifications.flatMap(row => {
    const parsed = SyntheticSpecificationSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
  return products.map(product => {
    const spec = approvedSpecs.find(row => row.product_id === product.product_id);
    const enriched = { ...product, ...(spec ? { synthetic_specification: spec } : {}) };
    if (!getProductSpecification(enriched)) delete enriched.synthetic_specification;
    return {
    ...enriched,
    verified_features: status === "available" ? verified.filter(feature => feature.product_id === product.product_id) : [],
    feature_data_status: status,
    pairing_categories: [...new Set(approvedRules.filter(rule => rule.product_id === product.product_id).map(rule => rule.categories.category_name))],
  }; });
}
