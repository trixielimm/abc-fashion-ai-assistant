import type { StylingState } from "./commerceSchema";
import type { ChatProduct } from "./conversationProtocol";
import { priceCents, type OutfitChoices } from "./outfitBudgetSchema";

export const outfitMoney = (value: number) => `A$${value.toFixed(2)}`;

export function outfitTotals(styling: StylingState) {
  const anchors = new Set(styling.outfit_request?.anchor_product_ids ?? []);
  const selected = styling.outfit.filter(piece => piece.ownership === "selected" && !anchors.has(piece.product_id) &&
    (!styling.purchase_budget || styling.purchase_budget.product_ids.includes(piece.product_id)));
  const completePrices = selected.every(piece => typeof piece.price_aud === "number" && Number.isFinite(piece.price_aud));
  const cents = selected.reduce((sum, piece) => sum + (typeof piece.price_aud === "number" ? priceCents(piece.price_aud) : 0), 0);
  const limit = styling.purchase_budget?.limit_aud ?? styling.outfit_request?.total_budget_aud ?? null;
  return {
    total: cents / 100,
    completePrices,
    remaining: limit !== null && completePrices ? (priceCents(limit) - cents) / 100 : null,
    limit,
    selectedCount: selected.length,
  };
}

const neutral = (colour: string | null) => /^(black|white|cream|ivory|beige|nude|grey|gray|silver|gold)$/i.test(colour ?? "");
const cool = (colour: string | null) => /^(blue|navy|lavender|purple|sage|green|silver)$/i.test(colour ?? "");

function formality(product: ChatProduct) {
  const type = product.product_type ?? "";
  if (product.category === "Clothing") return /maxi|gown/i.test(type) ? 6 : /midi/i.test(type) ? 4 : /mini/i.test(type) ? -2 : 0;
  if (product.category === "Shoes") return /heel|pump|court/i.test(type) ? 4 : /formal|evening|dress flat/i.test(type) ? 3 : 0;
  return 0;
}

export function outfitProductNote(product: ChatProduct) {
  if (/mini/i.test(product.product_type ?? "")) return "A shorter option for cocktail-style events; check the invitation’s dress code.";
  if (/loafer/i.test(product.product_type ?? "")) return "A tailored flat option for dinner settings; check whether the event calls for dressier footwear.";
  // The card's grounded reason already carries the recorded occasion.
  return null;
}

export function suggestedOutfit(products: ChatProduct[], choices: OutfitChoices, limit: number) {
  const groups = choices.groups.map(group => group.product_ids.map(id => products.find(product => product.product_id === id)).filter((product): product is ChatProduct => Boolean(product)));
  if (groups.some(group => !group.length)) return null;
  let best: { products: ChatProduct[]; total: number; score: number } | null = null;
  function visit(index: number, selected: ChatProduct[], cents: number) {
    if (cents > priceCents(limit)) return;
    if (index < groups.length) {
      for (const product of groups[index]) if (!selected.some(piece => piece.product_id === product.product_id)) {
        visit(index + 1, [...selected, product], cents + priceCents(product.price_aud));
      }
      return;
    }
    const colours = selected.map(product => product.colour);
    const coordinated = colours.every(colour => colour && colour.toLowerCase() === colours[0]?.toLowerCase()) ||
      colours.some(neutral) || colours.every(cool);
    const score = selected.reduce((sum, product) => sum + formality(product), 0) + (coordinated ? 3 : 0);
    if (!best || score > best.score || score === best.score && cents < priceCents(best.total)) best = { products: selected, total: cents / 100, score };
  }
  visit(0, [], 0);
  const picked = best as { products: ChatProduct[]; total: number; score: number } | null;
  if (!picked) return null;
  const reasons: string[] = [];
  const types = picked.products.map(product => product.product_type ?? "");
  if (types.some(type => /maxi|gown/i.test(type))) reasons.push("The long dress silhouette is a starting point for a dressier event.");
  else if (types.some(type => /midi/i.test(type))) reasons.push("The midi silhouette is a starting point for a formal dinner or wedding guest look.");
  if (types.some(type => /heel|pump|court/i.test(type))) reasons.push("Heels give the outfit a dressier finish.");
  const colours = picked.products.map(product => product.colour);
  if (colours.every(colour => colour && colour.toLowerCase() === colours[0]?.toLowerCase())) reasons.push("The recorded colours create a tonal pairing.");
  else if (colours.some(neutral)) reasons.push("A recorded neutral colour gives the other pieces room to stand out.");
  else if (colours.every(cool)) reasons.push("The recorded colours sit in a cool palette; try the shades together to check the match.");
  if (!reasons.length) reasons.push("This combines one available item from each requested group within your total budget.");
  return { products: picked.products, total: picked.total, remaining: (priceCents(limit) - priceCents(picked.total)) / 100, reasons };
}
