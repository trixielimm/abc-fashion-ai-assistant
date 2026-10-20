import type { CatalogueProduct } from "../recommendations/catalogue";
import type { ShoppingPreferences } from "../ai/preferenceSchema";
import type { ConversationPlanRequest } from "./conversationPlan";
import type { StylingState } from "./commerceSchema";
import { statedCombinedBudget } from "./combinedShoppingRequest";
import { priceCents } from "./outfitBudgetSchema";

export type PurchaseBudgetSummary = {
  version: "purchase-v1"; limit_aud: number; fixed_total_aud: number; remaining_aud: number;
  fixed_product_ids: string[]; minimum_total_aud: number | null; maximum_total_aud: number | null;
};
export function preparePurchaseBudget(catalogue: readonly CatalogueProduct[], request: ConversationPlanRequest,
  styling: StylingState, referenceIds: readonly string[], preferences: ShoppingPreferences) {
  const stated = statedCombinedBudget(request.message);
  const selected = styling.outfit.filter(piece => piece.ownership === "selected");
  const references = selected.filter(piece => referenceIds.includes(piece.product_id));
  const mentioned = styling.outfit.filter(piece => referenceIds.includes(piece.product_id));
  const previous = styling.purchase_budget;
  const inherited = request.styling?.outfit_request?.total_budget_aud;
  if (stated !== null && mentioned.length) {
    styling.purchase_budget = { limit_aud: stated, product_ids: [...new Set([...(previous?.product_ids ?? []), ...references.map(piece => piece.product_id)])] };
  } else if (!previous && inherited !== undefined && mentioned.length) {
    styling.purchase_budget = { limit_aud: inherited, product_ids: references.map(piece => piece.product_id) };
  }
  const budget = styling.purchase_budget;
  if (!budget) return null;
  budget.product_ids = budget.product_ids.filter(id => selected.some(piece => piece.product_id === id));
  const fixed = budget.product_ids.map(id => catalogue.find(product => product.product_id === id));
  if (fixed.some(product => !product || product.price_aud === null || !Number.isFinite(product.price_aud) || product.is_available !== true || (product.stock_qty ?? 0) <= 0)) {
    return { error: "I can't verify the current price and availability of a selected purchase. Refresh that piece before I claim a combined total." };
  }
  const fixedCents = fixed.reduce((sum, product) => sum + priceCents(product!.price_aud!), 0);
  const remaining = priceCents(budget.limit_aud) - fixedCents;
  if (remaining < 0) return { error: `Your selected purchases already total A$${(fixedCents / 100).toFixed(2)}, A$${(-remaining / 100).toFixed(2)} over the A$${budget.limit_aud.toFixed(2)} combined budget. Remove or replace a selected purchase, or explicitly change the total.` };
  styling.outfit = styling.outfit.map(piece => {
    const current = fixed.find(product => product?.product_id === piece.product_id);
    return current ? { ...piece, price_aud: current.price_aud! } : piece;
  });
  preferences.max_price = Math.min(preferences.max_price ?? Infinity, remaining / 100);
  const summary: PurchaseBudgetSummary = { version: "purchase-v1", limit_aud: budget.limit_aud,
    fixed_total_aud: fixedCents / 100, remaining_aud: remaining / 100,
    fixed_product_ids: [...budget.product_ids], minimum_total_aud: null, maximum_total_aud: null };
  return { summary };
}
export function completePurchaseBudget(summary: PurchaseBudgetSummary | null, products: readonly { price_aud: number }[]) {
  if (!summary) return null;
  const cents = products.map(product => priceCents(product.price_aud));
  return { ...summary,
    minimum_total_aud: cents.length ? (priceCents(summary.fixed_total_aud) + Math.min(...cents)) / 100 : null,
    maximum_total_aud: cents.length ? (priceCents(summary.fixed_total_aud) + Math.max(...cents)) / 100 : null };
}
