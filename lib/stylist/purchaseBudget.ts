import type { CatalogueProduct } from "../recommendations/catalogue";
import type { ShoppingPreferences } from "../ai/preferenceSchema";
import type { ConversationPlanRequest } from "./conversationPlan";
import type { StylingState } from "./commerceSchema";
import { statedCombinedBudget } from "./combinedShoppingRequest";
import { priceCents } from "./outfitBudgetSchema";

export type PurchaseBudgetSummary = {
  version: "purchase-v1"; limit_aud: number; fixed_total_aud: number; remaining_aud: number;
  fixed_product_ids: string[]; minimum_total_aud: number | null; maximum_total_aud: number | null;
  example_items: { product_id: string; price_aud: number }[];
};
// Current catalogue prices only. Owned items are excluded by the caller.
export function currentPurchaseTotal(catalogue: readonly CatalogueProduct[], ids: readonly string[]) {
  const products = [...new Set(ids)].map(id => catalogue.find(product => product.product_id === id));
  if (products.some(product => !product || product.price_aud === null || !Number.isFinite(product.price_aud) ||
      product.is_available !== true || !Number.isInteger(product.stock_qty) || (product.stock_qty ?? 0) <= 0)) return null;
  return products.reduce((sum, product) => sum + priceCents(product!.price_aud!), 0) / 100;
}
export function preparePurchaseBudget(catalogue: readonly CatalogueProduct[], request: ConversationPlanRequest,
  styling: StylingState, referenceIds: readonly string[], preferences: ShoppingPreferences) {
  const stated = statedCombinedBudget(request.message);
  const selected = styling.outfit.filter(piece => piece.ownership === "selected");
  const references = selected.filter(piece => referenceIds.includes(piece.product_id));
  const previous = styling.purchase_budget;
  const inherited = request.styling?.outfit_request?.total_budget_aud ?? request.task?.brief.total_budget_aud;
  const examples = referenceIds.filter(id => !styling.outfit.some(piece => piece.product_id === id));
  if (stated !== null && referenceIds.length) {
    styling.purchase_budget = { limit_aud: stated, product_ids: [...new Set([...(previous?.product_ids ?? []), ...references.map(piece => piece.product_id)])],
      example_product_ids: examples };
  } else if (!previous && inherited !== undefined && inherited !== null && referenceIds.length) {
    styling.purchase_budget = { limit_aud: inherited, product_ids: references.map(piece => piece.product_id), example_product_ids: examples };
  } else if (previous && examples.length) {
    previous.example_product_ids = examples;
  }
  const budget = styling.purchase_budget;
  if (!budget) return null;
  budget.product_ids = [...new Set([...budget.product_ids, ...budget.example_product_ids])].filter(id => selected.some(piece => piece.product_id === id));
  budget.example_product_ids = budget.example_product_ids.filter(id => !styling.outfit.some(piece => piece.product_id === id));
  const fixedIds = [...new Set([...budget.product_ids, ...budget.example_product_ids])];
  if (fixedIds.length > 8) return { error: "Please plan up to eight purchases at a time so I can verify the combined budget." };
  const fixed = fixedIds.map(id => catalogue.find(product => product.product_id === id));
  const fixedTotal = currentPurchaseTotal(catalogue, fixedIds);
  if (fixedTotal === null) {
    return { error: "I can't verify the current price and availability of a selected or example purchase. Refresh that piece before I claim a combined total." };
  }
  const fixedCents = priceCents(fixedTotal);
  const remaining = priceCents(budget.limit_aud) - fixedCents;
  if (remaining < 0) return { error: `Your ${budget.example_product_ids.length ? "selected and example" : "selected"} purchases already total A$${(fixedCents / 100).toFixed(2)}, A$${(-remaining / 100).toFixed(2)} over the A$${budget.limit_aud.toFixed(2)} combined budget. Remove or replace a piece, or explicitly change the total.` };
  styling.outfit = styling.outfit.map(piece => {
    const current = fixed.find(product => product?.product_id === piece.product_id);
    return current ? { ...piece, price_aud: current.price_aud! } : piece;
  });
  preferences.max_price = Math.min(preferences.max_price ?? Infinity, remaining / 100);
  const summary: PurchaseBudgetSummary = { version: "purchase-v1", limit_aud: budget.limit_aud,
    fixed_total_aud: fixedCents / 100, remaining_aud: remaining / 100,
    fixed_product_ids: fixedIds, minimum_total_aud: null, maximum_total_aud: null,
    example_items: fixed.filter(product => budget.example_product_ids.includes(product!.product_id!))
      .map(product => ({ product_id: product!.product_id!, price_aud: product!.price_aud! })) };
  return { summary };
}
export function completePurchaseBudget(summary: PurchaseBudgetSummary | null, products: readonly { price_aud: number }[]) {
  if (!summary) return null;
  const cents = products.map(product => priceCents(product.price_aud));
  return { ...summary,
    minimum_total_aud: cents.length ? (priceCents(summary.fixed_total_aud) + Math.min(...cents)) / 100 : null,
    maximum_total_aud: cents.length ? (priceCents(summary.fixed_total_aud) + Math.max(...cents)) / 100 : null };
}
