import { z } from "zod";

import {
  ShoppingPreferencesSchema,
  type ShoppingPreferences,
} from "../ai/preferenceSchema";

import type { CataloguePreferenceValues } from "../catalogue/preferenceValues";
import type { CatalogueProduct } from "../recommendations/catalogue";
import type { PreferenceSearchResult } from "./preferenceSearch";

import { searchWithValidatedPreferences } from "./validatedPreferenceSearch";
import { scoreCompatibility } from "./stylingCompatibility";
import { meetsFeatureRequirements } from "./productBenefits";
import type { StylingState } from "../stylist/commerceSchema";

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
  scopedPreferences?: ShoppingPreferences,
  options: { anchors?: readonly CatalogueProduct[]; external_anchors?: StylingState["external_items"]; eligible?: (product: CatalogueProduct) => boolean; required_features?: StylingState["required_features"]; occupied_categories?: string[] } = {}
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

  const record = catalogue.find(product => product.product_id === request.primary_product_id)!;
  const requested = scopedPreferences ? ShoppingPreferencesSchema.parse(scopedPreferences) : null;
  // An explicit target describes the requested addition, never the main item.
  // Stored rules guide discovery when no target has been stated.
  targetCategory = requested?.subcategory ?? requested?.category ??
    [...(record.pairing_categories ?? []), ...(record.cross_sell_category ? [record.cross_sell_category] : [])]
      .find(category => !(options.occupied_categories ?? []).some(owned => normalise(owned) === normalise(category))) ?? null;
  if (!targetCategory) return reply("no_rule", "No additional-item category is recorded. What would you like to add?");
  const targets = [...new Map(vocabulary.categories.filter(row =>
    normalise(row.subcategory ?? row.category) === normalise(targetCategory)
  ).map(row => [JSON.stringify(row), row])).values()];
  if (targets.length !== 1) return reply("rule_unavailable", "The additional-item category needs catalogue review.");
  const target = targets[0];
  if (normalise(target.category) === normalise(record.category) &&
      (!target.subcategory || normalise(target.subcategory) === normalise(record.subcategory))) {
    return reply("no_match", "That would repeat the selected item role. Please request a different additional item or ask for a replacement.");
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

  const anchors = [record, ...(options.anchors ?? []).filter(anchor => anchor.product_id !== record.product_id)];
  const scored = new Map(candidates.map(candidate => [candidate.product_id,
    scoreCompatibility(candidate, anchors, checked.data.occasion, options.external_anchors)]));
  // Anchor-aware scoring happens before the display cap and stock tie-breaks.

  const { validation, result } = searchWithValidatedPreferences(
    candidates,
    checked.data,
    vocabulary,
    {
      eligible: product => (!options.eligible || options.eligible(product)) &&
        meetsFeatureRequirements(product, options.required_features ?? []),
      compare: (a, b) => (scored.get(b.product_id)?.score ?? 0) - (scored.get(a.product_id)?.score ?? 0),
    }
  );

  const message =
    result.products.length > 0
      ? `Optional additions from the ${requested?.category || requested?.subcategory ? "requested" : "recorded"} ${targetCategory} category. ${result.message}`
      : result.message;

  return reply(
    result.status,
    message,
    result.products.map(product => {
      const evidence = scored.get(product.product_id)!.evidence;
      return { ...product, pairing_evidence: evidence,
        explanation: [...evidence.reasons.slice(0, 2), ...evidence.limitations.slice(0, 1),
          "This is a catalogue-based styling suggestion, not a guarantee of outfit compatibility."].join(" ") };
    }),
    result.status === "needs_more_detail"
      ? null
      : validation.preferences
  );
}

export function retrieveDescriptionCrossSell(
  catalogue: readonly CatalogueProduct[], preferences: ShoppingPreferences,
  vocabulary: CataloguePreferenceValues, external: StylingState["external_items"],
  eligible: (product: CatalogueProduct) => boolean
) {
  const scored = new Map(catalogue.map(product => [product.product_id,
    scoreCompatibility(product, [], preferences.occasion, external)]));
  const searched = searchWithValidatedPreferences(catalogue, preferences, vocabulary, {
    eligible,
    compare: (a, b) => (scored.get(b.product_id)?.score ?? 0) - (scored.get(a.product_id)?.score ?? 0),
  });
  return { ...searched, result: { ...searched.result, products: searched.result.products.map(product => {
    const evidence = scored.get(product.product_id)!.evidence;
    return { ...product, pairing_evidence: evidence,
      explanation: [...evidence.reasons.slice(0, 2), ...evidence.limitations].join(" ") };
  }) } };
}
