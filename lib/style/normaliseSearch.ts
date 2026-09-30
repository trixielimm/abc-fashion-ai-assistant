import type { ShoppingPreferences } from "@/lib/ai/preferenceSchema";

export function normaliseSearchPreferences(message: string, preferences: ShoppingPreferences): ShoppingPreferences {
  const result = { ...preferences };
  const type = result.product_type?.trim().toLowerCase();
  const subcategory = result.subcategory?.trim().toLowerCase();

  if (type === "dress" || type === "dresses") {
    result.category = "Clothing";
    result.subcategory = "Dresses";
    result.product_type = null;
  } else if (subcategory === "dress") {
    result.subcategory = "Dresses";
  }

  // Collection is a hard filter, so never add one solely because the customer
  // named a garment. A clear current-message follow-up may retain context.
  const explicitGender = /\b(women|woman|womens|ladies|female|men|man|mens|male|unisex)\b/i.test(message);
  const followUp = /\b(same|those|that one|instead|what about|another)\b/i.test(message);
  if (!explicitGender && !followUp) result.gender = null;

  return result;
}
