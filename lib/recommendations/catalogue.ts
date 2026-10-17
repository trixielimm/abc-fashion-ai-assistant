import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { VerifiedFeature } from "../stylist/commerceSchema";
import type { SyntheticSpecification } from "../stylist/productSpecifications";
import { enrichCommercialCatalogue } from "../stylist/commerceCatalogue";

// Reuse the product_catalog type already defined in your project.
export type CatalogueProduct =
  Database["public"]["Views"]["product_catalog"]["Row"] & {
    verified_features?: VerifiedFeature[];
    synthetic_specification?: SyntheticSpecification;
    pairing_categories?: string[];
    feature_data_status?: "available" | "not_configured" | "unavailable";
  };

const PAGE_SIZE = 200;
const MAX_PRODUCTS = 5_000;

const COLUMNS =
  "product_id,product_name,brand_line,gender,category,subcategory,product_type,colour,style,occasion,season,material,fit,sizes_available,price_aud,stock_qty,description,tags,cross_sell_category,image_key,is_available";

export async function getCatalogueProducts(): Promise<CatalogueProduct[]> {
  const supabase = await createClient();

  const products: CatalogueProduct[] = [];
  const signal = AbortSignal.timeout(15_000);

  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("product_catalog")
      .select(COLUMNS)
      .order("product_id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
      .abortSignal(signal);

    if (error) {
      console.error("Catalogue error code:", error.code || "unknown");

      throw new Error("Unable to retrieve the product catalogue.");
    }

    if (data === null) {
      throw new Error("Supabase returned no catalogue response.");
    }

    // An empty page means there are no more products to read.
    if (data.length === 0) {
      break;
    }

    products.push(...data);

    // Stop with an error instead of silently returning an incomplete list.
    if (products.length > MAX_PRODUCTS) {
      throw new Error(
        "The catalogue exceeds the prototype retrieval limit."
      );
    }

    offset += data.length;
  }

  return enrichCommercialCatalogue(products);
}

export async function getCatalogueProductById(
  productId: string
): Promise<CatalogueProduct | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_catalog")
    .select(COLUMNS)
    .eq("product_id", productId)
    .abortSignal(AbortSignal.timeout(15_000))
    .maybeSingle();

  if (error) {
    console.error("Catalogue error code:", error.code || "unknown");
    throw new Error("Unable to retrieve the product.");
  }

  // Product pages and image authorization need identity/stock, not comparison metadata.
  return data;
}

export async function getCatalogueProductsByIds(ids: readonly string[]): Promise<CatalogueProduct[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  if (unique.length > 24) throw new Error("Too many product references.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_catalog").select(COLUMNS).in("product_id", unique)
    .abortSignal(AbortSignal.timeout(15_000));
  if (error || data === null) throw new Error("Unable to retrieve referenced catalogue products.");
  return enrichCommercialCatalogue(data);
}
