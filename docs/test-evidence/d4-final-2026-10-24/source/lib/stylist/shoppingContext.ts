import { z } from "zod";

const roles = {
  Jewellery: /\b(?:jewellery|jewelry|necklaces?|bracelets?|earrings?|rings?)\b/i,
  Bags: /\b(?:bags?|clutches?|handbags?|totes?)\b/i,
  Shoes: /\b(?:shoes?|footwear|sandals?|loafers?|heels?|flats?|sneakers?)\b/i,
  Scarves: /\b(?:scarves|scarf)\b/i,
  Hats: /\b(?:hats?|caps?)\b/i,
  Belts: /\bbelts?\b/i,
  Clothing: /\b(?:clothing|clothes)\b/i,
};
export const ExcludedRoleSchema = z.enum(["Jewellery", "Bags", "Shoes", "Scarves", "Hats", "Belts", "Clothing"]);
type ExcludedRole = z.infer<typeof ExcludedRoleSchema>;

export function shoppingRoleExclusions(message: string, previous: readonly ExcludedRole[] = []) {
  const excluded = new Set(previous);
  for (const [role, pattern] of Object.entries(roles) as [ExcludedRole, RegExp][]) {
    for (const match of message.matchAll(new RegExp(pattern.source, "gi"))) {
      const before = message.slice(0, match.index).split(/[.!?;]/).at(-1) ?? "";
      if (/\b(?:no|not|without|exclude|excluding|avoid|dislikes?|hates?|don['’]?t (?:want|like|recommend)|doesn['’]?t (?:want|like)|do not (?:want|like|recommend))(?:\s+(?:any|more|wearing|buying|the))?\s*$/i.test(before)) excluded.add(role);
      if (/\b(?:allow|include|consider)(?:\s+(?:the|some|any))?\s*$/i.test(before) && !/\b(?:not|no|never|don['’]?t|do not)\s+(?:allow|include|consider)/i.test(before)) excluded.delete(role);
    }
  }
  return [...excluded];
}

// Recipient tastes and uncertain sizing are not manufacturer-verifiable features.
// Physical requirements such as softness, allergies and adjustable waists stay hard.
export function contextualRequirement(label: string, uncertainGiftSize: boolean) {
  return /^(?:dislikes?|hates?|no|avoid|exclude|doesn['’]?t like|don['’]?t like)\s+(?:jewellery|jewelry|bags?|shoes?|scarves|hats?|belts?|clothing)$/i.test(label.trim()) ||
    uncertainGiftSize && /^(?:easier? to fit|size unknown|unknown (?:clothing )?size|don['’]?t know (?:his|her|their) size)$/i.test(label.trim());
}

export function excludedByShoppingContext(product: { category: string | null; subcategory: string | null; product_type: string | null }, excluded: readonly ExcludedRole[] = []) {
  return excluded.some(role => role === "Clothing" ? product.category === "Clothing"
    : roles[role].test(`${product.category ?? ""} ${product.subcategory ?? ""} ${product.product_type ?? ""}`));
}

export function recipientFromMessage(message: string) {
  const match = message.match(/\b(?:gift|present)\b[^.!?]{0,60}\bfor (?:my |our )?(dad|father|mum|mom|mother|partner|friend|brother|sister|husband|wife|son|daughter)\b/i)
    ?? message.match(/\bfor (?:my |our )?(dad|father|mum|mom|mother|partner|friend|brother|sister|husband|wife|son|daughter)\b[^.!?]{0,50}\b(?:gift|present)\b/i);
  return match?.[1].toLowerCase() ?? null;
}

export const uncertainRecipientSize = (message: string) => /\b(?:don['’]?t|do not|doesn['’]?t|does not) know (?:his|her|their|dad['’]?s|my father['’]?s)(?: clothing| shirt)? size\b|\b(?:his|her|their|clothing) size (?:is )?unknown\b/i.test(message);

export function occasionMeaning(value: string) {
  return /^(?:(?:my|our|the|everyday)\s+)*(?:office|office work|workplace|work)$/i.test(value.trim()) ? "Work" : value;
}
