import {
  ShoppingPreferencesSchema,
  type ShoppingPreferences,
} from "../ai/preferenceSchema";

import {
  buildCrossSellRequest,
  readCrossSellResponse,
  type CrossSellCardProduct,
} from "../search/crossSellClient";

import {
  buildUpsellRequest,
  readUpsellResponse,
} from "../search/upsellClient";

export type ActionProduct = CrossSellCardProduct & {
  explanation?: string;
};

export type ProductActionKind = "cross_sell" | "upsell";

export type ProductAction = {
  kind: ProductActionKind;
  product: ActionProduct;
  preferences: ShoppingPreferences;
};

type ActionReply = {
  message: string;
  products: ActionProduct[];
  preferences: ShoppingPreferences | null;
};

export class ProductActionInputError extends Error {}

// A single remaining clothing size must not be assumed to fit.
export function automaticCartSize(
  sizes: readonly string[]
): string | null {
  if (sizes.length !== 1) return null;

  return sizes[0].trim().replace(/\s+/g, " ").toLowerCase() === "one size"
    ? sizes[0]
    : null;
}

export function prepareProductAction(action: ProductAction) {
  const preferences = ShoppingPreferencesSchema.parse(
    action.preferences
  );

  const product = action.product;

  if (action.kind === "cross_sell") {
    if (
      preferences.min_price !== null ||
      preferences.material ||
      preferences.brand_line ||
      preferences.fit ||
      preferences.season
    ) {
      throw new ProductActionInputError(
        "I cannot yet carry the saved minimum-price, material, brand, fit or season requirements into this extra-item search. I have not dropped those preferences or searched with weaker filters."
      );
    }

    // Until context scope is added, retain a supplied maximum.
    // Never invent one or reuse clothing size for another category.
    const body = buildCrossSellRequest(
      product.product_id,
      preferences.max_price === null
        ? ""
        : String(preferences.max_price),
      null,
      preferences
    );

    return {
      endpoint: "/api/cross-sell" as const,
      body,

      read(input: unknown): ActionReply {
        const result = readCrossSellResponse(input, body);

        const budgetNote = body.max_price === null
          ? "No maximum price was supplied for these extras."
          : `I kept the saved A$${body.max_price.toFixed(2)} per-item maximum for these extras.`;

        return {
          message:
            `For ${product.product_name}: ${result.message} ${budgetNote}`,
          products: result.products,
          preferences: result.applied_preferences,
        };
      },
    };
  }

  const body = buildUpsellRequest(
    product.product_id,
    preferences
  );

  return {
    endpoint: "/api/upsell" as const,
    body,

    read(input: unknown): ActionReply {
      const result = readUpsellResponse(input, body, product);

      return {
        message:
          `For ${product.product_name}: ${result.message} Adding an alternative does not remove any existing cart item.`,
        products: result.products,
        preferences: result.applied_preferences,
      };
    },
  };
}