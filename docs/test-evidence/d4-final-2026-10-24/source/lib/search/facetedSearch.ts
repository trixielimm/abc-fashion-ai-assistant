import type { CatalogueProduct } from "../recommendations/catalogue";
import { getProductSpecification } from "../stylist/productSpecifications";
import { comparableFeatures } from "./productBenefits";
import { searchCatalogue } from "./catalogueSearch";
import { getProductImageSrc } from "../product-image";
import { FACETS, FEATURES, RANGES, normaliseOption, type FacetKey, type FeatureKey, type FilterState, type RangeKey } from "./filterState";

export type FilterOption = { value: string; label: string; count: number; categories: string[] };
export type SearchCard = {
  product_id: string; product_name: string; price_aud: number;
  category: string | null; subcategory: string | null; brand_line: string | null;
  colour: string | null; image_src: string | null;
};
export type SearchSnapshot = {
  state: FilterState; products: SearchCard[]; total: number; pageCount: number;
  facets: Record<FacetKey, FilterOption[]>;
  features: { key: FeatureKey; label: string; count: number; categories: string[] }[];
  bounds: Partial<Record<RangeKey, { min: number; max: number; categories: string[] }>>;
  featureDataAvailable: boolean; retrievedAt: string;
};
type Projection = {
  product: CatalogueProduct;
  values: Partial<Record<FacetKey, string[]>>;
  numbers: Partial<Record<RangeKey, number>>;
  features: Set<string>;
  labels: Partial<Record<FacetKey, string[]>>;
};
function project(product: CatalogueProduct): Projection {
  const spec = getProductSpecification(product);
  const facts = comparableFeatures(product);
  const fact = (key: string) => facts.find(feature => feature.feature_key === key)?.value;
  const labels: Projection["labels"] = {};
  for (const { key } of FACETS) {
    let value: unknown;
    if (key === "size") value = product.sizes_available?.map(size => `${product.category}:${size}`);
    else if (key === "use_cases") value = fact("use_cases");
    else if (key === "closure") value = fact("zip_closure") === true ? "zip" : spec?.closure === "zip" && fact("zip_closure") === false ? null : spec?.closure;
    else if (key === "sole_material" || key === "hardware_finish") value = spec?.[key];
    else value = product[key];
    labels[key] = (Array.isArray(value) ? value : [value]).filter((v): v is string => typeof v === "string" && Boolean(v.trim())).map(v => v.trim().replace(/\s+/g, " "));
  }
  const numbers: Projection["numbers"] = { price: product.price_aud ?? undefined };
  for (const { key } of RANGES) {
    if (key === "price") continue;
    const value = key === "capacity_litres" ? fact(key)
      : key === "width_cm" ? spec?.dimensions_cm?.width
      : key === "height_cm" ? spec?.dimensions_cm?.height
      : key === "depth_cm" ? spec?.dimensions_cm?.depth : spec?.[key];
    if (typeof value === "number" && Number.isFinite(value)) numbers[key] = value;
  }
  return { product, labels, values: Object.fromEntries(Object.entries(labels).map(([key, values]) => [key, values.map(normaliseOption)])), numbers,
    features: new Set(facts.filter(feature => feature.value === true).map(feature => feature.feature_key)) };
}
function matches(row: Projection, state: FilterState, except?: string): boolean {
  for (const { key } of FACETS) {
    const selected = state.values[key];
    if (key === except || (key === "closure" && except === "zip_closure") || !selected?.length) continue;
    const values = row.values[key] ?? [];
    if (!selected.some(value => values.includes(value) || (key === "size" && values.some(size => size.split(":").slice(1).join(":") === value)))) return false;
  }
  if (state.features.some(key => key !== except && !(key === "zip_closure" && except === "closure") && !row.features.has(key))) return false;
  for (const { key } of RANGES) {
    const range = state.ranges[key];
    if (key === except || !range) continue;
    const value = row.numbers[key];
    if (value === undefined || (range.min !== undefined && value < range.min) || (range.max !== undefined && value > range.max)) return false;
  }
  return true;
}
const labelFor = (key: FacetKey, label: string) => key === "size" ? label.slice(label.indexOf(":") + 1) : key === "closure" ? label.replaceAll("_", " ").replace(/^./, c => c.toUpperCase()) : label;
export function runFacetedSearch(catalogue: readonly CatalogueProduct[], state: FilterState, featureDataAvailable = true): SearchSnapshot {
  const eligible = searchCatalogue(catalogue, "");
  const rows = eligible.map(project);
  const byId = new Map(rows.map(row => [row.product.product_id, row]));
  const searched = searchCatalogue(eligible, state.q).map(product => byId.get(product.product_id)!).filter(Boolean);
  // Unknown feature data cannot be represented as a genuine empty result.
  if (!featureDataAvailable && (state.features.length || Object.keys(state.ranges).some(key => key !== "price") || ["closure", "use_cases", "sole_material", "hardware_finish"].some(key => state.values[key as FacetKey]?.length))) throw new Error("Product features are temporarily unavailable.");
  const filtered = searched.filter(row => matches(row, state));
  const facets = {} as SearchSnapshot["facets"];
  for (const { key } of FACETS) {
    const options = new Map<string, FilterOption>();
    for (const row of rows) (row.labels[key] ?? []).forEach(label => {
      const value = normaliseOption(label);
      const option = options.get(value) ?? { value, label: labelFor(key, label), count: 0, categories: [] };
      if (row.product.category && !option.categories.includes(row.product.category)) option.categories.push(row.product.category);
      options.set(value, option);
    });
    for (const row of searched.filter(row => matches(row, state, key))) for (const value of new Set(row.values[key])) {
      const option = options.get(value);
      if (option) option.count++;
    }
    // Stale URL values remain visible and removable instead of broadening the search.
    for (const value of state.values[key] ?? []) if (!options.has(value)) options.set(value, { value, label: labelFor(key, value), count: 0, categories: [] });
    facets[key] = [...options.values()].sort((a, b) => {
      if (key === "size") {
        const order = ["XS", "S", "M", "L", "XL", "XXL", "One Size"];
        const aOrder = order.indexOf(a.label), bOrder = order.indexOf(b.label);
        if (aOrder >= 0 && bOrder >= 0) return aOrder - bOrder;
      }
      return a.label.localeCompare(b.label, undefined, { numeric: true });
    });
  }
  const features = FEATURES.map(feature => ({ ...feature,
    count: searched.filter(row => row.features.has(feature.key) && matches(row, state, feature.key)).length,
    categories: [...new Set(rows.filter(row => row.features.has(feature.key)).flatMap(row => row.product.category ? [row.product.category] : []))],
  }));
  const bounds: SearchSnapshot["bounds"] = {};
  for (const { key } of RANGES) {
    const known = rows.filter(row => row.numbers[key] !== undefined);
    if (known.length) bounds[key] = { min: Math.min(...known.map(row => row.numbers[key]!)), max: Math.max(...known.map(row => row.numbers[key]!)), categories: [...new Set(known.flatMap(row => row.product.category ? [row.product.category] : []))] };
  }
  const pageCount = Math.max(1, Math.ceil(filtered.length / 24));
  const page = Math.min(state.page, pageCount);
  return { state: { ...state, page }, total: filtered.length, pageCount, facets, features, bounds, featureDataAvailable,
    retrievedAt: new Date().toISOString(), products: filtered.slice((page - 1) * 24, page * 24).map(({ product: p }) => ({
      product_id: p.product_id!, product_name: p.product_name!, price_aud: p.price_aud!, category: p.category,
      subcategory: p.subcategory, brand_line: p.brand_line, colour: p.colour,
      // Do not expose storage object paths or specification/evidence metadata.
      image_src: getProductImageSrc(p.product_id, p.image_key),
    })) };
}
