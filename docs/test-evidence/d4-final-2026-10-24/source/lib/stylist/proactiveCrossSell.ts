import type { CatalogueProduct } from "../recommendations/catalogue";
import type { CataloguePreferenceValues } from "../catalogue/preferenceValues";
import { retrieveCrossSell } from "../search/crossSell";
import { pairingCategoryNames, pairingRoleOccupied, resolvePairingTarget } from "../search/pairingTargets";
import { searchWithValidatedPreferences } from "../search/validatedPreferenceSearch";
import { relatedLabel } from "../search/preferenceSearch";
import { catalogueImageSource } from "./catalogueImages";
import { ChatProductSchema, ComplementaryOfferSchema, type ChatProduct, type ComplementaryOffer, type ConversationTurn, type TurnReply } from "./conversationProtocol";
import { emptyShoppingPreferences, composePreferences } from "./preferenceScope";
import { currentPurchaseTotal } from "./purchaseBudget";
import { priceCents } from "./outfitBudgetSchema";
import { explicitNoExtras } from "./offerPreferences";
import { ShoppingPreferencesSchema } from "../ai/preferenceSchema";
import { excludedByShoppingContext } from "./shoppingContext";

export function proactiveOffersEnabled() {
  return process.env.STYLIST_PROACTIVE_CROSS_SELL_ENABLED !== "false" && process.env.STYLIST_COMMERCE_ENABLED !== "false";
}

function presentProduct(record: CatalogueProduct, product: Record<string, unknown> = {}): ChatProduct {
  return ChatProductSchema.parse({
    product_id: record.product_id, product_name: record.product_name, price_aud: record.price_aud,
    category: record.category, subcategory: record.subcategory, product_type: record.product_type,
    brand_line: record.brand_line, colour: record.colour, sizes_available: record.sizes_available,
    ...product, occasion: record.occasion, style: record.style, image_src: catalogueImageSource(record), extra_target: null,
  });
}

type OfferSource = Pick<TurnReply, "action" | "status" | "products" | "applied_preferences" | "proposed_scopes" | "styling" | "pending" | "pending_answer" | "unverified_requirements" | "outfit_budget">;

// This planner is read-only: it never executes another conversation action,
// changes the item's filters, or selects an example dress on the customer's behalf.
export function buildComplementaryOffer(catalogue: readonly CatalogueProduct[], turn: ConversationTurn,
  source: OfferSource, vocabulary: CataloguePreferenceValues, refreshAnchorId?: string): ComplementaryOffer | null {
  if (!proactiveOffersEnabled() || source.styling.offers_paused || explicitNoExtras(turn.message) ||
      turn.task?.complementary_dismissed || !refreshAnchorId && turn.task?.complementary_shown ||
      !["new_search", "refine"].includes(source.action) || !["matches", "partial"].includes(source.status) ||
      !source.products.length || !source.applied_preferences?.occasion || source.pending || source.pending_answer ||
      source.unverified_requirements.length || source.proposed_scopes.unresolved_item.length ||
      source.proposed_scopes.unresolved_shared.length || source.styling.outfit_request || source.outfit_budget ||
      turn.preview_other_colours) return null;

  const { styling, proposed_scopes: scopes, applied_preferences: applied } = source;
  const displayed = source.products.filter(product => !product.unverified_requirements.length);
  const selected = displayed.find(product => styling.outfit.some(piece => piece.product_id === product.product_id));
  const candidates = refreshAnchorId ? displayed.filter(product => product.product_id === refreshAnchorId)
    : selected ? [selected, ...displayed.filter(product => product.product_id !== selected.product_id)] : displayed;
  const occupied = [...styling.owned_categories, ...styling.outfit.flatMap(piece => piece.category ? [piece.category] : []),
    ...styling.external_items.map(piece => piece.category)];
  const excluded = [...new Set([...styling.rejected_ids, ...(turn.cart_product_ids ?? []),
    ...styling.outfit.map(piece => piece.product_id), ...displayed.map(product => product.product_id)])];

  for (const anchor of candidates) {
    const record = catalogue.find(product => product.product_id === anchor.product_id);
    if (!record) continue;
    const ownership = styling.outfit.find(piece => piece.product_id === anchor.product_id)?.ownership ?? "example";
    const baseIds = [...styling.outfit.filter(piece => piece.ownership === "selected").map(piece => piece.product_id),
      ...(ownership === "owned" ? [] : [anchor.product_id])];
    const base = currentPurchaseTotal(catalogue, baseIds);
    if (base === null) continue;
    const limit = styling.purchase_budget?.limit_aud ?? turn.task?.brief.total_budget_aud ?? null;
    if (limit !== null && priceCents(base) >= priceCents(limit)) continue;
    const items: ComplementaryOffer["items"] = [];
    let extraCents = 0;
    const roles: string[] = [...occupied];
    for (const name of pairingCategoryNames(record)) {
      if (items.length >= 2) break;
      if (pairingRoleOccupied(name, roles, vocabulary)) continue;
      const target = resolvePairingTarget(name, vocabulary);
      if (!target || target.category === record.category) continue;
      // The shared scope applies across categories; the original dress's size,
      // material, colour and price do not become accessory requirements.
      const preferences = ShoppingPreferencesSchema.parse({ ...emptyShoppingPreferences(), ...scopes.shared, ...target,
        gender: scopes.shared.gender ?? applied.gender,
        occasion: scopes.shared.occasion ?? applied.occasion });
      if (turn.task?.brief.gift_recipient && !preferences.preferred_colours.length) preferences.preferred_colours = [...applied.preferred_colours];
      if (limit !== null) preferences.max_price = Math.min(preferences.max_price ?? Infinity,
        (priceCents(limit) - priceCents(base) - extraCents) / 100);
      if (preferences.max_price !== null && preferences.max_price < (preferences.min_price ?? 0)) continue;
      const found = retrieveCrossSell(catalogue, {
        primary_product_id: anchor.product_id, excluded_product_ids: [...excluded, ...items.map(item => item.product.product_id)].slice(0, 50),
      }, vocabulary, preferences, {
        occupied_categories: roles,
        required_features: styling.required_features,
        external_anchors: styling.external_items,
        anchors: catalogue.filter(product => styling.outfit.some(piece => piece.product_id === product.product_id)),
        // Shared context is a restriction, and the occasion must be supported.
        eligible: product => !excluded.includes(product.product_id ?? "") && !excludedByShoppingContext(product, turn.task?.brief.excluded_roles) &&
          (!turn.task?.brief.uncertain_recipient_size || Boolean(product.sizes_available?.some(size => /^one size$/i.test(size)))) && (["occasion", "style", "fit", "season"] as const).every(field =>
          !preferences[field] || relatedLabel(product[field], preferences[field])),
      });
      const match = found.products.find(product => product.pairing_evidence?.level === "catalogue_supported");
      const current = match && catalogue.find(product => product.product_id === match.product_id);
      if (!match || !current || !found.applied_preferences) continue;
      items.push({ product: presentProduct(current, { ...match,
        explanation: match.pairing_evidence!.reasons[0] }), preferences: found.applied_preferences });
      extraCents += priceCents(match.price_aud);
      roles.push(target.category);
    }
    if (items.length) return ComplementaryOfferSchema.parse({ anchor, anchor_ownership: ownership, items,
      combined_limit_aud: limit, base_total_aud: base, extras_total_aud: extraCents / 100,
      total_aud: (priceCents(base) + extraCents) / 100 });
  }
  return null;
}

export function refreshOfferSource(catalogue: readonly CatalogueProduct[], turn: ConversationTurn,
  vocabulary: CataloguePreferenceValues): OfferSource | null {
  if (!turn.offer_anchor_id || turn.pending || turn.pending_answer ||
      !turn.context.latest.some(product => product.product_id === turn.offer_anchor_id)) return null;
  const composed = composePreferences(turn.scopes);
  if (composed.status !== "ready") return null;
  const record = catalogue.find(product => product.product_id === turn.offer_anchor_id);
  if (!record) return null;
  const searched = searchWithValidatedPreferences([record], composed.preferences, vocabulary);
  if (!searched.result.products.length) return null;
  return { action: "refine", status: "matches", products: [presentProduct(record)], applied_preferences: composed.preferences,
    proposed_scopes: turn.scopes, styling: turn.styling!, pending: null, pending_answer: null,
    unverified_requirements: [], outfit_budget: null };
}
