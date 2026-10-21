import { z } from "zod";
import { MAX_DISPLAYED_PRODUCTS } from "./conversationLimits";

import {
  ShoppingPreferencesSchema,
  type ShoppingPreferences,
} from "../ai/preferenceSchema";

export const PriceReferencesSchema = z
  .array(
    z.strictObject({
      product_id: z.string().trim().min(1).max(100),
      displayed_price_aud: z.number().nonnegative(),
    })
  )
  .min(1)
  .max(MAX_DISPLAYED_PRODUCTS)
  .refine(
    (rows) =>
      new Set(rows.map((row) => row.product_id)).size === rows.length,
    "Product references must be unique."
  );

export type PriceContext = {
  preferences: ShoppingPreferences;
  references: z.infer<typeof PriceReferencesSchema>;
};

export function rememberPriceContext(
  products: readonly {
    product_id: string;
    price_aud: number;
  }[],
  preferences: ShoppingPreferences
): PriceContext | null {
  if (products.length === 0) return null;

  return {
    preferences: ShoppingPreferencesSchema.parse(preferences),

    references: PriceReferencesSchema.parse(
      products.map((product) => ({
        product_id: product.product_id,
        displayed_price_aud: product.price_aud,
      }))
    ),
  };
}

export function isCheaperMessage(message: string): boolean {
  const text = message
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "")
    .replace(/^please\s+/, "")
    .replace(/,?\s+please$/, "");

  // Match the whole message, not "cheaper" inside another instruction.
  return /^(?:(?:can|could) you |do you have |are there )?(?:(?:show|find|suggest)(?: me)? )?(?:(?:something|anything) )?(?:a (?:bit|little) )?(?:cheaper|less expensive|more affordable)(?: (?:options?|alternatives?|items?|ones?))?(?: than (?:this|that|these|those))?$/.test(text);
}
