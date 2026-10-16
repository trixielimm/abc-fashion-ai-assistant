import assert from "node:assert/strict";
import {
  buildUpsellRequest,
  readUpsellResponse,
} from "../lib/search/upsellClient.ts";

// Synthetic fixtures only. No OpenAI or Supabase requests.
const preferences = {
  gender: null, category: "Clothing", subcategory: null,
  product_type: null, occasion: "Beach Wedding", style: "Relaxed",
  preferred_colours: ["Lavender"], excluded_colours: ["Brown"],
  season: null, material: null, fit: null, size: "10",
  min_price: null, max_price: 100, brand_line: null,
};

const primary = {
  product_id: "MAIN", product_name: "Synthetic Main Shirt",
  category: "Clothing", subcategory: "Tops", product_type: "Shirt",
};

const option = {
  product_id: "OPTION", product_name: "Synthetic Alternative Shirt",
  price_aud: 70, brand_line: null, category: "Clothing",
  subcategory: "Tops", product_type: "Shirt", colour: "Lavender",
  sizes_available: ["10"], extra_cost_aud: 20,
  improved_preferences: [
    "style: requested Relaxed; main Formal; alternative Relaxed",
  ],
  unmatched_preferences: [],
  explanation:
    "Optional replacement, A$20.00 more. Adds the recorded Relaxed style match.",
};

const request = buildUpsellRequest("MAIN", preferences);

const reply = {
  status: "options", message: "Optional replacement within budget.",
  primary_product_id: "MAIN", primary_price_aud: 50,
  budget_scope: "per_replacement_item",
  applied_preferences: { ...preferences }, products: [option],
};

const read = (value) =>
  readUpsellResponse(value, request, primary);

let passed = 0;

function check(name, test) {
  test();
  passed++;
  console.log(`PASS: ${name}`);
}

check("Request preserves all preferences without mutating them", () => {
  assert.deepEqual(request.preferences, preferences);
  assert.notStrictEqual(request.preferences, preferences);
  assert.notStrictEqual(
    request.preferences.excluded_colours,
    preferences.excluded_colours
  );
  assert.deepEqual(
    Object.keys(request).sort(),
    ["preferences", "primary_product_id"]
  );
});

check("Invalid supplied values and missing reference product are rejected", () => {
  for (const change of [
  { size: " " },
  { max_price: -1 },
  { max_price: 100.001 },
  { min_price: 101 },
]) {
    assert.throws(() =>
      buildUpsellRequest("MAIN", { ...preferences, ...change })
    );
  }

  assert.throws(() => buildUpsellRequest(" ", preferences));

  assert.equal(
    buildUpsellRequest(
      "MAIN", { ...preferences, max_price: 0 }
    ).preferences.max_price,
    0
  );
});

check("Valid options and their comparison evidence are accepted", () => {
  const result = read(reply);
  assert.equal(result.products[0].extra_cost_aud, 20);
  assert.equal(result.products[0].improved_preferences.length, 1);
});

check("No-upsell and clarification statuses accept empty results", () => {
  for (const status of [
    "no_upsell", "needs_more_detail",
    "primary_unavailable", "primary_mismatch",
  ]) {
    const result = read({
      ...reply, status, applied_preferences: null, products: [],
    });
    assert.deepEqual(result.products, []);
  }
});

check("Results cannot belong to another main product", () => {
  assert.throws(() =>
    read({ ...reply, primary_product_id: "OTHER" })
  );

  assert.throws(() =>
    readUpsellResponse(reply, request, {
      ...primary, product_id: "OTHER",
    })
  );
});

check("Applied preferences cannot silently change", () => {
  for (const change of [
    { max_price: 200 }, { size: "12" }, { preferred_colours: [] },
    { excluded_colours: [] }, { style: null }, { occasion: null },
  ]) {
    assert.throws(() =>
      read({
        ...reply,
        applied_preferences: { ...preferences, ...change },
      })
    );
  }
});

check("Equal, cheaper and over-budget replacements are rejected", () => {
  for (const price of [50, 49, 101]) {
    assert.throws(() =>
      read({
        ...reply,
        products: [{ ...option, price_aud: price }],
      })
    );
  }

  assert.equal(
    read({
      ...reply,
      products: [{
        ...option, price_aud: 100, extra_cost_aud: 50,
      }],
    }).products.length,
    1
  );
});

check("Size and like-for-like product identity are checked", () => {
  for (const change of [
    { sizes_available: ["10.5"] }, { category: "Bags" },
    { subcategory: "Outerwear" }, { product_type: "Jacket" },
  ]) {
    assert.throws(() =>
      read({ ...reply, products: [{ ...option, ...change }] })
    );
  }
});

check("Duplicate options and the main item are rejected", () => {
  assert.throws(() =>
    read({ ...reply, products: [option, option] })
  );

  assert.throws(() =>
    read({
      ...reply,
      products: [{ ...option, product_id: "MAIN" }],
    })
  );
});

check("Price differences must agree and invalid precision is rejected", () => {
  assert.throws(() =>
    read({
      ...reply,
      products: [{ ...option, extra_cost_aud: 1 }],
    })
  );

  assert.throws(() =>
    read({
      ...reply,
      products: [{ ...option, price_aud: 70.001 }],
    })
  );

  assert.equal(
    read({
      ...reply,
      products: [{
        ...option, price_aud: 50.01, extra_cost_aud: 0.01,
      }],
    }).products[0].extra_cost_aud,
    0.01
  );
});

check("Options require evidence and status must agree with products", () => {
  assert.throws(() =>
    read({
      ...reply,
      products: [{ ...option, improved_preferences: [] }],
    })
  );

  assert.throws(() => read({ ...reply, products: [] }));
  assert.throws(() => read({ ...reply, status: "no_upsell" }));

  assert.throws(() =>
    read({ ...reply, budget_scope: "whole_outfit" })
  );
});

check("Remaining differences survive response validation", () => {
  const result = read({
    ...reply,
    products: [{
      ...option,
      unmatched_preferences: [
        "fit: requested Loose; alternative Regular",
      ],
    }],
  });

  assert.equal(
    result.products[0].unmatched_preferences.length,
    1
  );
});

console.log(`\n${passed} upsell client checks passed.`);