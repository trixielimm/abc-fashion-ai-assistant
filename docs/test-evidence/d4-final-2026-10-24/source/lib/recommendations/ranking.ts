import { z } from "zod";

import { ShoppingPreferencesSchema } from "@/lib/ai/preferenceSchema";
import type { CatalogueProduct } from "./catalogue";

export const SoftPreferencesSchema = ShoppingPreferencesSchema.pick({
  category: true,
  occasion: true,
  style: true,
  preferred_colours: true,
}).extend({
  occasion: z.string().trim().min(1).nullable(),
  style: z.string().trim().min(1).nullable(),
  preferred_colours: z.array(z.string().trim().min(1)),
});

export type SoftPreferences = z.infer<typeof SoftPreferencesSchema>;

export type RankedProduct = {
  product: CatalogueProduct;
  score: number;
  possible_score: number;
  matched_preferences: string[];
  unmatched_preferences: string[];
};

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

// Only pass products that have already passed the hard filters.
export function rankProducts(
  products: readonly CatalogueProduct[],
  preferences: SoftPreferences
): RankedProduct[] {
  const filters = SoftPreferencesSchema.parse(preferences);

  const ranked = products.map((product): RankedProduct => {
    const matched: string[] = [];
    const unmatched: string[] = [];

    function check(
      label: string,
      actual: string | null,
      requested: string | null
    ) {
      // An unspecified preference does not affect the score.
      if (requested === null) return;

      const description = `${label}: ${requested}`;

      if (actual !== null && normalise(actual) === normalise(requested)) {
        matched.push(description);
      } else {
        unmatched.push(description);
      }
    }

    check("Category", product.category, filters.category);
    check("Occasion", product.occasion, filters.occasion);
    check("Style", product.style, filters.style);

    // Multiple preferred colours are alternatives.
    // Matching any one colour earns one point in total.
    if (filters.preferred_colours.length > 0) {
      const actualColour = normalise(product.colour ?? "");

      const colourMatches = filters.preferred_colours.some(
        (colour) => normalise(colour) === actualColour
      );

      const description =
        `Colour: ${filters.preferred_colours.join(" or ")}`;

      if (colourMatches) {
        matched.push(description);
      } else {
        unmatched.push(description);
      }
    }

    return {
      product,
      score: matched.length,
      possible_score: matched.length + unmatched.length,
      matched_preferences: matched,
      unmatched_preferences: unmatched,
    };
  });

  return ranked.sort((a, b) => {
    // More matching preferences come first.
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    // Proposed tie-breaker: lower price, then product ID.
    const priceA = a.product.price_aud ?? Number.POSITIVE_INFINITY;
    const priceB = b.product.price_aud ?? Number.POSITIVE_INFINITY;

    if (priceA !== priceB) {
      return priceA - priceB;
    }

    return (a.product.product_id ?? "").localeCompare(
      b.product.product_id ?? ""
    );
  });
}