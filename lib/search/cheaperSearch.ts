import type { CatalogueProduct } from "../recommendations/catalogue";
import type { CataloguePreferenceValues } from "../catalogue/preferenceValues";

import {
  ShoppingPreferencesSchema,
  type ShoppingPreferences,
} from "../ai/preferenceSchema";

import { PriceReferencesSchema } from "../stylist/priceContext";
import type { PreferenceSearchResult } from "./preferenceSearch";
import { searchWithValidatedPreferences } from "./validatedPreferenceSearch";

function cents(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }

  const amount = Math.round(value * 100);

  return (
    Number.isSafeInteger(amount) &&
    Math.abs(value * 100 - amount) < 0.000001
  )
    ? amount
    : null;
}

const normalise = (value: string | null) =>
  (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export function searchCheaper(
  catalogue: readonly CatalogueProduct[],
  input: ShoppingPreferences,
  referenceInput: unknown,
  vocabulary: CataloguePreferenceValues
): PreferenceSearchResult {
  const preferences = ShoppingPreferencesSchema.parse(input);
  const references = PriceReferencesSchema.parse(referenceInput);

  const records: CatalogueProduct[] = [];
  const prices: number[] = [];

  const clarify = (message: string): PreferenceSearchResult => ({
    status: "needs_more_detail",
    message,
    products: [],
  });

  // Verify the referenced records and displayed prices against the catalogue.
  for (const reference of references) {
    const product = catalogue.find(
      (item) => item.product_id === reference.product_id
    );

    const currentPrice = cents(product?.price_aud);
    const displayedPrice = cents(reference.displayed_price_aud);

    if (
      !product ||
      currentPrice === null ||
      currentPrice !== displayedPrice
    ) {
      return clarify(
        "A referenced product or its price has changed. Refresh the main search before comparing prices."
      );
    }

    records.push(product);
    prices.push(currentPrice);
  }

  const category = records[0].category;

  if (
    !category ||
    records.some(
      (product) =>
        normalise(product.category) !== normalise(category)
    )
  ) {
    return clarify(
      "The last results contain different item categories. Which kind of item would you like a cheaper option for?"
    );
  }

  if (
    preferences.category !== null &&
    normalise(preferences.category) !== normalise(category)
  ) {
    return clarify(
      "The product references do not match the current category. Run the main search again first."
    );
  }

  // Retain the common product type where the shortlist identifies one.
  const identityFields = [
    "category",
    "subcategory",
    "product_type",
  ] as const;

  const commonFields = identityFields.filter((field) => {
    const value = normalise(records[0][field]);

    return (
      value !== "" &&
      records.every(
        (product) => normalise(product[field]) === value
      )
    );
  });

  // For several products, compare below the lowest displayed price.
  const ceiling = Math.min(...prices);

  const excluded = new Set(
    references.map((reference) => reference.product_id)
  );

  // Apply the relative price filter BEFORE the four-item shortlist.
  const candidates = catalogue.filter((product) => {
    const price = cents(product.price_aud);

    return (
      price !== null &&
      price < ceiling &&
      !excluded.has(product.product_id ?? "") &&
      commonFields.every(
        (field) =>
          normalise(product[field]) ===
          normalise(records[0][field])
      )
    );
  });

  // Infer the comparison category if needed, without altering saved preferences.
  const filterPreferences = ShoppingPreferencesSchema.parse({
    ...preferences,
    category: preferences.category ?? category,
  });

  const { result } = searchWithValidatedPreferences(
    candidates,
    filterPreferences,
    vocabulary
  );

  if (result.status === "needs_more_detail") return result;

  const amount = `A$${(ceiling / 100).toFixed(2)}`;

  const basis =
    records.length === 1
      ? `the displayed price of ${records[0].product_name}`
      : "the lowest price in the last displayed shortlist";

  return {
    ...result,

    message:
      result.products.length > 0
        ? `These options cost less than ${amount}, ${basis}. ${result.message}`
        : `No lower-priced options below ${amount}, ${basis}, passed the current filters. Your stated preferences were kept. ${result.message}`,
  };
}