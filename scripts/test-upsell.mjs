import assert from "node:assert/strict";

import {
  retrieveUpsell,
  UpsellRequestSchema,
} from "../lib/search/upsell.ts";

// Synthetic fixtures only. No Supabase or OpenAI calls.
const main = {
  product_id: "MAIN",
  product_name: "Test Main Shirt",
  price_aud: 50,
  stock_qty: 4,
  is_available: true,
  category: "Clothing",
  subcategory: "Tops",
  product_type: "Shirt",
  gender: "Women",
  colour: "Lavender",
  style: "Formal",
  occasion: "Beach Wedding",
  fit: "Regular",
  season: "Summer",
  material: "Cotton",
  brand_line: "ABC Casual",
  sizes_available: ["10"],
  description: null,
  tags: [],
  cross_sell_category: null,
  image_key: null,
};

const better = {
  ...main,
  product_id: "OPTION",
  product_name: "Test Alternative Shirt",
  price_aud: 70,
  style: "Relaxed",
};

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

const vocabulary = {
  rows: [
    main,
    better,
    {
      ...main,
      colour: "Brown",
      fit: "Loose",
      material: "Silk",
      season: "Winter",
    },
  ],
  sizes: ["10", "10.5", "12"],
  categories: [
    { category: "Clothing", subcategory: null },
    { category: "Clothing", subcategory: "Tops" },
    { category: "Clothing", subcategory: "Outerwear" },
    { category: "Bags", subcategory: null },
  ],
};

const request = {
  primary_product_id: "MAIN",
  preferences,
};

function run(change = {}, preferenceChange = {}) {
  return retrieveUpsell(
    [main, { ...better, ...change }],
    {
      ...request,
      preferences: {
        ...preferences,
        ...preferenceChange,
      },
    },
    vocabulary
  );
}

function noUpsell(result) {
  assert.equal(result.status, "no_upsell");
  assert.deepEqual(result.products, []);
}

let passed = 0;

function check(name, test) {
  test();
  passed++;
  console.log(`PASS: ${name}`);
}

check("Higher-priced replacement needs a specific added match", () => {
  const result = run();

  assert.equal(result.status, "options");
  assert.equal(result.budget_scope, "per_replacement_item");
  assert.equal(result.products[0].product_id, "OPTION");
  assert.equal(result.products[0].extra_cost_aud, 20);

  assert.ok(
    result.products[0].improved_preferences[0].includes("style")
  );

  assert.deepEqual(
    result.products[0].unmatched_preferences,
    []
  );
});

check("Higher price with identical matches is not an upsell", () => {
  noUpsell(run({ style: "Formal" }));
});

check("Existing matched preferences cannot be sacrificed", () => {
  noUpsell(run({ occasion: "Work" }));
});

check("Maximum is inclusive; higher prices never pass", () => {
  assert.equal(run({ price_aud: 100 }).products.length, 1);
  noUpsell(run({ price_aud: 100.01 }));
});

check("Equal-price and cheaper items are not upsells", () => {
  for (const price_aud of [50, 49]) {
    noUpsell(run({ price_aud }));
  }
});

check("Same category, subcategory, product type and collection are required", () => {
  for (const change of [
    { category: "Bags" },
    { subcategory: "Outerwear" },
    { product_type: "Jacket" },
    { gender: "Men" },
  ]) {
    noUpsell(run(change));
  }
});

check("Wrong sizes, unavailable products and invalid stock are excluded", () => {
  for (const change of [
    { sizes_available: ["12"] },
    { sizes_available: ["10.5"] },
    { sizes_available: [42, "10"] },
    { stock_qty: 0 },
    { stock_qty: 1.5 },
    { is_available: false },
  ]) {
    noUpsell(run(change));
  }
});

check("Colour, exclusions and material requirements remain enforced", () => {
  noUpsell(run({ colour: "Brown" }));

  noUpsell(
    run({ colour: null }, { preferred_colours: [] })
  );

  noUpsell(
    run({ material: "Silk" }, { material: "Cotton" })
  );
});

check("Unknown size or budget does not block a qualifying replacement", () => {
  for (const change of [
    { size: null },
    { max_price: null },
    { size: null, max_price: null },
  ]) {
    const result = run({}, change);

    assert.equal(result.status, "options");
    assert.equal(result.products[0].product_id, "OPTION");

    assert.equal(
      result.applied_preferences.size,
      "size" in change ? null : "10"
    );

    assert.equal(
      result.applied_preferences.max_price,
      "max_price" in change ? null : 100
    );
  }
});

check("A zero budget is not treated as unlimited", () => {
  const result = retrieveUpsell(
    [{ ...main, price_aud: 0 }, better],
    {
      ...request,
      preferences: { ...preferences, max_price: 0 },
    },
    vocabulary
  );

  noUpsell(result);
});

check("Main product must exist and still pass the request", () => {
  assert.equal(
    retrieveUpsell([better], request, vocabulary).status,
    "primary_unavailable"
  );

  assert.equal(
    run({}, { max_price: 40 }).status,
    "primary_mismatch"
  );
});

check("No requested context improvement means no price-only upsell", () => {
  noUpsell(run({}, { style: "Formal" }));

  noUpsell(
    run({}, { style: null, occasion: null })
  );
});

check("Required values are validated and requests are not mutated", () => {
  assert.equal(
    run({}, { material: "Unobtainium" }).status,
    "needs_more_detail"
  );

  const before = JSON.stringify(request);
  run();

  assert.equal(JSON.stringify(request), before);
});

check("Remaining unmatched preferences are disclosed", () => {
  const result = run({}, { fit: "Loose" });

  assert.equal(result.status, "options");

  assert.ok(
    result.products[0].unmatched_preferences[0].includes("fit")
  );

  assert.ok(
    result.products[0].explanation.includes("Still not matched")
  );
});

check("Exclusions happen before the shortlist, not afterward", () => {
  const distractors = Array.from({ length: 6 }, (_, i) => ({
    ...better,
    product_id: `CHEAP-${i}`,
    product_name: `Cheap ${i}`,
    price_aud: 45,
    stock_qty: 100,
  }));

  const rows = [main, ...distractors, better];
  const result = retrieveUpsell(rows, request, vocabulary);

  assert.deepEqual(
    result.products.map((p) => p.product_id),
    ["OPTION"]
  );

  noUpsell(
    retrieveUpsell(
      rows,
      {
        ...request,
        excluded_product_ids: ["OPTION"],
      },
      vocabulary
    )
  );
});

check("Price differences use cents; client price overrides are rejected", () => {
  assert.equal(
    run({ price_aud: 50.01 }).products[0].extra_cost_aud,
    0.01
  );

  noUpsell(run({ price_aud: 50.001 }));

  assert.equal(
    UpsellRequestSchema.safeParse({
      ...request,
      primary_price_aud: 1,
    }).success,
    false
  );

  assert.equal(
    UpsellRequestSchema.safeParse({
      ...request,
      max_price: 500,
    }).success,
    false
  );
});

console.log(`\n${passed} upsell checks passed.`);