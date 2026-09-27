import { z } from "zod";

import { ShoppingPreferencesSchema } from "@/lib/ai/preferenceSchema";
import type { CatalogueProduct } from "./catalogue";

// Use the same field names as the existing preference extractor.
export const HardConstraintsSchema = ShoppingPreferencesSchema.pick({
  size: true,
  min_price: true,
  max_price: true,
  excluded_colours: true,
})
  .extend({
    size: z.string().trim().min(1).nullable(),
    excluded_colours: z.array(z.string().trim().min(1)),
  })
  .refine(
    (preferences) =>
      preferences.min_price === null ||
      preferences.max_price === null ||
      preferences.min_price <= preferences.max_price,
    {
      message: "Minimum price cannot be greater than maximum price.",
      path: ["min_price"],
    }
  );

export type HardConstraints = z.infer<typeof HardConstraintsSchema>;

// Compare labels without differences in capital letters or extra spaces.
function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function filterByHardConstraints(
  products: readonly CatalogueProduct[],
  constraints: HardConstraints
): CatalogueProduct[] {
  const filters = HardConstraintsSchema.parse(constraints);

  const requestedSize =
    filters.size === null ? null : normalise(filters.size);

  const excludedColours = filters.excluded_colours.map(normalise);

  return products.filter((product) => {
    // 1. The product must be marked as available.
    if (product.is_available !== true) {
      return false;
    }

    // 2. The product must have positive stock.
    const stock = product.stock_qty;

    if (
      typeof stock !== "number" ||
      !Number.isInteger(stock) ||
      stock <= 0
    ) {
      return false;
    }

    // 3. Missing or invalid prices must not be treated as zero.
    const price = product.price_aud;

    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      return false;
    }

    // 4. Check the customer's price range, when provided.
    if (filters.min_price !== null && price < filters.min_price) {
      return false;
    }

    if (filters.max_price !== null && price > filters.max_price) {
      return false;
    }

    // 5. Read the sizes currently available for this product.
    const sizeLabels = Array.isArray(product.sizes_available)
      ? product.sizes_available
      : [];

    const availableSizes = sizeLabels
      .filter((size) => typeof size === "string" && size.trim() !== "")
      .map(normalise);

    if (availableSizes.length === 0) {
      return false;
    }

    // A requested size must appear in the available-size list.
    if (
      requestedSize !== null &&
      !availableSizes.includes(requestedSize)
    ) {
      return false;
    }

    // 6. Reject explicitly excluded primary colours.
    if (excludedColours.length > 0) {
      const colour = product.colour ? normalise(product.colour) : "";

      // Missing colour means we cannot verify the exclusion.
      if (colour === "" || excludedColours.includes(colour)) {
        return false;
      }
    }

    // The product passed every check.
    return true;
  });
}