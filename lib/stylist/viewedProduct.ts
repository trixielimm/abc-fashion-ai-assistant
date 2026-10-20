import { z } from "zod";

import {
  ShoppingPreferencesSchema,
  type ShoppingPreferences,
} from "../ai/preferenceSchema";

import {
  rememberPriceContext,
  type PriceContext,
} from "./priceContext";

const PageProductSchema = z.object({
  product_id: z.string().trim().min(1),
  product_name: z.string().trim().min(1),
  price_aud: z.number().nonnegative(),
  category: ShoppingPreferencesSchema.shape.category.unwrap(),
  subcategory: z.string().nullable(),
  product_type: z.string().nullable(),
  brand_line: z.string().nullable(),
  colour: z.string().nullable(),
  sizes_available: z.array(z.string().trim().min(1)).min(1),
});

const AvailablePageProductSchema = PageProductSchema.extend({
  is_available: z.literal(true),
  stock_qty: z.number().int().positive(),
});

export type ViewedProduct = z.infer<typeof PageProductSchema>;

export type ViewedPageContext = {
  key: number;
  pathname: string;
  product: ViewedProduct;
};

// Called with a real catalogue record by the product page.
export function readViewedProduct(
  input: unknown
): ViewedProduct | null {
  const checked = AvailablePageProductSchema.safeParse(input);

  return checked.success
    ? PageProductSchema.parse(checked.data)
    : null;
}

export function preferencesForViewedProduct(
  product: ViewedProduct,
  saved: ShoppingPreferences | null
): ShoppingPreferences {
  const previous = ShoppingPreferencesSchema.parse(saved ?? {
    gender: null,
    category: null,
    subcategory: null,
    product_type: null,
    occasion: null,
    style: null,
    preferred_colours: [],
    excluded_colours: [],
    season: null,
    material: null,
    fit: null,
    size: null,
    min_price: null,
    max_price: null,
    brand_line: null,
  });

  return {
    ...previous,

    // The page identifies the item, not a new budget or style.
    category: product.category,
    subcategory: product.subcategory,
    product_type: product.product_type,

    // Do not transfer clothing size to shoes or another category.
    size:
      previous.category === product.category
        ? previous.size
        : null,
  };
}

export function chooseCheaperContext(
  latest: PriceContext | null,
  page: ViewedPageContext | null,
  consumedPageKey: number | null,
  saved: ShoppingPreferences | null
): {
  context: PriceContext | null;
  pageKey: number | null;
} {
  if (page && page.key !== consumedPageKey) {
    return {
      context: rememberPriceContext(
        [page.product],
        preferencesForViewedProduct(page.product, saved)
      ),
      pageKey: page.key,
    };
  }

  // Once the page has been used, follow the latest conversation result.
  // Do not resurrect the page after an empty or failed search.
  return {
    context: latest,
    pageKey: page?.key ?? null,
  };
}