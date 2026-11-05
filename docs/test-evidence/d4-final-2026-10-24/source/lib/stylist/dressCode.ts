import { z } from "zod";

export const DressCodeSchema = z.enum(["any_formal", "black_tie", "wedding_guest", "formal_dinner", "cocktail"]);
export type DressCode = z.infer<typeof DressCodeSchema>;

export const dressCodes: { value: DressCode; label: string; guidance: string }[] = [
  { value: "any_formal", label: "Any formal event", guidance: "Explore the full formal selection. Check the invitation before choosing a hem length or shoe style." },
  { value: "black_tie", label: "Black tie", guidance: "Focus on maxi dresses or gowns with heels or formal flats. Check the invitation and product details for the required level of formality." },
  { value: "wedding_guest", label: "Wedding guest", guidance: "Focus on midi or maxi dresses and dress shoes, excluding white, ivory and cream dresses. Follow the couple’s dress code." },
  { value: "formal_dinner", label: "Formal dinner", guidance: "Focus on midi or maxi dresses with heels, dress flats or loafers for a dinner setting." },
  { value: "cocktail", label: "Cocktail", guidance: "Explore midi dresses and dress shoes or formal flats. Follow the invitation and consider the venue when choosing shoes." },
];

export function dressCodeMessage(value: DressCode) {
  return `Set the outfit dress code to ${dressCodes.find(code => code.value === value)!.label}, keeping my items, sizes, colours and combined budget.`;
}

// Only the complete UI command uses this shortcut. Compound or free-form
// requests still go through the interpreter, so trailing constraints survive.
export function dressCodeFromMessage(message: string): DressCode | null {
  return dressCodes.find(code => dressCodeMessage(code.value) === message.trim())?.value ?? null;
}

export function explicitDressCode(message: string): DressCode | null {
  for (const [pattern, code] of [[/\bblack[ -]tie\b/gi, "black_tie"], [/\bwedding(?: guest)?\b/gi, "wedding_guest"],
    [/\bcocktail\b/gi, "cocktail"], [/\bformal dinner\b/gi, "formal_dinner"]] as const) {
    if ([...message.matchAll(pattern)].some(match => !/\b(?:no|not|isn't|is not)\s*$/i.test(message.slice(0, match.index)))) return code;
  }
  return null;
}

export function hasEventContext(styling: { dress_code?: DressCode | null; outfit_request?: { items: { occasion: string | null }[] } | null }) {
  return Boolean(styling.dress_code || styling.outfit_request?.items.some(item => /formal|wedding|cocktail|dinner/i.test(item.occasion ?? "")));
}

export function meetsDressCode(product: { category: string | null; subcategory: string | null; product_type: string | null; colour: string | null }, code: DressCode | null | undefined) {
  if (!code || code === "any_formal") return true;
  const type = (product.product_type ?? "").toLowerCase();
  if (product.category === "Clothing" && /dress/i.test(product.subcategory ?? "")) {
    if (code === "black_tie") return /\b(maxi|gown)\b/.test(type);
    if (!/\b(midi|maxi|gown)\b/.test(type)) return false;
    return code !== "wedding_guest" || !/\b(white|ivory|cream)\b/i.test(product.colour ?? "");
  }
  if (product.category === "Shoes") {
    return /\b(heels?|pumps?|court shoes|(?:dress|formal|evening|ballet) flats)\b/.test(type) ||
      code === "formal_dinner" && /\bloafers?\b/.test(type);
  }
  return true;
}
