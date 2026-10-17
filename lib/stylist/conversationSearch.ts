import { ShoppingPreferencesSchema } from "../ai/preferenceSchema";
import { validatePreferences } from "../ai/validatePreferences";

import type { CatalogueProduct } from "../recommendations/catalogue";
import type { CataloguePreferenceValues } from "../catalogue/preferenceValues";
import { relatedLabel, type StylistProduct } from "../search/preferenceSearch";

import { searchWithValidatedPreferences } from "../search/validatedPreferenceSearch";
import { retrieveCrossSell, retrieveDescriptionCrossSell } from "../search/crossSell";
import { retrieveUpsell } from "../search/upsell";
import { searchCheaper } from "../search/cheaperSearch";
import { comparableFeatures, meetsFeatureRequirements } from "../search/productBenefits";

import {
  checkConversationPlan,
  ConversationPlanRequestSchema,
} from "./conversationPlan";

import { PreferenceScopesSchema } from "./preferenceScope";
import { searchOutfitBudget } from "../search/outfitBudgetSearch";
import type { OutfitBudget, OutfitChoices } from "./outfitBudgetSchema";
import { dressCodes, meetsDressCode } from "./dressCode";

type Status =
  | "matches"
  | "partial"
  | "no_match"
  | "no_action"
  | "needs_clarification"
  | "no_upsell"
  | "no_rule"
  | "rule_unavailable"
  | "primary_unavailable"
  | "primary_mismatch";

type Product = StylistProduct & {
  explanation?: string;
};

const normalise = (value: string | null) =>
  (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export function executeConversationSearch(
  catalogue: readonly CatalogueProduct[],
  input: unknown,
  modelPlan: unknown,
  vocabulary: CataloguePreferenceValues
) {
  const request = ConversationPlanRequestSchema.parse(input);
  const checked = checkConversationPlan(request, modelPlan);

  let applied = checked.preferences;
  const styling = checked.styling;
  let outfitBudget: OutfitBudget | null = null;
  let outfitChoices: OutfitChoices | null = null;
  const excluded = new Set([...styling.rejected_ids, ...(request.cart_product_ids ?? [])]);
  const eligible = (product: CatalogueProduct) => !excluded.has(product.product_id ?? "") &&
    (!styling.outfit_request || meetsDressCode(product, styling.dress_code)) &&
    meetsFeatureRequirements(product, styling.required_features) &&
    (["occasion", "style", "fit", "season"] as const).every(field =>
      checked.proposed_scopes.shared[field] === null || relatedLabel(product[field], checked.proposed_scopes.shared[field]!));

  function reply(
    status: Status,
    message: string,
    products: Product[] = [],
    targetCategory: string | null = null
  ) {
    if (status === "no_match" && styling.required_features.length) {
      message = `I couldn't verify an eligible item with these required features: ${styling.required_features.map(value => value.replaceAll("_", " ")).join(", ")}. Missing feature information is not proof that a product has or lacks them. Your requirements are still saved.`;
    }
    const scopes = PreferenceScopesSchema.parse(
      checked.proposed_scopes
    );

    // Remember derived item identity, not merged shared limits.
    if (applied !== null) {
      for (
        const field of [
          "category",
          "subcategory",
          "product_type",
        ] as const
      ) {
        if (
          scopes.item[field] === null &&
          applied[field] !== null
        ) {
          Object.assign(scopes.item, {
            [field]: applied[field],
          });
        }
      }
    }

    return {
      status,
      action: checked.action,
      message,
      reference_product_ids: checked.reference_product_ids,
      proposed_scopes: scopes,
      styling,
      outfit_budget: outfitBudget,
      outfit_choices: outfitChoices,
      feature_data_status: catalogue.find(product => product.feature_data_status)?.feature_data_status,
      comparison_reference_id: checked.action === "upsell" ? checked.reference_product_ids[0] ?? null : null,
      applied_preferences: applied,

      budget_scope:
        styling.outfit_request && ["new_search", "refine"].includes(checked.action) ? "combined_outfit" : checked.action === "cross_sell"
          ? "per_additional_item"
          : checked.action === "upsell"
            ? "per_replacement_item"
            : "per_item",

      target_category: targetCategory,
      products,
    };
  }

  if (checked.status === "no_action") {
    return reply("no_action", modelPlan && typeof modelPlan === "object" && "styling_intent" in modelPlan && modelPlan.styling_intent
      ? "Updated your outfit choices and styling preferences. Your cart is unchanged." : checked.message);
  }

  if (
    checked.status === "needs_clarification" ||
    applied === null
  ) {
    return reply("needs_clarification", checked.message);
  }

  // Validate before any shortlist, including direct API requests.
  const validation = validatePreferences(applied, vocabulary);
  applied = validation.preferences;

  if (validation.needs_clarification) {
    return reply(
      "needs_clarification",
      validation.issues
        .filter((issue) => issue.blocking)
        .map(
          (issue) =>
            `${issue.field}: ${issue.value}. ${issue.reason}`
        )
        .join(" ")
    );
  }

  if (styling.outfit_request && ["new_search", "refine"].includes(checked.action)) {
    const result = searchOutfitBudget(catalogue, styling.outfit_request, applied, vocabulary, eligible);
    outfitBudget = result.outfit_budget;
    outfitChoices = result.outfit_choices;
    const code = dressCodes.find(code => code.value === styling.dress_code);
    return reply(result.status, code ? `${code.label}: ${code.guidance}\n\n${result.message}` : result.message, result.products);
  }

  const contextProducts = [
    ...(request.context.focused
      ? [request.context.focused]
      : []),
    ...request.context.latest,
    ...(request.context.previous?.flat() ?? []),
    ...(request.context.comparison ? [request.context.comparison] : []),
    ...(request.context.selected ?? []),
  ];

  const references: CatalogueProduct[] = [];

  for (const id of checked.reference_product_ids) {
    const product = catalogue.find(
      (row) => row.product_id === id
    );

    const snapshots = contextProducts.filter(
      (row) => row.product_id === id
    );

    const fields = [
      "product_name",
      "category",
      "subcategory",
      "product_type",
    ] as const;

    if (
      !product ||
      snapshots.length === 0 ||
      product.is_available !== true ||
      typeof product.stock_qty !== "number" ||
      !Number.isSafeInteger(product.stock_qty) ||
      product.stock_qty <= 0 ||
      snapshots.some((snapshot) =>
        fields.some(
          (field) =>
            normalise(snapshot[field]) !==
            normalise(product[field])
        )
      )
    ) {
      return reply(
        "needs_clarification",
        "A referenced product is unavailable or its details changed. Refresh the product results before continuing."
      );
    }

    references.push(product);
  }

  if (checked.action === "cross_sell") {
    if (!references.length && styling.external_items.length) {
      if (!applied.category) return reply("needs_clarification", "What would you like to add to the item you described: shoes, a bag or an accessory?");
      const result = retrieveDescriptionCrossSell(catalogue, applied, vocabulary, styling.external_items, eligible);
      applied = result.validation.preferences;
      return reply(result.result.status === "needs_more_detail" ? "needs_clarification" : result.result.status,
        result.result.message, result.result.products, applied.category);
    }
    if (references.length !== 1) {
      return reply(
        "needs_clarification",
        "Which main product should the extra accompany?"
      );
    }
    if (styling.outfit.some(piece => !catalogue.some(product => product.product_id === piece.product_id &&
        normalise(product.product_name) === normalise(piece.product_name) && normalise(product.category) === normalise(piece.category)))) {
      return reply("needs_clarification", "A kept outfit piece can no longer be verified. Remove it from the outfit or refresh its product details before styling the remaining pieces.");
    }

    const result = retrieveCrossSell(
      catalogue,
      {
        primary_product_id:
          checked.reference_product_ids[0],
      },
      vocabulary,
      applied,
      {
        eligible: product => eligible(product) && !styling.outfit.some(piece => piece.product_id === product.product_id),
        required_features: styling.required_features,
        anchors: styling.outfit.flatMap(piece => catalogue.filter(product => product.product_id === piece.product_id)),
        external_anchors: styling.external_items,
        occupied_categories: [...styling.owned_categories, ...styling.outfit.map(piece => piece.category).filter((value): value is NonNullable<typeof value> => value !== null)],
      }
    );

    applied = result.applied_preferences ?? applied;

    return reply(
      result.status === "needs_more_detail"
        ? "needs_clarification"
        : result.status,
      result.message,
      result.products,
      result.target_category
    );
  }

  if (
    references.length > 0 &&
    ["cheaper", "upsell", "refine"].includes(checked.action)
  ) {
    // Fill missing identity only when all references agree.
    // Never copy a product's price, size, colour or material
    // into the customer's preferences.
    const inferred = { ...applied };

    for (
      const field of [
        "category",
        "subcategory",
        "product_type",
      ] as const
    ) {
      const value = references[0][field];

      if (
        inferred[field] === null &&
        value !== null &&
        references.every(
          (row) =>
            normalise(row[field]) === normalise(value)
        )
      ) {
        Object.assign(inferred, { [field]: value });
      }
    }

    applied = ShoppingPreferencesSchema.parse(inferred);
  }

  if (checked.action === "cheaper") {
    const prices = checked.reference_product_ids.map((id) => {
      const snapshots = contextProducts.filter(
        (row) => row.product_id === id
      );

      const price = snapshots[0]?.price_aud;

      return {
        product_id: id,
        displayed_price_aud: price,
        consistent:
          price !== undefined &&
          snapshots.every(
            (row) => row.price_aud === price
          ),
      };
    });

    if (
      prices.length === 0 ||
      prices.some((row) => !row.consistent)
    ) {
      return reply(
        "needs_clarification",
        "The displayed reference prices are missing or inconsistent. Refresh the product results; no budget is required."
      );
    }

    const result = searchCheaper(
      catalogue.filter(product => references.some(reference => reference.product_id === product.product_id) || eligible(product)),
      applied,
      prices.map(
        ({ product_id, displayed_price_aud }) => ({
          product_id,
          displayed_price_aud,
        })
      ),
      vocabulary
    );

    return reply(
      result.status === "needs_more_detail"
        ? "needs_clarification"
        : result.status,
      result.message,
      result.products
    );
  }

  if (checked.action === "upsell") {
    if (references.length !== 1) {
      return reply(
        "needs_clarification",
        "Which item should I compare replacements for?"
      );
    }

    const result = retrieveUpsell(
      catalogue,
      {
        primary_product_id:
          checked.reference_product_ids[0],
        preferences: applied,
      },
      vocabulary,
      { priorities: styling.priorities, required_features: styling.required_features, eligible, allowComparable: true,
        allowRelatedTypes: request.scopes.item.product_type === null }
    );

    applied = result.applied_preferences ?? applied;

    if (result.status === "no_upsell" && styling.priorities.includes("closure")) {
      const original = comparableFeatures(references[0]).find(feature => feature.feature_key === "zip_closure");
      const candidates = searchWithValidatedPreferences(catalogue.filter(product =>
        product.product_id !== references[0].product_id), applied, vocabulary, { eligible }).result.products;
      const same = original && candidates.length && candidates.every(product => {
        const record = catalogue.find(row => row.product_id === product.product_id)!;
        return comparableFeatures(record).some(feature => feature.feature_key === "zip_closure" && feature.value === original.value);
      });
      if (same) result.message = `The original and the eligible replacements have the same recorded zip closure (${original.value ? "Yes" : "No"}). Spending more does not demonstrate an improvement in closure. ${result.message}`;
      else if (original) result.message = `The original's recorded zip closure is ${original.value ? "Yes" : "No"}. No additional closure benefit could be established within your requirements. ${result.message}`;
    }

    return reply(
      result.status === "options"
        ? result.products.some(
            (product) =>
              product.unmatched_preferences.length > 0
          )
          ? "partial"
          : "matches"
        : result.status === "needs_more_detail"
          ? "needs_clarification"
          : result.status,
      result.message,
      result.products
    );
  }

  const result = searchWithValidatedPreferences(
    catalogue,
    applied,
    vocabulary,
    { eligible }
  );

  applied = result.validation.preferences;

  return reply(
    result.result.status === "needs_more_detail"
      ? "needs_clarification"
      : result.result.status,
    result.result.message,
    result.result.products
  );
}
