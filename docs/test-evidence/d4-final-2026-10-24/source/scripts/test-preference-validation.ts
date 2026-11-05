import assert from "node:assert/strict";
import { validatePreferences } from "../lib/ai/validatePreferences";
import { ShoppingPreferencesSchema } from "../lib/ai/preferenceSchema";
import type { CataloguePreferenceValues } from "../lib/catalogue/preferenceValues";

const empty = ShoppingPreferencesSchema.parse({ gender: null, category: null, subcategory: null, product_type: null, occasion: null, style: null, preferred_colours: [], excluded_colours: [], season: null, material: null, fit: null, size: null, min_price: null, max_price: null, brand_line: null });
const catalogue: CataloguePreferenceValues = {
  rows: [{ gender: "Women", brand_line: "ABC Occasion", category: "Clothing", subcategory: "Dresses", product_type: "Midi Dress", occasion: "Brunch", style: "Elegant", colour: "Navy", season: "Summer", material: "Cotton", fit: "Regular" }],
  sizes: ["10", "12"],
  categories: [{category: "Clothing", subcategory: "Dresses"}, {category: "Shoes", subcategory: "Heels"}],
};
const input = { ...empty, style: " elegant ", preferred_colours: [" navy ", "NAVY"] };
const canonical = validatePreferences(input, catalogue);
assert.equal(canonical.preferences.style, "Elegant");
assert.deepEqual(canonical.preferences.preferred_colours, ["Navy"]);
assert.equal(input.style, " elegant ");
assert.deepEqual(canonical.issues, []);
const casual = validatePreferences({...empty, occasion: "Brunch", style: "Casual"}, catalogue);
assert.equal(casual.preferences.style, "Casual");
assert.equal(casual.preferences.occasion, "Brunch");
assert.equal(casual.issues[0].field, "style");
assert.equal(casual.needs_clarification, false);
for (const prefs of [{size: "99"}, {excluded_colours: ["Ultraviolet"]}, {category: "Shoes" as const, subcategory: "Dresses"}, {min_price: 200, max_price: 100}]) {
  assert.equal(validatePreferences({...empty, ...prefs}, catalogue).needs_clarification, true);
}
assert.deepEqual(validatePreferences({...empty, size: "12"}, catalogue).issues, []);
assert.deepEqual(validatePreferences(empty, catalogue).preferences, empty);
console.log("PASS: normalisation, deduplication, input preservation, unsupported soft/hard values, category relationship, budget conflict, reference sizes and unknown preferences");

if (process.argv.includes("--live")) {
  import("../lib/catalogue/preferenceValues").then(async ({loadPreferenceValues}) => {
    const live = await loadPreferenceValues();
    const result = validatePreferences({...empty, occasion: "Brunch", style: "Casual"}, live);
    assert(result.issues.some(issue => issue.field === "style"));
    assert.equal(result.preferences.occasion, "Brunch");
    console.log(JSON.stringify({visible_products: live.rows.length, result}, null, 2));
  }).catch(() => { console.error("FAIL: live catalogue validation"); process.exitCode = 1; });
}
