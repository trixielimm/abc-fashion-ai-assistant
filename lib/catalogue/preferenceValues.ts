import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseEnv } from "../supabase/env";

const RowSchema = z.object({
  gender: z.string().nullable(), brand_line: z.string().nullable(),
  category: z.string(), subcategory: z.string().nullable(),
  product_type: z.string().nullable(), occasion: z.string().nullable(),
  style: z.string().nullable(), colour: z.string().nullable(),
  season: z.string().nullable(), material: z.string().nullable(), fit: z.string().nullable(),
});
export type CataloguePreferenceRow = z.infer<typeof RowSchema>;
export type CataloguePreferenceValues = {
  rows: CataloguePreferenceRow[];
  sizes: string[];
  categories: { category: string; subcategory: string | null }[];
};

// Vocabulary only: this does not select or rank recommendations.
// Product vocabulary is limited by public RLS visibility. Sizes and category
// relationships come from reference tables, independently of current stock.
export async function loadPreferenceValues(): Promise<CataloguePreferenceValues> {
  const { url, publishableKey } = getSupabaseEnv();
  const db = createClient(url, publishableKey, { auth: { persistSession: false } });
  async function read(table: string, columns: string, order: string) {
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from(table).select(columns)
        .order(order).range(offset, offset + 499);
      if (error || !data) throw new Error("Unable to load catalogue preference values.");
      rows.push(...data);
      if (data.length < 500) return rows;
    }
  }
  const [products, sizes, categories] = await Promise.all([
    read("product_catalog", "product_id,gender,brand_line,category,subcategory,product_type,occasion,style,colour,season,material,fit", "product_id"),
    read("sizes", "size_label,size_id", "size_id"),
    read("categories", "category_id,category_name,parent_category_id", "category_id"),
  ]);
  const rows = z.array(RowSchema).parse(products);
  const labels = z.array(z.object({ size_label: z.string() })).parse(sizes);
  const hierarchy = z.array(z.object({ category_id: z.number(), category_name: z.string(), parent_category_id: z.number().nullable() })).parse(categories);
  if (!rows.length || !labels.length || !hierarchy.length) {
    throw new Error("Catalogue preference values are unavailable.");
  }
  return {
    rows, sizes: labels.map(s => s.size_label),
    categories: hierarchy.map(c => {
      const parent = hierarchy.find(p => p.category_id === c.parent_category_id);
      if (c.parent_category_id !== null && !parent) throw new Error("Incomplete catalogue category hierarchy.");
      return { category: parent?.category_name ?? c.category_name, subcategory: parent ? c.category_name : null };
    }),
  };
}
