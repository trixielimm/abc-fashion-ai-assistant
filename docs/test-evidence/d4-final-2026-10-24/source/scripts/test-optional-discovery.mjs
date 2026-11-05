import assert from "node:assert/strict";

import { retrieveCrossSell } from "../lib/search/crossSell.ts";
import {
  buildCrossSellRequest,
  readCrossSellResponse,
} from "../lib/search/crossSellClient.ts";

import { retrieveUpsell } from "../lib/search/upsell.ts";
import {
  buildUpsellRequest,
  readUpsellResponse,
} from "../lib/search/upsellClient.ts";

// Synthetic records only. No API or database calls.
const main = {
  product_id: "MAIN",
  product_name: "Test Shirt",
  price_aud: 50,
  category: "Clothing",
  subcategory: "Tops",
  product_type: "Shirt",
  colour: "Lavender",
  occasion: "Beach Wedding",
  style: "Formal",
  gender: null,
  brand_line: null,
  season: null,
  material: null,
  fit: null,
  sizes_available: ["10"],
  stock_qty: 2,
  is_available: true,
  cross_sell_category: "Bags",
  description: null,
  image_key: null,
  tags: [],
};

const bag = {
  ...main,
  product_id: "BAG",
  product_name: "Test Bag",
  price_aud: 120,
  category: "Bags",
  subcategory: "Clutches",
  product_type: "Clutch",
  sizes_available: ["One Size"],
  cross_sell_category: null,
};

const better = {
  ...main,
  product_id: "BETTER",
  product_name: "Test Relaxed Shirt",
  price_aud: 150,
  style: "Relaxed",
};

const rows = [main, bag, better];

const vocabulary = {
  rows,
  sizes: ["10", "12", "One Size"],
  categories: [
    { category: "Clothing", subcategory: null },
    { category: "Clothing", subcategory: "Tops" },
    { category: "Bags", subcategory: null },
    { category: "Bags", subcategory: "Clutches" },
  ],
};

const preferences = {
  gender: null,
  category: "Clothing",
  subcategory: null,
  product_type: null,
  occasion: "Beach Wedding",
  style: "Relaxed",
  preferred_colours: ["Lavender"],
  excluded_colours: [],
  season: null,
  material: null,
  fit: null,
  size: null,
  min_price: null,
  max_price: null,
  brand_line: null,
};

let passed = 0;

function check(name, test) {
  test();
  passed++;
  console.log(`PASS: ${name}`);
}

check("Cross-sell works without asking for size or budget", () => {
  const result = retrieveCrossSell(
    rows,
    { primary_product_id: "MAIN" },
    vocabulary
  );

  assert.equal(result.status, "matches");
  assert.equal(result.products[0].product_id, "BAG");
  assert.equal(result.applied_preferences.size, null);
  assert.equal(result.applied_preferences.max_price, null);
});

check("A stated cross-sell budget remains binding when size is unknown", () => {
  for (const max_price of [0, 50]) {
    const result = retrieveCrossSell(
      rows,
      { primary_product_id: "MAIN", max_price },
      vocabulary
    );

    assert.equal(result.status, "no_match");
    assert.deepEqual(result.products, []);
  }
});

check("A stated extra-item size remains binding when budget is unknown", () => {
  const result = retrieveCrossSell(
    rows,
    { primary_product_id: "MAIN", size: "12" },
    vocabulary
  );

  assert.equal(result.status, "no_match");
});

check("Blank extra budget becomes null, not zero or the main budget", () => {
  const context = {
    ...preferences,
    max_price: 100,
    size: "10",
  };

  const request = buildCrossSellRequest(
    "MAIN",
    "",
    null,
    context
  );

  assert.equal(request.max_price, null);
  assert.equal(request.size, null);
  assert.equal(context.max_price, 100);
  assert.equal(context.size, "10");

  const reply = retrieveCrossSell(rows, request, vocabulary);

  assert.equal(
    readCrossSellResponse(reply, request).products.length,
    1
  );

  assert.throws(() =>
    readCrossSellResponse(
      {
        ...reply,
        applied_preferences: {
          ...reply.applied_preferences,
          max_price: 200,
        },
      },
      request
    )
  );
});

check("Unknown discovery inputs do not allow unavailable stock", () => {
  for (const changes of [
    { stock_qty: 0 },
    { stock_qty: 1.5 },
    { is_available: false },
    { sizes_available: [] },
  ]) {
    const result = retrieveCrossSell(
      [main, { ...bag, ...changes }],
      { primary_product_id: "MAIN" },
      vocabulary
    );

    assert.deepEqual(result.products, []);
  }
});

check("Upsell can return a justified alternative without size or budget", () => {
  const request = buildUpsellRequest("MAIN", preferences);
  const result = retrieveUpsell(rows, request, vocabulary);

  assert.equal(result.status, "options");
  assert.equal(result.products[0].price_aud, 150);
  assert.equal(result.products[0].extra_cost_aud, 100);
  assert.equal(result.applied_preferences.size, null);
  assert.equal(result.applied_preferences.max_price, null);

  assert.equal(
    readUpsellResponse(result, request, main).products.length,
    1
  );
});

check("An upsell still honours whichever constraints were supplied", () => {
  for (const changes of [
    { max_price: 100 },
    { size: "12" },
  ]) {
    const request = buildUpsellRequest(
      "MAIN",
      { ...preferences, ...changes }
    );

    const result = retrieveUpsell(rows, request, vocabulary);

    assert.notEqual(result.status, "options");
    assert.deepEqual(result.products, []);
  }

  const request = buildUpsellRequest(
    "MAIN",
    { ...preferences, max_price: 100 }
  );

  const unconstrained = retrieveUpsell(
    rows,
    { primary_product_id: "MAIN", preferences },
    vocabulary
  );

  assert.throws(() =>
    readUpsellResponse(unconstrained, request, main)
  );
});

check("No budget does not justify a higher-price-only upsell", () => {
  const result = retrieveUpsell(
    [main, { ...better, style: "Formal" }],
    { primary_product_id: "MAIN", preferences },
    vocabulary
  );

  assert.equal(result.status, "no_upsell");
});

console.log(`\n${passed} optional-discovery checks passed.`);