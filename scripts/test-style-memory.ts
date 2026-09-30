import assert from "node:assert/strict";
import { searchByPreferences } from "../lib/search/preferenceSearch";
import type { ShoppingPreferences } from "../lib/ai/preferenceSchema";
import type { CatalogueProduct } from "../lib/recommendations/catalogue";
import type { StyleProfile } from "../lib/style/schema";
import { commonStyleMemory } from "../lib/style/commonMemory";
import { normaliseSearchPreferences } from "../lib/style/normaliseSearch";

assert.deepEqual(commonStyleMemory("I do not like skinny jeans"), {
  kind: "avoid", facet: "fit", value: "Skinny", item_scope: "Jeans", item_type: null, size_system: null,
});
assert.deepEqual(commonStyleMemory("My dress size is AU 10"), {
  kind: "size", facet: null, value: "10", item_scope: null, item_type: "dress", size_system: "AU",
});
assert.deepEqual(commonStyleMemory("I wear EU 39 shoes"), {
  kind: "size", facet: null, value: "39", item_scope: null, item_type: "shoes", size_system: "EU",
});

const base: ShoppingPreferences = {
  gender: null, category: "Clothing", subcategory: "Dresses", product_type: null,
  occasion: null, style: null, preferred_colours: [], excluded_colours: [],
  season: null, material: null, fit: null, size: null, min_price: null,
  max_price: null, brand_line: null,
};

assert.deepEqual(normaliseSearchPreferences("Show me blue dresses", {
  ...base, gender: "Women", subcategory: null, product_type: "Dresses",
}), { ...base, gender: null, subcategory: "Dresses", product_type: null });

function product(id: string, overrides: Partial<CatalogueProduct> = {}): CatalogueProduct {
  return {
    product_id: id, product_name: id, brand_line: "ABC Occasion", gender: "Women",
    category: "Clothing", subcategory: "Dresses", product_type: "Midi Dress",
    colour: "Blue", style: "Classic", occasion: "Dinner", season: null,
    material: "Cotton", fit: "Relaxed", sizes_available: ["10"], price_aud: 100,
    stock_qty: 3, description: "", tags: [], cross_sell_category: null,
    image_key: null, is_available: true, ...overrides,
  };
}

const profile: StyleProfile = {
  preferred_name: "Sam",
  sizes: [
    { item_type: "dress", size_system: "AU", size_label: "10" },
    { item_type: "shoes", size_system: "EU", size_label: "39" },
  ],
  memories: [{ id: "1", kind: "avoid", facet: "fit", value: "Skinny", item_scope: "Jeans", created_at: "2026-09-28" }],
};

const dressResult = searchByPreferences([
  product("size-10"), product("size-12", { sizes_available: ["12"] }),
], base, profile);
assert.deepEqual(dressResult.products.map((item) => item.product_id), ["size-10"]);
assert.ok(dressResult.applied_memories?.some((line) => line.includes("AU 10 dress")));
assert.ok(!dressResult.applied_memories?.some((line) => line.includes("Skinny")));

const override = searchByPreferences([
  product("size-10"), product("size-12", { sizes_available: ["12"] }),
], { ...base, size: "12" }, profile);
assert.deepEqual(override.products.map((item) => item.product_id), ["size-12"]);
assert.ok(!override.applied_memories?.some((line) => line.includes("AU 10")));

const jeans = [
  product("skinny", { subcategory: "Jeans", product_type: "Skinny Jeans", fit: "Skinny" }),
  product("relaxed", { subcategory: "Jeans", product_type: "Relaxed Jeans", fit: "Relaxed" }),
  product("unknown", { subcategory: "Jeans", product_type: "Jeans", fit: null }),
];
const ordinaryJeans = searchByPreferences(jeans, { ...base, subcategory: "Jeans" }, profile);
assert.deepEqual(ordinaryJeans.products.map((item) => item.product_id), ["relaxed"]);
assert.ok(ordinaryJeans.applied_memories?.some((line) => line.includes("Skinny")));

const bottoms = searchByPreferences(jeans.map((item) => ({ ...item, subcategory: "Bottoms" })), { ...base, subcategory: "Bottoms" }, profile);
assert.deepEqual(bottoms.products.map((item) => item.product_id), ["relaxed"]);
assert.ok(bottoms.applied_memories?.some((line) => line.includes("Skinny")));

const requestedSkinny = searchByPreferences(jeans, { ...base, subcategory: "Jeans", fit: "Skinny" }, profile);
assert.ok(requestedSkinny.products.some((item) => item.product_id === "skinny"));

const shoes = searchByPreferences([
  product("shoe-39", { category: "Shoes", subcategory: null, product_type: "Loafers", sizes_available: ["EU 39"] }),
  product("shoe-40", { category: "Shoes", subcategory: null, product_type: "Loafers", sizes_available: ["40"] }),
], { ...base, category: "Shoes", subcategory: null }, profile);
assert.deepEqual(shoes.products.map((item) => item.product_id), ["shoe-39"]);

const unlabelledEuShoes = searchByPreferences([
  product("shoe-39", { category: "Shoes", subcategory: null, product_type: "Loafers", sizes_available: ["39"] }),
], { ...base, category: "Shoes", subcategory: null }, profile);
assert.equal(unlabelledEuShoes.status, "no_match");

const usDress = searchByPreferences([product("size-10")], base, {
  ...profile, sizes: [{ item_type: "dress", size_system: "US", size_label: "10" }],
});
assert.equal(usDress.status, "no_match");

const noSize = searchByPreferences([product("size-12", { sizes_available: ["12"] })], base, profile);
assert.equal(noSize.status, "no_match");
assert.match(noSize.message, /saved AU 10 dress size/);

const noteProfile: StyleProfile = {
  preferred_name: "Sam", sizes: [],
  memories: [{ id: "2", kind: "note", facet: "note", value: "I prefer sleeves", item_scope: null, created_at: "2026-09-28" }],
};
const noteResult = searchByPreferences([
  product("plain", { tags: [] }), product("sleeved", { tags: ["sleeves"] }),
], base, noteProfile);
assert.equal(noteResult.products[0]?.product_id, "sleeved");
assert.ok(noteResult.applied_memories?.some((line) => line.includes("prefer sleeves")));

const unsupportedNote = searchByPreferences([product("plain", { tags: [] })], base, noteProfile);
assert.ok(!unsupportedNote.applied_memories?.some((line) => line.includes("prefer sleeves")));

console.log("Style memory search cases passed.");
