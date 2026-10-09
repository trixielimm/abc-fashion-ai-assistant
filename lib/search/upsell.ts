import { z } from "zod";

import {
  ShoppingPreferencesSchema,
  type ShoppingPreferences,
} from "../ai/preferenceSchema";

import type { CataloguePreferenceValues } from "../catalogue/preferenceValues";
import type { CatalogueProduct } from "../recommendations/catalogue";

import {
  relatedLabel,
  type StylistProduct,
} from "./preferenceSearch";

import { searchWithValidatedPreferences } from "./validatedPreferenceSearch";

export const UpsellRequestSchema = z.strictObject({
  primary_product_id: z.string().trim().min(1).max(100),
  preferences: ShoppingPreferencesSchema,
  excluded_product_ids: z
    .array(z.string().trim().min(1))
    .max(50)
    .default([]),
});

type UpsellProduct = StylistProduct & {
  extra_cost_aud: number;
  improved_preferences: string[];
  unmatched_preferences: string[];
  explanation: string;
};

type UpsellStatus =
  | "options"
  | "no_upsell"
  | "needs_more_detail"
  | "primary_unavailable"
  | "primary_mismatch";

export type UpsellResult = {
  status: UpsellStatus;
  message: string;
  primary_product_id: string;
  primary_price_aud: number | null;
  budget_scope: "per_replacement_item";
  applied_preferences: ShoppingPreferences | null;
  products: UpsellProduct[];
};

function normalise(value: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

// Compare AUD amounts in cents. Reject malformed catalogue prices.
function cents(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }

  const rounded = Math.round(value * 100);

  return (
    Number.isSafeInteger(rounded) &&
    Math.abs(value * 100 - rounded) < 0.000001
  )
    ? rounded
    : null;
}

export function retrieveUpsell(
  catalogue: readonly CatalogueProduct[],
  input: unknown,
  vocabulary: CataloguePreferenceValues
): UpsellResult {
  const request = UpsellRequestSchema.parse(input);

  let applied: ShoppingPreferences | null = null;
  let primaryPrice: number | null = null;

  function reply(
    status: UpsellStatus,
    message: string,
    products: UpsellProduct[] = []
  ): UpsellResult {
    return {
      status,
      message,
      primary_product_id: request.primary_product_id,
      primary_price_aud: primaryPrice,
      budget_scope: "per_replacement_item",
      applied_preferences: applied,
      products,
    };
  }

  // Read the main item's current price from the catalogue.
  const primary = catalogue.find(
    (product) =>
      product.product_id === request.primary_product_id
  );

  const primaryCents = cents(primary?.price_aud);

  if (!primary || primaryCents === null) {
    return reply(
      "primary_unavailable",
      "The main product could not be verified in the current catalogue."
    );
  }

  primaryPrice = primaryCents / 100;

  // Check the main item against the same request before comparing.
  const original = searchWithValidatedPreferences(
    [primary],
    request.preferences,
    vocabulary
  );

  const preferences = original.validation.preferences;

  if (original.result.status === "needs_more_detail") {
    return reply(
      "needs_more_detail",
      original.result.message
    );
  }

  const maximumCents = cents(preferences.max_price);

  if (maximumCents === null || !preferences.size?.trim()) {
    return reply(
      "needs_more_detail",
      "Specify your size and a maximum per-item price before comparing higher-priced replacements."
    );
  }

  if (original.result.products.length === 0) {
    return reply(
      "primary_mismatch",
      "The main item no longer passes this request's checks. Refresh the main recommendations first."
    );
  }

  applied = preferences;

  const identityFields = [
    "category",
    "subcategory",
    "product_type",
  ] as const;

  if (
    identityFields.some(
      (field) => !normalise(primary[field])
    )
  ) {
    return reply(
      "no_upsell",
      "The catalogue lacks enough product-type detail for a like-for-like replacement."
    );
  }

  const contextFields = [
    "occasion",
    "style",
    "fit",
    "season",
  ] as const;

  const active = contextFields.flatMap((field) => {
    const requested = preferences[field];

    return requested?.trim()
      ? [{
          field,
          requested,
          matchedBefore: relatedLabel(
            primary[field],
            requested
          ),
        }]
      : [];
  });

  // This also handles a request with no context preferences.
  if (active.every((item) => item.matchedBefore)) {
    return reply(
      "no_upsell",
      "No additional requested context match can be demonstrated. A higher price alone is not a reason to suggest a replacement."
    );
  }

  const excluded = new Set([
    request.primary_product_id,
    ...request.excluded_product_ids,
  ]);

  // Apply replacement rules BEFORE the search's four-item limit.
  const candidates = catalogue.filter((product) => {
    const price = cents(product.price_aud);

    if (
      excluded.has(product.product_id ?? "") ||
      price === null ||
      price <= primaryCents ||
      price > maximumCents ||
      identityFields.some(
        (field) =>
          normalise(product[field]) !==
          normalise(primary[field])
      ) ||
      (
        primary.gender !== null &&
        normalise(product.gender) !==
          normalise(primary.gender)
      )
    ) {
      return false;
    }

    const preservesMatches = active.every(
      (item) =>
        !item.matchedBefore ||
        relatedLabel(
          product[item.field],
          item.requested
        )
    );

    const addsMatch = active.some(
      (item) =>
        !item.matchedBefore &&
        relatedLabel(
          product[item.field],
          item.requested
        )
    );

    return preservesMatches && addsMatch;
  });

  // Reuse the existing validation, hard filters and ranking.
  const { result } = searchWithValidatedPreferences(
    candidates,
    preferences,
    vocabulary
  );

  if (result.products.length === 0) {
    return reply(
      "no_upsell",
      "No higher-priced same-type item adds a requested match without losing an existing one within your budget. Your limits were not increased."
    );
  }

  const products: UpsellProduct[] = result.products.map(
    (product) => {
      const record = candidates.find(
        (candidate) =>
          candidate.product_id === product.product_id
      )!;

      const improved = active
        .filter(
          (item) =>
            !item.matchedBefore &&
            relatedLabel(
              record[item.field],
              item.requested
            )
        )
        .map(
          (item) =>
            `${item.field}: requested ${item.requested}; ` +
            `main item ${primary[item.field] ?? "not recorded"}; ` +
            `alternative ${record[item.field]}`
        );

      const unmatched = active
        .filter(
          (item) =>
            !relatedLabel(
              record[item.field],
              item.requested
            )
        )
        .map(
          (item) =>
            `${item.field}: requested ${item.requested}; ` +
            `alternative ${record[item.field] ?? "not recorded"}`
        );

      const extra =
        (cents(product.price_aud)! - primaryCents) / 100;

      return {
        ...product,
        extra_cost_aud: extra,
        improved_preferences: improved,
        unmatched_preferences: unmatched,

        explanation:
          `Optional replacement, A$${extra.toFixed(2)} more. ` +
          `Added catalogue matches: ${improved.join("; ")}.` +
          (
            unmatched.length
              ? ` Still not matched: ${unmatched.join("; ")}.`
              : ""
          ),
      };
    }
  );

  return reply(
    "options",
    "Optional higher-priced replacements within your existing budget. Each adds a requested catalogue-label match; remaining differences are listed. Nothing has been added to your cart.",
    products
  );
}