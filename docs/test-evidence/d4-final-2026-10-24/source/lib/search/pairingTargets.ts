import type { CatalogueProduct } from "../recommendations/catalogue";
import type { CataloguePreferenceValues } from "../catalogue/preferenceValues";

const normalise = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export function pairingCategoryNames(product: CatalogueProduct) {
  return [...new Map([...(Array.isArray(product.pairing_categories) ? product.pairing_categories : []), product.cross_sell_category]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .map(value => [normalise(value), value.trim()])).values()];
}

export function resolvePairingTarget(name: string, vocabulary: CataloguePreferenceValues) {
  const targets = [...new Map(vocabulary.categories.filter(row =>
    normalise(row.subcategory ?? row.category) === normalise(name)
  ).map(row => [JSON.stringify(row), row])).values()];
  return targets.length === 1 ? targets[0] : null;
}

export function pairingRoleOccupied(name: string, occupied: readonly string[], vocabulary: CataloguePreferenceValues) {
  const target = resolvePairingTarget(name, vocabulary);
  return occupied.some(role => normalise(role) === normalise(name) ||
    target && normalise(role) === normalise(target.category));
}
