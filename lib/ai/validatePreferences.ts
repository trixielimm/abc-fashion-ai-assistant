import { ShoppingPreferencesSchema, type ShoppingPreferences } from "./preferenceSchema";
import type { CataloguePreferenceValues } from "../catalogue/preferenceValues";

export type PreferenceIssue = {
  field: keyof ShoppingPreferences;
  value: string | number;
  code: "unsupported_value" | "category_mismatch" | "invalid_budget";
  reason: string;
  blocking: boolean;
};

const normalise = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

export function validatePreferences(input: ShoppingPreferences, catalogue: CataloguePreferenceValues) {
  const preferences = ShoppingPreferencesSchema.parse(input);
  const issues: PreferenceIssue[] = [];
  const fields = ["gender", "category", "subcategory", "product_type", "occasion", "style", "season", "material", "fit", "size", "brand_line"] as const;
   // These fields are required filters in the current website search.
  const hardFields = new Set<keyof ShoppingPreferences>([
    "gender",
    "category",
    "subcategory",
    "product_type",
    "size",
    "preferred_colours",
    "excluded_colours",
    "material",
    "brand_line",
  ]);
    function check(field: keyof ShoppingPreferences, value: string, allowed: string[]) {
    const match = allowed.find(
      (candidate) => normalise(candidate) === normalise(value)
    );
    if (match !== undefined) return match;

    const blocking = hardFields.has(field);
    issues.push({
      field,
      value,
      code: "unsupported_value",
      blocking,
      reason: blocking
        ? "Not recognised in the visible catalogue. Clarify before changing or dropping this required filter."
        : "Not recognised as an exact catalogue label. Keep the preference and explain any mismatch.",
    });
    return value;
  }
  for (const field of fields) {
    const value = preferences[field];
    if (value === null) continue;
    const allowed = field === "size" ? catalogue.sizes
      : field === "category" || field === "subcategory" ? catalogue.categories.map(row => row[field])
      : catalogue.rows.map(row => row[field]);
    // Enum fields already have canonical spelling enforced by the extraction schema.
    const canonical = check(field, value, allowed.filter((v): v is string => v !== null));
    Object.assign(preferences, { [field]: canonical });
  }
  for (const field of ["preferred_colours", "excluded_colours"] as const) {
    preferences[field] = [...new Set(preferences[field].map(value =>
      check(field, value, catalogue.rows.map(row => row.colour).filter((v): v is string => v !== null))))];
  }
  if (preferences.category && preferences.subcategory &&
      !issues.some(issue => issue.field === "category" || issue.field === "subcategory") &&
      !catalogue.categories.some(row => row.category === preferences.category && row.subcategory === preferences.subcategory)) {
    issues.push({ field: "subcategory", value: preferences.subcategory, code: "category_mismatch",
      reason: "Subcategory does not belong to the requested category.", blocking: true });
  }
  if (preferences.min_price !== null && preferences.max_price !== null && preferences.min_price > preferences.max_price) {
    issues.push({ field: "min_price", value: preferences.min_price, code: "invalid_budget",
      reason: "Minimum price exceeds maximum price.", blocking: true });
  }
  return { preferences, issues, needs_clarification: issues.some(issue => issue.blocking) };
}
