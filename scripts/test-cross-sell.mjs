import assert from "node:assert/strict";

import {
  CrossSellRequestSchema,
  retrieveCrossSell,
} from "../lib/search/crossSell.ts";

// Synthetic fixtures only. Nothing is written to Supabase.
const main = {
  product_id: "MAIN",
  product_name: "Test Clothing Set",
  price_aud: 55,
  category: "Clothing",
  subcategory: "Sets",
  product_type: "Co-ord Set",
  colour: "Lavender",
  style: "Relaxed",
  occasion: "Beach Wedding",
  sizes_available: ["10"],
  stock_qty: 3,
  is_available: true,
  cross_sell_category: "Bags",
  gender: null,
  brand_line: null,
  season: null,
  material: null,
  fit: null,
  description: null,
  image_key: null,
  tags: [],
};

const bag = {
  ...main,
  product_id: "BAG",
  product_name: "Test Crossbody Bag",
  price_aud: 40,
  category: "Bags",
  subcategory: "Crossbody",
  product_type: "Crossbody Bag",
  colour: "Black",
  sizes_available: ["One Size"],
  cross_sell_category: null,
};

const vocabulary = {
  rows: [
    main,
    bag,
    { ...bag, colour: "Brown", style: "Formal" },
  ],
  sizes: ["7", "10", "10.5", "One Size"],
  categories: [
    { category: "Clothing", subcategory: null },
    { category: "Clothing", subcategory: "Sets" },
    { category: "Bags", subcategory: null },
    { category: "Bags", subcategory: "Crossbody" },
    { category: "Bags", subcategory: "Totes" },
    { category: "Shoes", subcategory: null },
    { category: "Shoes", subcategory: "Sneakers" },
  ],
};

const request = {
  primary_product_id: "MAIN",
  max_price: 50,
  size: "One Size",
};

function run(rows = [main, bag], changes = {}, values = vocabulary) {
  return retrieveCrossSell(
    rows,
    { ...request, ...changes },
    values
  );
}

function noMatch(result) {
  assert.equal(result.status, "no_match");
  assert.deepEqual(result.products, []);
}

let passed = 0;

function check(name, test) {
  test();
  passed += 1;
  console.log(`PASS: ${name}`);
}

check("Recorded category returns a real complementary item", () => {
  const result = run();

  assert.equal(result.status, "matches");
  assert.equal(result.target_category, "Bags");
  assert.equal(result.budget_scope, "per_additional_item");

  assert.deepEqual(
    result.products.map((p) => p.product_id),
    ["BAG"]
  );
});

check("Unavailable or missing main product cannot start cross-selling", () => {
  for (const rows of [
    [bag],
    [{ ...main, is_available: false }, bag],
  ]) {
    assert.equal(run(rows).status, "primary_unavailable");
  }
});

check("Missing and unknown rules do not invent a target category", () => {
  assert.equal(
    run([{ ...main, cross_sell_category: null }, bag]).status,
    "no_rule"
  );

  assert.equal(
    run([{ ...main, cross_sell_category: "Invented" }, bag]).status,
    "rule_unavailable"
  );
});

check("Subcategory rule does not return a different subcategory", () => {
  const tote = {
    ...bag,
    product_id: "TOTE",
    product_name: "Test Tote",
    subcategory: "Totes",
  };

  const result = run([
    { ...main, cross_sell_category: "Crossbody" },
    bag,
    tote,
  ]);

  assert.deepEqual(
    result.products.map((p) => p.product_id),
    ["BAG"]
  );
});

check("Missing additional-item size asks instead of copying the main size", () => {
  const result = run(undefined, { size: null });

  assert.equal(result.status, "needs_more_detail");
  assert.deepEqual(result.products, []);
});

check("A shoe size is supplied independently of clothing size", () => {
  const shoe = {
    ...bag,
    category: "Shoes",
    subcategory: "Sneakers",
    sizes_available: ["7"],
  };

  const rows = [
    { ...main, cross_sell_category: "Shoes" },
    shoe,
  ];

  assert.equal(run(rows, { size: "7" }).products.length, 1);
  noMatch(run(rows, { size: "10" }));
});

check("Budget boundary is inclusive and zero is not ignored", () => {
  assert.equal(
    run([main, { ...bag, price_aud: 50 }]).products.length,
    1
  );

  noMatch(run([main, { ...bag, price_aud: 51 }]));
  noMatch(run(undefined, { max_price: 0 }));
});

check("Wrong size and malformed stock or sizes are excluded", () => {
  for (const changes of [
    { sizes_available: ["10.5"] },
    { sizes_available: [42, "One Size"] },
    { stock_qty: 0 },
    { stock_qty: 1.5 },
    { is_available: false },
  ]) {
    noMatch(run([main, { ...bag, ...changes }]));
  }
});

check("Colour exclusions also reject products without a recorded colour", () => {
  for (const colour of ["Brown", null]) {
    noMatch(
      run(
        [main, { ...bag, colour }],
        { excluded_colours: ["Brown"] }
      )
    );
  }
});

check("Unknown required colour triggers clarification", () => {
  const result = run(undefined, {
    preferred_colours: ["Ultraviolet"],
  });

  assert.equal(result.status, "needs_more_detail");
  assert.deepEqual(result.products, []);
});

check("Partial-match warning is preserved", () => {
  const result = run(undefined, { style: "Formal" });

  assert.equal(result.status, "partial");
  assert.ok(result.message.includes("may differ"));
});

check("Excluded product IDs are removed before shortlisting", () => {
  const other = {
    ...bag,
    product_id: "OTHER",
    product_name: "Another Test Bag",
  };

  const result = run(
    [main, bag, other],
    { excluded_product_ids: ["BAG"] }
  );

  assert.deepEqual(
    result.products.map((p) => p.product_id),
    ["OTHER"]
  );
});

check("Main item is never returned as its own cross-sell", () => {
  const result = run(
    [{ ...main, cross_sell_category: "Clothing" }, bag],
    { size: "10" }
  );

  noMatch(result);
});

check("Missing budget and client-supplied target category are rejected", () => {
  assert.equal(
    CrossSellRequestSchema.safeParse({
      primary_product_id: "MAIN",
    }).success,
    false
  );

  assert.equal(
    CrossSellRequestSchema.safeParse({
      ...request,
      target_category: "Shoes",
    }).success,
    false
  );
});

check("Input preferences are not mutated and at most four products return", () => {
  const input = {
    ...request,
    excluded_colours: ["Brown"],
  };
  const before = JSON.stringify(input);

  const rows = [
    main,
    ...Array.from({ length: 6 }, (_, i) => ({
      ...bag,
      product_id: `BAG-${i}`,
      product_name: `Test Bag ${i}`,
    })),
  ];

  const result = retrieveCrossSell(rows, input, vocabulary);

  assert.equal(result.products.length, 4);
  assert.equal(JSON.stringify(input), before);
});

console.log(`\n${passed} cross-sell checks passed.`);