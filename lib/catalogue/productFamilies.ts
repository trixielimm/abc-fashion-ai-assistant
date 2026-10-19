// Catalogue-backed umbrella terms. The same matcher is used by validation,
// retrieval and reply checks, so a valid family cannot be rejected downstream.
const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/s$/, "").trim();
const families: Record<string, { category: string; subcategory?: string; pattern: RegExp }> = {
  jacket: { category: "Clothing", subcategory: "Outerwear", pattern: /\b(?:jacket|blazer)\b/i },
  shirt: { category: "Clothing", subcategory: "Tops", pattern: /\bshirt\b/i },
  skirt: { category: "Clothing", subcategory: "Bottoms", pattern: /\bskirt\b/i },
  trouser: { category: "Clothing", subcategory: "Bottoms", pattern: /\b(?:trousers?|pants|chinos)\b/i },
  pant: { category: "Clothing", subcategory: "Bottoms", pattern: /\b(?:trousers?|pants|chinos|jeans)\b/i },
  flat: { category: "Shoes", pattern: /\b(?:flats?|flat sandals|loafers|flat mules)\b/i },
  "flat shoe": { category: "Shoes", pattern: /\b(?:flats?|flat sandals|loafers|flat mules)\b/i },
  necklace: { category: "Accessories", pattern: /\bnecklace\b/i },
};
export function productFamily(value: string) { return families[normalise(value)] ?? null; }
export function matchesProductType(product: { category?: string | null; subcategory?: string | null; product_type: string | null }, requested: string) {
  const family = productFamily(requested);
  if (!family) return null;
  return (!product.category || product.category === family.category) && family.pattern.test(product.product_type ?? "");
}
export function canonicalSize(value: string, labels: readonly string[]) {
  const names: Record<string, string> = { "extra small": "XS", "small": "S", "medium": "M", "large": "L", "extra large": "XL" };
  const key = value.trim().toLowerCase();
  const wanted = names[key] ?? value.replace(/^AU\s*/i, "").trim();
  return labels.find(label => label.toLowerCase() === wanted.toLowerCase()) ?? value;
}
