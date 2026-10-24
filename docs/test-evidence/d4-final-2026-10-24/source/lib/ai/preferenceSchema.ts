import { z } from "zod";

export const ShoppingPreferencesSchema = z.object({
  gender: z.enum(["Women", "Men", "Unisex"]).nullable(),

  category: z
    .enum(["Clothing", "Shoes", "Bags", "Accessories"])
    .nullable(),

  subcategory: z.string().nullable(),

  product_type: z.string().nullable(),

  
  occasion: z.string().nullable(),

  style: z.string().nullable(),

  preferred_colours: z.array(z.string()),

  excluded_colours: z.array(z.string()),

  season: z.string().nullable(),

  material: z.string().nullable(),

  fit: z.string().nullable(),

  size: z.string().nullable(),

  min_price: z.number().nonnegative().nullable(),

  max_price: z.number().nonnegative().nullable(),

  brand_line: z
    .enum([
      "ABC Occasion",
      "ABC Casual",
      "ABC Essentials",
      "ABC Footwear",
      "ABC Accessories",
    ])
    .nullable(),
});

export type ShoppingPreferences = z.infer<
  typeof ShoppingPreferencesSchema
>;