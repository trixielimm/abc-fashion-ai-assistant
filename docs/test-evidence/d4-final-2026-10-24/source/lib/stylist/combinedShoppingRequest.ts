import type { ShoppingPreferences } from "../ai/preferenceSchema";
import { emptyShoppingPreferences } from "./preferenceScope";
import type { OutfitRequest } from "./outfitBudgetSchema";

// Remove the styling anchor, not the requested components after its clause.
export function requestedComponents(message: string) {
  const brief = message
    .replace(/\b(?:to match|(?:that )?(?:to )?go with)\s+(?:(?:the|this|that|my)\s+)?(?:jacket|blazer)\b/gi, "")
    .replace(/\b(?:to match|to go with|with my|my owned)\b[^,;]*(?=[,;]|$)/gi, "");
  const components = new Map<string, ShoppingPreferences>();
  for (const match of brief.matchAll(/\bdress(?:es)?(?![ -]+(?:shirts?|shoes?|code)\b)|\b(?:bottoms?|trousers?|pants)\b|\bshirts?\b|\b(?:jackets?|blazers?)\b|\b(?:shoes?|flats?)\b|\bbags?\b|\bnecklaces?\b/gi)) {
    const clause = brief.slice(0, match.index).split(/[.;!?]/).at(-1) ?? "";
    const intents = [...clause.replace(/\bhave no idea\b/gi, "").matchAll(/\b(?:own|owned|already have|bought|wear|show|find|want|need|browse|add|include)\b/gi)];
    if (/^(?:own|owned|already have|bought|wear)$/i.test(intents.at(-1)?.[0] ?? "")) continue;
    if (/\b(?:no|not|without|instead of|rather than)(?:\s+(?:a|any|some))?\s*$/i.test(brief.slice(0, match.index))) continue;
    // A removed component is not a purchase request. A later positive verb
    // starts a new clause: "Drop shoes and find dresses" still requests dresses.
    const directives = [...brief.slice(0, match.index).matchAll(/\b(?:drop|remove|forget|exclude|show|find|want|need|browse|add|include)\b/gi)];
    if (/^(?:drop|remove|forget|exclude)$/i.test(directives.at(-1)?.[0] ?? "")) continue;
    const word = match[0];
    const role = /^dress/i.test(word) ? "Dresses" : /^(?:bottom|trouser|pant)/i.test(word) ? "Bottoms" : /^shirt/i.test(word) ? "Shirts"
      : /^(?:jacket|blazer)/i.test(word) ? "Outerwear" : /^(?:shoe|flat)/i.test(word) ? "Shoes" : /^bag/i.test(word) ? "Bags" : "Necklace";
    const preferences = emptyShoppingPreferences();
    Object.assign(preferences, role === "Dresses" ? { category: "Clothing", subcategory: "Dresses" }
      : role === "Bottoms" ? { category: "Clothing", subcategory: "Bottoms" }
      : role === "Shirts" ? { category: "Clothing", subcategory: "Tops", product_type: "Shirt" }
      : role === "Outerwear" ? { category: "Clothing", subcategory: "Outerwear", product_type: "Jacket" }
      : role === "Necklace" ? { category: "Accessories", subcategory: "Jewellery", product_type: "Necklace" }
      : { category: role });
    components.set(role, preferences);
  }
  return components;
}

export function statedCombinedBudget(message: string) {
  const patterns = [
    /\b(?:whole|entire|complete)\s+(?:purchase|order|gift|outfit)\s+(?:under|within|below|up to|at most)\s*(?:A?\$\s*)?(\d+(?:\.\d{1,2})?)\b/gi,
    /(?:A?\$\s*)?(\d+(?:\.\d{1,2})?)\s*(?:aud|dollars?)?\s+(?:altogether|for both|for everything)\b/gi,
    /(?:A?\$\s*)?(\d+(?:\.\d{1,2})?)\s*(?:aud|dollars?)?\s+(?:(?:is|as)\s+(?:the\s+)?)?(?:total|combined)\b/gi,
    /\b(?:total|combined)(?:\s+total)?(?:\s+(?:purchase|shopping|gift))?(?:\s+budget)?\s*(?:is|of|to|now|[:=])?\s*(?:A?\$\s*)?(\d+(?:\.\d{1,2})?)\b/gi,
    /(?:A?\$\s*)?(\d+(?:\.\d{1,2})?)\s*(?:aud|dollars?)?\s+for\s+(?:(?![.!?;]|\b(?:each|per item)\b).){1,100}?\btogether\b/gi,
  ];
  const amounts = patterns.flatMap(pattern => [...message.matchAll(pattern)]).filter(match => {
    const before = message.slice(0, match.index);
    const after = message.slice(match.index! + match[0].length);
    return !/\b(?:not|no|without)\s*$/i.test(before) &&
      !/^\s*(?:each|per (?:item|piece))\b/i.test(after);
  }).sort((a, b) => a.index! - b.index!);
  const amount = amounts.at(-1);
  return amount ? Number(amount[1]) : null;
}

export function confirmsCombinedBudget(message: string) {
  return /^(?:yes(?:,? (?:please|for both|for everything|that is the total))?|combined|together|(?:the )?total(?: for both)?)[.!]*$/i.test(message.trim());
}

export function confirmedBudgetRequest(message: string, pending: OutfitRequest): OutfitRequest | null {
  if (confirmsCombinedBudget(message)) return { ...pending, evidence: message };
  const perItem = message.trim().match(/^(?:no[, ]+)?(?:A?\$\s*)?(\d+(?:\.\d{1,2})?)(?:\s*aud)?\s+(?:each|per item|per piece)[.!]*$/i);
  if (!perItem) return null;
  const cap = Number(perItem[1]);
  return { ...pending, total_budget_aud: Math.round(cap * 100) * pending.items.length / 100, evidence: message,
    items: pending.items.map(item => ({ ...item, max_price: Math.min(item.max_price ?? Infinity, cap) })) };
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
  const anchorFirst = /^(?:(?:can|could|would) you )?(?:find|show)(?: me)? (?:some )?bottoms? (?:to )?(?:match|go with) (?:the|this|that|my) (?:jacket|blazer),? (?:or|and|plus) (?:some |a )?shirts?(?: as well| too)?[,;.]?\s*(?:my )?(?:total|combined) budget (?:is |of |=?\s*)?(?:A?\$\s*)?\d+(?:\.\d{1,2})?(?:\s*(?:aud|dollars?))?[.!?]*$/i;
  const componentsFirst = /^(?:(?:please )?(?:find|show)(?: me)?|can i get) (?:some )?bottoms?,? (?:and|plus)(?: also)? (?:some |a )?shirts? (?:that go with|to match|to go with) (?:the|this|that|my) (?:jacket|blazer)[,;.!?]?\s*(?:my )?(?:total|combined) budget (?:is |of |=?\s*)?(?:A?\$\s*)?\d+(?:\.\d{1,2})?(?:\s*(?:aud|dollars?))?[.!?]*$/i;
  if (![anchorFirst, componentsFirst].some(pattern => pattern.test(message.trim()))) return null;
  const request = additiveCombinedRequest(message);
  return request?.total !== null && request?.total !== undefined ? {
    total_budget_aud: request.total, items: [...request.components.values()], evidence: message.slice(0, 250),
  } : null;
}

export const jacketPairingRequest = (message: string) => /\b(?:to match|go with|match|matching)\s+(?:(?:the|this|that|my)\s+)?(?:jacket|blazer)\b/i.test(message);
export const isJacket = (product: { product_name: string; product_type?: string | null }) =>
  /\b(?:jacket|blazer)\b/i.test(`${product.product_type ?? ""} ${product.product_name}`);
