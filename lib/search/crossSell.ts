import { z } from "zod";

import {
  ShoppingPreferencesSchema,
  type ShoppingPreferences,
} from "../ai/preferenceSchema";

import type { CataloguePreferenceValues } from "../catalogue/preferenceValues";
import type { CatalogueProduct } from "../recommendations/catalogue";
import type { PreferenceSearchResult } from "./preferenceSearch";

import { searchWithValidatedPreferences } from "./validatedPreferenceSearch";

const label = z.string().trim().min(1).max(100);

// These preferences apply to the ADDITIONAL item, not the main item.
export const CrossSellRequestSchema = z.strictObject({
  primary_product_id: label,
  max_price: z.number().nonnegative().nullable().default(null),
  size: label.nullable().default(null),
  gender: ShoppingPreferencesSchema.shape.gender.default(null),
  occasion: label.nullable().default(null),
  style: label.nullable().default(null),
  preferred_colours: z.array(label).max(10).default([]),
  excluded_colours: z.array(label).max(10).default([]),
  excluded_product_ids: z.array(label).max(50).default([]),
});

const PrimarySchema = z.object({
  product_id: label,
  product_name: z.string().trim().min(1),
  price_aud: z.number().nonnegative(),
  stock_qty: z.number().int().positive(),
  is_available: z.literal(true),
  sizes_available: z.array(z.string().trim().min(1)).min(1),
  cross_sell_category: z.string().nullable(),
});

type CrossSellStatus =
  | PreferenceSearchResult["status"]
  | "primary_unavailable"
  | "no_rule"
  | "rule_unavailable";

export type CrossSellResult = {
  status: CrossSellStatus;
  message: string;
  primary_product_id: string;
  target_category: string | null;
  budget_scope: "per_additional_item";
  applied_preferences: ShoppingPreferences | null;
  products: PreferenceSearchResult["products"];
};

function normalise(value: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function retrieveCrossSell(
  catalogue: readonly CatalogueProduct[],
  input: unknown,
  vocabulary: CataloguePreferenceValues,
  scopedPreferences?: ShoppingPreferences
): CrossSellResult {
  const request = CrossSellRequestSchema.parse(input);

  let targetCategory: string | null = null;

  function reply(
    status: CrossSellStatus,
    message: string,
    products: PreferenceSearchResult["products"] = [],
    applied: ShoppingPreferences | null = null
  ): CrossSellResult {
    return {
      status,
      message,
      primary_product_id: request.primary_product_id,
      target_category: targetCategory,
      budget_scope: "per_additional_item",
      applied_preferences: applied,
      products,
    };
  }

  // Read the current catalogue record, not client-supplied product facts.
  const primary = PrimarySchema.safeParse(
    catalogue.find(
      (product) => product.product_id === request.primary_product_id
    )
  );

  if (!primary.success) {
    return reply(
      "primary_unavailable",
      "The main product is not currently available to cross-sell from."
    );
  }

  targetCategory = primary.data.cross_sell_category?.trim() || null;

  if (!targetCategory) {
    return reply(
      "no_rule",
      "No cross-sell category is recorded for this product. No category was guessed."
    );
  }

  // Resolve a stored top-level category OR a subcategory.
  const relationships = vocabulary.categories.filter(
    (row) =>
      normalise(row.subcategory ?? row.category) ===
      normalise(targetCategory)
  );

  const targets = [
    ...new Map(
      relationships.map((row) => [JSON.stringify(row), row])
    ).values(),
  ];

  if (targets.length !== 1) {
    return reply(
      "rule_unavailable",
      "The recorded cross-sell category needs catalogue review."
    );
  }

  const target = targets[0];

  // Unknown size is allowed during discovery. The cart resolves variants.

  // The conversation route may supply its complete, scoped preferences.
const requested = scopedPreferences
  ? ShoppingPreferencesSchema.parse(scopedPreferences)
  : null;

if (
  requested &&
  (
    (requested.category !== null &&
      normalise(requested.category) !== normalise(target.category)) ||
    (requested.subcategory !== null && target.subcategory !== null &&
      normalise(requested.subcategory) !== normalise(target.subcategory))
  )
) {
  return reply(
    "no_rule",
    `The recorded cross-sell target is ${targetCategory}, not the requested item category. No different category was substituted.`
  );
}

const checked = ShoppingPreferencesSchema.safeParse({
  ...(requested ?? {
    gender: request.gender,
    product_type: null,
    occasion: request.occasion,
    style: request.style,
    preferred_colours: request.preferred_colours,
    excluded_colours: request.excluded_colours,
    season: null,
    material: null,
    fit: null,
    size: request.size,
    min_price: null,
    max_price: request.max_price,
    brand_line: null,
  }),
  category: target.category,
  subcategory: requested?.subcategory ?? target.subcategory,
});

  if (!checked.success) {
    return reply(
      "rule_unavailable",
      "The cross-sell category is not supported by the current preference schema."
    );
  }

  const excludedIds = new Set([
    request.primary_product_id,
    ...request.excluded_product_ids,
  ]);

  // Apply the rule and exclude unwanted IDs BEFORE shortlisting.
  const candidates = catalogue.filter(
    (product) =>
      !excludedIds.has(product.product_id ?? "") &&
      normalise(product.category) === normalise(target.category) &&
      (
        target.subcategory === null ||
        normalise(product.subcategory) === normalise(target.subcategory)
      )
  );

  // Reuse the validation, hard filtering and ranking you already corrected.
  const { validation, result } = searchWithValidatedPreferences(
    candidates,
    checked.data,
    vocabulary
  );

  const message =
    result.products.length > 0
      ? `Optional additions from the recorded ${targetCategory} cross-sell category. ${result.message}`
      : result.message;

  return reply(
    result.status,
    message,
    result.products,
    result.status === "needs_more_detail"
      ? null
      : validation.preferences
  );
}