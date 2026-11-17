import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "../supabase/env";
import type { CatalogueProduct } from "../recommendations/catalogue";
import { VerifiedFeatureSchema } from "../stylist/commerceSchema";
import { SyntheticSpecificationSchema } from "../stylist/productSpecifications";
import { runFacetedSearch } from "./facetedSearch";
import type { FilterState } from "./filterState";

export async function loadSearchCatalogue(requestSignal?: AbortSignal) {
  const { url, publishableKey } = getSupabaseEnv();
  const db = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
  const timeout = AbortSignal.timeout(15_000);
  const signal = requestSignal ? AbortSignal.any([requestSignal, timeout]) : timeout;
  async function read(table: string, columns: string, order: string) {
    const rows: unknown[] = [];
    for (let offset = 0; offset <= 5000; offset += 500) {
      let request = db.from(table).select(columns).order(order).range(offset, offset + 499).abortSignal(signal);
      if (table === "stylist_product_features") request = request.order("feature_key");
      const { data, error } = await request;
      if (error || data === null) throw new Error("Unable to load search catalogue.");
      rows.push(...data);
      if (rows.length > 5000) throw new Error("Search catalogue exceeds the retrieval limit.");
      if (data.length < 500) return rows;
    }
    throw new Error("Search catalogue exceeds the retrieval limit.");
  }
  const [catalogue, facts, specifications] = await Promise.all([
    read("product_catalog", "product_id,product_name,brand_line,gender,category,subcategory,product_type,colour,style,occasion,season,material,fit,sizes_available,price_aud,stock_qty,description,tags,image_key,is_available", "product_id"),
    read("stylist_product_features", "product_id,feature_key,value,source_reference,source_version,review_status,verified_at", "product_id").then(data => ({ data, ok: true }), () => ({ data: [], ok: false })),
    read("prototype_product_specifications", "*", "product_id").then(data => ({ data, ok: true }), () => ({ data: [], ok: false })),
  ]);
  const verified = facts.data.flatMap(row => { const parsed = VerifiedFeatureSchema.safeParse(row); return parsed.success ? [parsed.data] : []; });
  const specs = new Map(specifications.data.flatMap(row => { const parsed = SyntheticSpecificationSchema.safeParse(row); return parsed.success ? [[parsed.data.product_id, parsed.data] as const] : []; }));
  const products = (catalogue as CatalogueProduct[]).map(product => ({ ...product,
    verified_features: verified.filter(feature => feature.product_id === product.product_id),
    synthetic_specification: specs.get(product.product_id ?? ""),
  }));
  return { products, featureDataAvailable: facts.ok && specifications.ok };
}
export async function getSearchResults(state: FilterState, requestSignal?: AbortSignal) {
  const { products, featureDataAvailable } = await loadSearchCatalogue(requestSignal);
  return runFacetedSearch(products, state, featureDataAvailable);
}
