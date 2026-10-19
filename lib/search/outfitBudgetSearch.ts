import type { CatalogueProduct } from "../recommendations/catalogue";
import type { CataloguePreferenceValues } from "../catalogue/preferenceValues";
import type { ShoppingPreferences } from "../ai/preferenceSchema";
import { composePreferences, createPreferenceScopes } from "../stylist/preferenceScope";
import { type OutfitBudget, type OutfitChoices, type OutfitRequest, priceCents } from "../stylist/outfitBudgetSchema";
import { OPTIONS_PER_COMPONENT } from "../stylist/conversationLimits";
import { searchWithValidatedPreferences } from "./validatedPreferenceSearch";
import { relatedLabel, type StylistProduct } from "./preferenceSearch";
import { scoreCompatibility } from "./stylingCompatibility";

export function searchOutfitBudget(
  catalogue: readonly CatalogueProduct[], request: OutfitRequest,
  common: ShoppingPreferences, vocabulary: CataloguePreferenceValues,
  eligible: (product: CatalogueProduct) => boolean,
  anchors: readonly CatalogueProduct[] = []
): { status: "matches" | "no_match" | "needs_clarification"; message: string;
  products: StylistProduct[]; outfit_budget: OutfitBudget | null; outfit_choices: OutfitChoices | null } {
  const fail = (status: "no_match" | "needs_clarification", message: string) =>
    ({ status, message, products: [], outfit_budget: null, outfit_choices: null });
  const groups: { preferences: ShoppingPreferences; products: StylistProduct[] }[] = [];
  for (const item of request.items) {
    const scopes = createPreferenceScopes();
    const { category, subcategory, product_type, size, ...shared } = common;
    void category; void subcategory; void product_type; void size;
    scopes.shared = shared;
    scopes.item = item;
    const composed = composePreferences(scopes);
    if (composed.status !== "ready") return fail("needs_clarification", composed.message);
    const searched = searchWithValidatedPreferences(catalogue, composed.preferences, vocabulary, {
      eligible: product => eligible(product) && (!anchors.length || scoreCompatibility(product, anchors, composed.preferences.occasion).score > 0) && (["occasion", "style", "fit", "season"] as const).every(field =>
        !composed.preferences[field] || relatedLabel(product[field], composed.preferences[field]!)),
      // A cheap feasible component must not disappear behind the normal top four.
      limit: catalogue.length,
      compare: (a, b) => priceCents(a.price_aud ?? 0) - priceCents(b.price_aud ?? 0),
    });
    if (searched.validation.needs_clarification) return fail("needs_clarification", searched.result.message);
    if (!searched.result.products.length) return fail("no_match",
      `I couldn't find a complete set within A$${request.total_budget_aud.toFixed(2)}: no available ${item.product_type ?? item.subcategory ?? item.category} meets the saved requirements. I haven't changed your budget or item requirements.`);
    groups.push({ preferences: searched.validation.preferences, products: searched.result.products.map(product => {
      if (!anchors.length) return product;
      const record = catalogue.find(row => row.product_id === product.product_id)!;
      const evidence = scoreCompatibility(record, anchors, composed.preferences.occasion).evidence;
      return { ...product, pairing_evidence: evidence, explanation: [...evidence.reasons, ...evidence.limitations].join(" ") };
    }) });
  }

  // Branch and bound in integer cents; one product per requested component.
  const limit = priceCents(request.total_budget_aud);
  const minimumSuffix = new Array(groups.length + 1).fill(0);
  for (let i = groups.length - 1; i >= 0; i--) minimumSuffix[i] = minimumSuffix[i + 1] + priceCents(groups[i].products[0].price_aud);
  let best: StylistProduct[] = [];
  let bestTotal = limit + 1;
  const visit = (index: number, total: number, selected: StylistProduct[]) => {
    if (total + minimumSuffix[index] >= bestTotal) return;
    if (index === groups.length) { best = [...selected]; bestTotal = total; return; }
    for (const product of groups[index].products) {
      const next = total + priceCents(product.price_aud);
      if (next + minimumSuffix[index + 1] >= bestTotal) break;
      if (selected.some(item => item.product_id === product.product_id)) continue;
      visit(index + 1, next, [...selected, product]);
    }
  };
  visit(0, 0, []);
  if (!best.length) return fail("no_match",
    `I couldn't find a complete set within your A$${request.total_budget_aud.toFixed(2)} combined budget. I haven't raised the total or dropped any requested items or requirements.`);
  const budget: OutfitBudget = {
    limit_aud: request.total_budget_aud, total_aud: bestTotal / 100,
    remaining_aud: (limit - bestTotal) / 100,
    items: best.map((product, i) => ({ product_id: product.product_id, preferences: groups[i].preferences })),
  };
  // Start with a feasible set, then add diverse choices in rounds. The sum of
  // each group's highest price must fit, so ANY displayed cross-group choice
  // is affordable. These are alternatives, not a cart containing every card.
  const choices = best.map(product => [product]);
  const maxPrice = (items: StylistProduct[]) => Math.max(...items.map(product => priceCents(product.price_aud)));
  for (let round = 1; round < OPTIONS_PER_COMPONENT; round++) {
    for (let index = 0; index < groups.length; index++) {
      const used = new Set(choices.flat().map(product => product.product_id));
      const others = choices.reduce((sum, items, i) => sum + (i === index ? 0 : maxPrice(items)), 0);
      const selected = choices[index];
      const novelty = (product: StylistProduct) =>
        (product.product_type && !selected.some(item => item.product_type === product.product_type) ? 8 : 0) +
        (product.colour && !selected.some(item => item.colour === product.colour) ? 4 : 0) +
        (product.subcategory && !selected.some(item => item.subcategory === product.subcategory) ? 2 : 0);
      const candidate = groups[index].products.filter(product => !used.has(product.product_id) &&
        Math.max(maxPrice(selected), priceCents(product.price_aud)) + others <= limit)
        .sort((a, b) => novelty(b) - novelty(a) || priceCents(a.price_aud) - priceCents(b.price_aud) || a.product_id.localeCompare(b.product_id))[0];
      if (candidate) selected.push(candidate);
    }
  }
  const outfitChoices: OutfitChoices = {
    groups: groups.map((group, i) => ({ label: group.preferences.product_type === "Shirt" ? "Shirts" : group.preferences.subcategory ?? group.preferences.product_type ?? group.preferences.category!,
      product_ids: choices[i].map(product => product.product_id), preferences: group.preferences })),
    maximum_total_aud: choices.reduce((sum, items) => sum + maxPrice(items), 0) / 100,
  };
  return { status: "matches", products: choices.flat(), outfit_budget: budget, outfit_choices: outfitChoices,
    message: `Here are choices for ${outfitChoices.groups.map(group => group.label.toLowerCase()).join(" and ")}${anchors.length ? ` to style with ${anchors.map(anchor => anchor.product_name).join(" and ")}` : ""}. Choose one item from each group; every displayed combination stays within your A$${budget.limit_aud.toFixed(2)} combined budget. Combinations range from A$${budget.total_aud.toFixed(2)} to A$${outfitChoices.maximum_total_aud.toFixed(2)}.${anchors.length ? " The jacket is a styling reference; this total covers the new pieces only." : ""}` };
}
