import assert from "node:assert/strict";
import { ShoppingPreferencesSchema } from "../lib/ai/preferenceSchema";
import { buildRecommendationEvidence, renderGroundedRecommendation } from "../lib/ai/generateRecommendation";
import type { StylistProduct } from "../lib/search/preferenceSearch";

const preferences = ShoppingPreferencesSchema.parse({
  gender: null, category: "Clothing", subcategory: null, product_type: null,
  occasion: "Beach Wedding", style: "Relaxed", preferred_colours: ["Lavender"],
  excluded_colours: [], season: null, material: null, fit: null,
  size: "10", min_price: null, max_price: 100, brand_line: null,
});
const product: StylistProduct = {
  product_id: "P1002", product_name: "Lavender Co-ord Set", price_aud: 55,
  brand_line: "ABC Occasion", category: "Clothing", subcategory: "Sets",
  product_type: "Co-ord Set", colour: "Lavender", occasion: "Beach Wedding",
  style: "Relaxed", image_key: null, sizes_available: ["8", "10"],
};
const evidence = buildRecommendationEvidence(preferences, [product]);
assert.deepEqual(Object.keys(evidence[0].reasons).sort(),
  ["category", "colour", "occasion", "price", "shortlist", "size", "style"].sort());
const message = renderGroundedRecommendation(evidence, {
  highlights: [{ product_id: "P1002", reason: "colour" }],
});
assert.match(message, /Lavender Co-ord Set/);
assert.match(message, /Lavender colour matches your preference/);
assert.doesNotMatch(message, /P1003|\$100/);
assert.throws(() => renderGroundedRecommendation(evidence, {
  highlights: [{ product_id: "FAKE", reason: "colour" }],
}), /outside the retrieved evidence/);
assert.throws(() => renderGroundedRecommendation(evidence, {
  highlights: [{ product_id: "P1002", reason: "product_type" }],
}), /outside the retrieved evidence/);
assert.throws(() => renderGroundedRecommendation(evidence, { highlights: [] }),
  /must match the retrieved shortlist/);
const withoutMatch = buildRecommendationEvidence({ ...preferences, preferred_colours: ["Navy"] }, [product]);
assert.equal(withoutMatch[0].reasons.colour, undefined);
console.log("PASS: verified reasons only, catalogue wording, unknown product/claim rejection, complete shortlist, nonmatching colour omitted");
