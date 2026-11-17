import assert from "node:assert/strict";

import {
  buildCrossSellRequest,
  readCrossSellResponse,
} from "../lib/search/crossSellClient.ts";

// Synthetic data only. No OpenAI or Supabase requests.
const preferences = {
  gender: null,
  category: "Clothing",
  subcategory: null,
  product_type: null,
  occasion: "Beach Wedding",
  style: "Relaxed",
  preferred_colours: ["Lavender"],
  excluded_colours: ["Brown"],
  season: null,
  material: null,
  fit: null,
  size: "10",
  min_price: null,
  max_price: 100,
  brand_line: null,
};

const request = buildCrossSellRequest(
  "MAIN",
  "50",
  "One Size",
  preferences
);

const product = {
  product_id: "BAG",
  product_name: "Synthetic Test Bag",
  price_aud: 45,
  brand_line: null,
  category: "Bags",
  subcategory: "Clutches",
  product_type: "Clutch",
  colour: "Lavender",
  sizes_available: ["One Size"],
};

const reply = {
  status: "matches",
  message: "Optional catalogue additions.",
  primary_product_id: "MAIN",
  target_category: "Bags",
  budget_scope: "per_additional_item",
  applied_preferences: {
    ...preferences,
    category: "Bags",
    size: "One Size",
    max_price: 50,
  },
  products: [product],
};

let passed = 0;

function check(name, test) {
  test();
  passed++;
  console.log(`PASS: ${name}`);
}

check("Additional budget and size are separate from the main request", () => {
  assert.equal(request.max_price, 50);
  assert.equal(request.size, "One Size");
  assert.equal(preferences.max_price, 100);
  assert.equal(preferences.size, "10");
  assert.equal("category" in request, false);
});

check("Shared preferences and exclusions are copied without mutation", () => {
  assert.deepEqual(request.preferred_colours, ["Lavender"]);
  assert.deepEqual(request.excluded_colours, ["Brown"]);
  assert.equal(request.occasion, "Beach Wedding");
  assert.equal(request.style, "Relaxed");

  assert.notStrictEqual(
    request.excluded_colours,
    preferences.excluded_colours
  );
});

check("Invalid budgets and empty selections are rejected", () => {
  for (const value of ["-1", "abc", "1e2", "50.999"]) {
    assert.throws(() =>
      buildCrossSellRequest("MAIN", value, null, preferences)
    );
  }

  assert.throws(() =>
    buildCrossSellRequest("", "50", null, preferences)
  );

  assert.throws(() =>
    buildCrossSellRequest("MAIN", "50", " ", preferences)
  );
});

check("Zero budget and an unanswered size are preserved", () => {
  const value = buildCrossSellRequest(
    "MAIN",
    "0",
    null,
    preferences
  );

  assert.equal(value.max_price, 0);
  assert.equal(value.size, null);
});

check("Unsupported saved preferences are not silently discarded", () => {
  for (const change of [
    { material: "Cotton" },
    { brand_line: "ABC Accessories" },
    { fit: "Regular" },
    { season: "Summer" },
  ]) {
    assert.throws(() =>
      buildCrossSellRequest("MAIN", "50", null, {
        ...preferences,
        ...change,
      })
    );
  }
});

check("Valid product response is accepted", () => {
  const value = readCrossSellResponse(reply, request);
  assert.equal(value.products[0].product_id, "BAG");
});

check("Responses for another main product or budget are rejected", () => {
  assert.throws(() =>
    readCrossSellResponse(
      { ...reply, primary_product_id: "OTHER" },
      request
    )
  );

  assert.throws(() =>
    readCrossSellResponse(
      {
        ...reply,
        applied_preferences: {
          ...reply.applied_preferences,
          max_price: 100,
        },
      },
      request
    )
  );
});

check("Main product, over-budget items and wrong sizes are rejected", () => {
  for (const change of [
    { product_id: "MAIN" },
    { price_aud: 51 },
    { sizes_available: ["10"] },
    { category: "Shoes" },
  ]) {
    assert.throws(() =>
      readCrossSellResponse(
        {
          ...reply,
          products: [{ ...product, ...change }],
        },
        request
      )
    );
  }
});

check("No-match and clarification responses remain empty", () => {
  for (const status of [
    "no_match",
    "needs_more_detail",
    "no_rule",
  ]) {
    const value = readCrossSellResponse(
      {
        ...reply,
        status,
        products: [],
        applied_preferences: null,
      },
      request
    );

    assert.deepEqual(value.products, []);
  }

  assert.throws(() =>
    readCrossSellResponse(
      { ...reply, status: "no_match" },
      request
    )
  );
});

check("Duplicate IDs and unexpected budget scope are rejected", () => {
  assert.throws(() =>
    readCrossSellResponse(
      { ...reply, products: [product, product] },
      request
    )
  );

  assert.throws(() =>
    readCrossSellResponse(
      { ...reply, budget_scope: "whole_outfit" },
      request
    )
  );
});

console.log(`\n${passed} cross-sell client checks passed.`);