import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

// Reuse the product_catalog type already defined in your project.
export type CatalogueProduct =
  Database["public"]["Views"]["product_catalog"]["Row"];

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

  return products;
}