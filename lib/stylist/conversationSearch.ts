import { ShoppingPreferencesSchema } from "../ai/preferenceSchema";
import { validatePreferences } from "../ai/validatePreferences";

import type { CatalogueProduct } from "../recommendations/catalogue";
import type { CataloguePreferenceValues } from "../catalogue/preferenceValues";
import type { StylistProduct } from "../search/preferenceSearch";

import { searchWithValidatedPreferences } from "../search/validatedPreferenceSearch";
import { retrieveCrossSell } from "../search/crossSell";
import { retrieveUpsell } from "../search/upsell";
import { searchCheaper } from "../search/cheaperSearch";

import {
  checkConversationPlan,
  ConversationPlanRequestSchema,
} from "./conversationPlan";

import { PreferenceScopesSchema } from "./preferenceScope";

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

  function reply(
    status: Status,
    message: string,
    products: Product[] = [],
    targetCategory: string | null = null
  ) {
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
      applied_preferences: applied,

      budget_scope:
        checked.action === "cross_sell"
          ? "per_additional_item"
          : checked.action === "upsell"
            ? "per_replacement_item"
            : "per_item",

      target_category: targetCategory,
      products,
    };
  }

  if (checked.status === "no_action") {
    return reply("no_action", checked.message);
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

  const contextProducts = [
    ...(request.context.focused
      ? [request.context.focused]
      : []),
    ...request.context.latest,
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
    if (references.length !== 1) {
      return reply(
        "needs_clarification",
        "Which main product should the extra accompany?"
      );
    }

    const result = retrieveCrossSell(
      catalogue,
      {
        primary_product_id:
          checked.reference_product_ids[0],
      },
      vocabulary,
      applied
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
      catalogue,
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
      vocabulary
    );

    applied = result.applied_preferences ?? applied;

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
    vocabulary
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