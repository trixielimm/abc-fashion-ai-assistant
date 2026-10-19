import type { ShoppingPreferences } from "../ai/preferenceSchema";
import { emptyShoppingPreferences } from "./preferenceScope";

// Remove the styling anchor, not the requested components after its clause.
export function requestedComponents(message: string) {
  const brief = message
    .replace(/\b(?:to match|to go with)\s+(?:(?:the|this|that|my)\s+)?(?:jacket|blazer)\b/gi, "")
    .replace(/\b(?:to match|to go with|with my|my owned)\b[^,;]*(?=[,;]|$)/gi, "");
  const components = new Map<string, ShoppingPreferences>();
  for (const match of brief.matchAll(/\bdress(?:es)?(?![ -]+(?:shirts?|shoes?|code)\b)|\b(?:bottoms?|trousers?|pants)\b|\bshirts?\b|\b(?:shoes?|flats?)\b|\bbags?\b|\bnecklaces?\b/gi)) {
    if (/\b(?:no|not|without|instead of|rather than)(?:\s+(?:a|any|some))?\s*$/i.test(brief.slice(0, match.index))) continue;
    // A removed component is not a purchase request. A later positive verb
    // starts a new clause: "Drop shoes and find dresses" still requests dresses.
    const directives = [...brief.slice(0, match.index).matchAll(/\b(?:drop|remove|forget|exclude|show|find|want|need|browse|add|include)\b/gi)];
    if (/^(?:drop|remove|forget|exclude)$/i.test(directives.at(-1)?.[0] ?? "")) continue;
    const word = match[0];
    const role = /^dress/i.test(word) ? "Dresses" : /^(?:bottom|trouser|pant)/i.test(word) ? "Bottoms" : /^shirt/i.test(word) ? "Shirts"
      : /^(?:shoe|flat)/i.test(word) ? "Shoes" : /^bag/i.test(word) ? "Bags" : "Necklace";
    const preferences = emptyShoppingPreferences();
    Object.assign(preferences, role === "Dresses" ? { category: "Clothing", subcategory: "Dresses" }
      : role === "Bottoms" ? { category: "Clothing", subcategory: "Bottoms" }
      : role === "Shirts" ? { category: "Clothing", subcategory: "Tops", product_type: "Shirt" }
      : role === "Necklace" ? { category: "Accessories", subcategory: "Jewellery", product_type: "Necklace" }
      : { category: role });
    components.set(role, preferences);
  }
  return components;
}

export function statedCombinedBudget(message: string) {
  const amount = message.match(/(?:A?\$\s*)?(\d+(?:\.\d{1,2})?)\s*(?:aud|dollars?)?\s+(?:total|combined)\b/i)
    ?? message.match(/\b(?:total|combined)(?:\s+(?:purchase|shopping))?(?:\s+budget)?\s*(?:is|of|[:=])?\s*(?:A?\$\s*)?(\d+(?:\.\d{1,2})?)\b/i);
  return amount ? Number(amount[1]) : null;
}

export function additiveCombinedRequest(message: string) {
  const components = requestedComponents(message);
  if (components.size < 2 || !/\b(?:total|combined|both|together|all of them)\b/i.test(message)) return null;
  // A real either/or choice stays ambiguous. "Or ... as well" is additive.
  if (/\bor\b/i.test(message) && !/\b(?:as well|also|too)\b/i.test(message) || /\b(?:not both|either .+ or)\b/i.test(message)) return null;
  return { components, total: statedCombinedBudget(message) };
}

// Exact, complete grammar only. Extra colours, sizes and other qualifiers go
// through the interpreter, so a shortcut can never discard those requirements.
export function simpleMatchingSet(message: string) {
  if (!/^(?:(?:can|could|would) you )?(?:find|show)(?: me)? (?:some )?bottoms? (?:to )?(?:match|go with) (?:the|this|that|my) (?:jacket|blazer),? (?:or|and|plus) (?:some |a )?shirts?(?: as well| too)?[,;.]?\s*(?:my )?(?:total|combined) budget (?:is |of |=?\s*)?(?:A?\$\s*)?\d+(?:\.\d{1,2})?(?:\s*(?:aud|dollars?))?[.!?]*$/i.test(message.trim())) return null;
  const request = additiveCombinedRequest(message);
  return request?.total !== null && request?.total !== undefined ? {
    total_budget_aud: request.total, items: [...request.components.values()], evidence: message.slice(0, 250),
  } : null;
}

export const jacketPairingRequest = (message: string) => /\b(?:to match|go with|match|matching)\s+(?:(?:the|this|that|my)\s+)?(?:jacket|blazer)\b/i.test(message);
export const isJacket = (product: { product_name: string; product_type?: string | null }) =>
  /\b(?:jacket|blazer)\b/i.test(`${product.product_type ?? ""} ${product.product_name}`);
