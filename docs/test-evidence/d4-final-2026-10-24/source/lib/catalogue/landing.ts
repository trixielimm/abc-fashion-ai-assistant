import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { buildLandingContent, type LandingCatalogueRow } from "./storefront";

export const getLandingContent = cache(async function getLandingContent() {
  const db = await createClient();
  const rows: LandingCatalogueRow[] = [];
  const pageSize = 200;
  const signal = AbortSignal.timeout(15_000);

  for (let offset = 0; offset <= 5_000; offset += pageSize) {
    const { data, error } = await db.from("product_catalog")
      .select("product_id,product_name,price_aud,image_key,category,subcategory,brand_line,gender,description,stock_qty,is_available")
      .eq("is_available", true)
      .gt("stock_qty", 0)
      .not("image_key", "is", null)
      .order("product_id")
      .range(offset, offset + pageSize - 1)
      .abortSignal(signal);

    if (error || data === null) throw new Error("Unable to load the landing page collection.");
    rows.push(...data);
    if (rows.length > 5_000) throw new Error("Landing page catalogue exceeds the retrieval limit.");
    if (data.length < pageSize) return buildLandingContent(rows);
  }

  throw new Error("Unable to load the complete landing page collection.");
});
