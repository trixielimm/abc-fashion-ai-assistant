import { z } from "zod";
import {
  ShoppingPreferencesSchema,
  type ShoppingPreferences,
} from "../ai/preferenceSchema";

const ProductSchema = z.object({
  product_id: z.string().min(1),
  product_name: z.string().min(1),
  price_aud: z.number().nonnegative(),
  brand_line: z.string().nullable(),
  category: z.string().nullable(),
  subcategory: z.string().nullable(),
  product_type: z.string().nullable(),
  colour: z.string().nullable(),
  sizes_available: z.array(z.string().trim().min(1)).min(1),
});

const ResponseSchema = z.object({
  status: z.enum([
    "matches",
    "partial",
    "no_match",
    "needs_more_detail",
    "primary_unavailable",
    "no_rule",
    "rule_unavailable",
  ]),
  message: z.string().min(1),
  primary_product_id: z.string().min(1),
  target_category: z.string().nullable(),
  budget_scope: z.literal("per_additional_item"),
  applied_preferences: ShoppingPreferencesSchema.nullable(),
  products: z.array(ProductSchema).max(4),
});

export type CrossSellCardProduct = z.infer<typeof ProductSchema>;
export type CrossSellReply = z.infer<typeof ResponseSchema>;

export function buildCrossSellRequest(
  primaryId: string,
  budgetText: string,
  size: string | null,
  context: ShoppingPreferences
) {
  const saved = ShoppingPreferencesSchema.parse(context);
  const budget = budgetText.trim();

  if (!primaryId.trim()) {
    throw new Error("Choose the main product first.");
  }

  if (
    !/^\d+(?:\.\d{1,2})?$/.test(budget) ||
    !Number.isSafeInteger(Math.round(Number(budget) * 100))
  ) {
    throw new Error("Enter a maximum price such as 50 or 50.00.");
  }

  if (size !== null && !size.trim()) {
    throw new Error("Enter the additional item's own size label.");
  }

  // Do not silently ignore saved fields this endpoint cannot yet apply.
  if (saved.material || saved.brand_line || saved.fit || saved.season) {
    throw new Error(
      "This extra-item search does not yet support your saved material, brand, fit or season preferences. No extra search was sent."
    );
  }

  return {
    primary_product_id: primaryId.trim(),
    max_price: Number(budget),
    size: size === null ? null : size.trim(),
    gender: saved.gender,
    occasion: saved.occasion,
    style: saved.style,
    preferred_colours: saved.preferred_colours,
    excluded_colours: saved.excluded_colours,
  };
}

const normalise = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

export function readCrossSellResponse(
  input: unknown,
  request: ReturnType<typeof buildCrossSellRequest>
): CrossSellReply {
  const result = ResponseSchema.parse(input);

  const hasMatches =
    result.status === "matches" ||
    result.status === "partial";

  if (
    result.primary_product_id !== request.primary_product_id ||
    hasMatches !== (result.products.length > 0)
  ) {
    throw new Error("The additional-item response could not be verified.");
  }

  if (result.products.length > 0) {
    const applied = result.applied_preferences;
    const ids = result.products.map((product) => product.product_id);

    if (
      request.size === null ||
      !result.target_category ||
      !applied ||
      applied.max_price !== request.max_price ||
      normalise(applied.size ?? "") !== normalise(request.size) ||
      new Set(ids).size !== ids.length ||
      result.products.some((product) =>
        product.product_id === request.primary_product_id ||
        product.price_aud > request.max_price ||
        !product.sizes_available.some(
          (label) => normalise(label) === normalise(request.size!)
        ) ||
        product.category !== applied.category ||
        (
          applied.subcategory !== null &&
          product.subcategory !== applied.subcategory
        )
      )
    ) {
      throw new Error("The additional-item response failed its checks.");
    }
  }

  return result;
}