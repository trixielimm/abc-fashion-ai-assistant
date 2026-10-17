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
import { compareBenefits, meetsFeatureRequirements } from "./productBenefits";
import type { StylingState } from "../stylist/commerceSchema";

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
  vocabulary: CataloguePreferenceValues,
  options: { priorities?: StylingState["priorities"]; required_features?: StylingState["required_features"]; eligible?: (product: CatalogueProduct) => boolean; allowComparable?: boolean; allowRelatedTypes?: boolean } = {}
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

  if (preferences.max_price !== null && maximumCents === null) {
  return reply(
    "needs_more_detail",
    "The supplied maximum price must be a valid AUD amount with at most two decimal places."
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
  if (active.every((item) => item.matchedBefore) && !(options.priorities?.length)) {
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
      (!options.allowComparable && price <= primaryCents) ||
      (options.eligible && !options.eligible(product)) ||
      !meetsFeatureRequirements(product, options.required_features ?? []) ||
      (maximumCents !== null && price > maximumCents) ||
      identityFields.some(
        (field) =>
          !(field === "product_type" && options.allowRelatedTypes) &&
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

    return preservesMatches && (addsMatch || compareBenefits(primary, product, options.priorities ?? []).benefits.length > 0);
  });

  // Reuse the existing validation, hard filters and ranking.
  const { result } = searchWithValidatedPreferences(
    candidates,
    options.allowRelatedTypes ? { ...preferences, product_type: null } : preferences,
    vocabulary,
    { compare: (a, b) => {
      const benefitDifference = compareBenefits(primary, b, options.priorities ?? []).benefits.length - compareBenefits(primary, a, options.priorities ?? []).benefits.length;
      return benefitDifference || (a.price_aud ?? Infinity) - (b.price_aud ?? Infinity);
    } }
  );
  if (options.allowRelatedTypes) applied = { ...preferences, product_type: null };

  if (result.products.length === 0) {
    return reply(
      "no_upsell",
     "No additional replacement benefit could be established within your requirements. Missing feature information was not treated as proof of an improvement. Your existing choice remains valid."
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

      const featureComparison = compareBenefits(primary, record, options.priorities ?? []);
      const comparison = {
        ...featureComparison, primary_product_id: request.primary_product_id,
        primary_price_aud: primaryPrice!, extra_cost_aud: extra,
        context_benefits: improved,
        kind: extra > 0 ? "upgrade" as const : "alternative" as const,
      };
      const cost = extra > 0 ? `A$${extra.toFixed(2)} more` : extra < 0 ? `A$${(-extra).toFixed(2)} less` : "the same price";
      const benefitText = [...featureComparison.benefits.map(benefit => benefit.label), ...improved];
      return {
        ...product,
        value_comparison: comparison,
        extra_cost_aud: extra,
        improved_preferences: improved,
        unmatched_preferences: unmatched,

        explanation: `Optional replacement, ${cost}. Benefits: ${benefitText.join("; ")}.` +
          (featureComparison.tradeoffs.length ? ` Trade-offs: ${featureComparison.tradeoffs.join(" ")}` : "") +
          (unmatched.length ? ` Still not matched: ${unmatched.join("; ")}.` : ""),
      };
    }
  );

    return reply(
    "options",
    `Optional replacements${preferences.max_price === null ? "" : " within your existing budget"}. Each has a demonstrated customer-relevant benefit; price differences and trade-offs are listed. Nothing has been added to your cart.`,
    products
  );
}
