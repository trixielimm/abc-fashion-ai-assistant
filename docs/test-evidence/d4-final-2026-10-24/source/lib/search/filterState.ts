export const FACETS = [
  { key: "gender", label: "Gender" }, { key: "category", label: "Category" },
  { key: "subcategory", label: "Subcategory" }, { key: "size", label: "Size" },
  { key: "colour", label: "Colour" }, { key: "style", label: "Style" },
  { key: "occasion", label: "Occasion" }, { key: "material", label: "Material" },
  { key: "fit", label: "Fit" }, { key: "season", label: "Season" },
  { key: "brand_line", label: "Collection" }, { key: "product_type", label: "Product type" },
  { key: "tags", label: "Tags" }, { key: "closure", label: "Fastening" },
  { key: "use_cases", label: "Use cases" }, { key: "sole_material", label: "Sole material" },
  { key: "hardware_finish", label: "Hardware finish" },
] as const;
export type FacetKey = typeof FACETS[number]["key"];
export const FEATURES = [
  { key: "pockets", label: "With pockets" }, { key: "lining", label: "Lined" },
  { key: "adjustable_strap", label: "Adjustable straps" },
  { key: "zip_closure", label: "Zip closure" },
  { key: "machine_washable", label: "Machine washable" },
] as const;
export type FeatureKey = typeof FEATURES[number]["key"];
export const RANGES = [
  { key: "price", label: "Price", unit: "A$" },
  { key: "garment_length_cm", label: "Sample garment length", unit: "cm" },
  { key: "heel_height_cm", label: "Heel height", unit: "cm" },
  { key: "capacity_litres", label: "Bag capacity", unit: "L" },
  { key: "compartments", label: "Compartments", unit: "" },
  { key: "width_cm", label: "Bag width", unit: "cm" },
  { key: "height_cm", label: "Bag height", unit: "cm" },
  { key: "depth_cm", label: "Bag depth", unit: "cm" },
  { key: "strap_drop_cm", label: "Strap drop", unit: "cm" },
] as const;
export type RangeKey = typeof RANGES[number]["key"];
export type RangeValue = { min?: number; max?: number };
export type FilterState = {
  q: string; page: number;
  values: Partial<Record<FacetKey, string[]>>;
  features: FeatureKey[];
  ranges: Partial<Record<RangeKey, RangeValue>>;
};
export function normaliseOption(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
export function emptyFilters(q = ""): FilterState {
  return { q, page: 1, values: {}, features: [], ranges: {} };
}
export class InvalidSearchFilters extends Error {}
export function parseFilters(params: URLSearchParams): FilterState {
  if (params.toString().length > 12000) throw new InvalidSearchFilters("Too many filters.");
  const state = emptyFilters((params.get("q") ?? "").trim().slice(0, 120));
  const page = params.get("page");
  if (page && !/^[1-9]\d{0,3}$/.test(page)) throw new InvalidSearchFilters("Invalid page.");
  state.page = page ? Number(page) : 1;
  for (const { key } of FACETS) {
    const values = [...new Set(params.getAll(key).map(normaliseOption).filter(Boolean))];
    if (values.length > 150 || values.some(value => value.length > 250)) throw new InvalidSearchFilters("Too many filter values.");
    if (values.length) state.values[key] = values;
  }
  const features = [...new Set(params.getAll("features"))];
  if (features.some(key => !FEATURES.some(feature => feature.key === key))) throw new InvalidSearchFilters("Unknown feature.");
  state.features = features as FeatureKey[];
  // Zip has one shared state in both the Features and Fastening controls.
  if (state.values.closure?.length === 1 && state.values.closure[0] === "zip") {
    state.features = [...new Set([...state.features, "zip_closure" as const])];
    delete state.values.closure;
  }
  for (const { key } of RANGES) {
    const range: RangeValue = {};
    for (const end of ["min", "max"] as const) {
      const raw = params.get(`${key === "price" ? "" : `${key}_`}${end}${key === "price" ? "_price" : ""}`);
      if (!raw) continue;
      const value = Number(raw);
      if (!/^\d+(?:\.\d{1,3})?$/.test(raw) || !Number.isFinite(value) || value > 1_000_000) throw new InvalidSearchFilters("Invalid range.");
      range[end] = value;
    }
    if (range.min !== undefined && range.max !== undefined && range.min > range.max) throw new InvalidSearchFilters("Minimum must not exceed maximum.");
    if (range.min !== undefined || range.max !== undefined) state.ranges[key] = range;
  }
  return state;
}
export function serializeFilters(state: FilterState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  for (const { key } of FACETS) for (const value of state.values[key] ?? []) params.append(key, value);
  for (const key of state.features) params.append("features", key);
  for (const { key } of RANGES) for (const end of ["min", "max"] as const) {
    const value = state.ranges[key]?.[end];
    if (value !== undefined) params.set(key === "price" ? `${end}_price` : `${key}_${end}`, String(value));
  }
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}
export function searchHref(state: FilterState): string {
  const query = serializeFilters(state);
  return query ? `/search?${query}` : "/search";
}
export function filterCount(state: FilterState): number {
  return Object.values(state.values).reduce((sum, values) => sum + values.length, 0) + state.features.length + Object.keys(state.ranges).length;
}
