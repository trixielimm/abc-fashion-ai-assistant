import assert from "node:assert/strict";

import { searchCheaper } from "../lib/search/cheaperSearch.ts";

import {
  isCheaperMessage,
  rememberPriceContext,
} from "../lib/stylist/priceContext.ts";

// Synthetic fixtures only. No OpenAI or Supabase requests.
const main = {
  product_id: "MAIN",
  product_name: "Test Dress",
  price_aud: 100,
  category: "Clothing",
  subcategory: "Dresses",
  product_type: "Wrap Dress",
  colour: "Black",
  style: "Relaxed",
  occasion: "Wedding Guest",
  sizes_available: ["10"],
  stock_qty: 3,
  is_available: true,
  gender: null,
  brand_line: null,
  season: null,
  material: "Cotton",
  fit: null,
  description: null,
  tags: [],
  image_key: null,
  cross_sell_category: null,
};

const cheaper = {
  ...main,
  product_id: "CHEAPER",
  product_name: "Another Dress",
  price_aud: 70,
};

const preferences = {
  gender: null,
  category: "Clothing",
  subcategory: null,
  product_type: null,
  occasion: "Wedding Guest",
  style: "Relaxed",
  preferred_colours: ["Black"],
  excluded_colours: [],
  season: null,
  material: null,
  fit: null,
  size: null,
  min_price: null,
  max_price: null,
  brand_line: null,
};

const vocabulary = {
  rows: [main, cheaper, { ...main, colour: "Brown" }],
  sizes: ["10", "10.5", "12"],
  categories: [
    { category: "Clothing", subcategory: null },
    { category: "Clothing", subcategory: "Dresses" },
  ],
};

const refs = [
  { product_id: "MAIN", displayed_price_aud: 100 },
];

const run = (
  rows = [main, cheaper],
  changes = {},
  references = refs
) =>
  searchCheaper(
    rows,
    { ...preferences, ...changes },
    references,
    vocabulary
  );

let passed = 0;

function check(name, test) {
  test();
  passed++;
  console.log(`PASS: ${name}`);
}

check("Recognises common standalone cheaper requests", () => {
  for (const message of [
    "Anything cheaper?",
    "Something cheaper",
    "Can you show me cheaper options?",
    "Do you have anything less expensive?",
    "More affordable, please!",
    "Cheaper than this",
  ]) {
    assert.equal(isCheaperMessage(message), true, message);
  }
});

check("Does not swallow negation or extra instructions", () => {
  for (const message of [
    "Not cheaper",
    "Something cheaper and blue",
    "Cheaper under $50",
    "Find shoes",
    "Make it blue instead",
  ]) {
    assert.equal(isCheaperMessage(message), false, message);
  }
});

check("Searches below the reference without demanding budget or size", () => {
  const result = run();

  assert.equal(result.status, "matches");
  assert.deepEqual(
    result.products.map((p) => p.product_id),
    ["CHEAPER"]
  );
  assert.ok(result.message.includes("A$100.00"));
});

check("Never repeats the reference or equal-priced items", () => {
  assert.deepEqual(
    run([main, { ...cheaper, price_aud: 100 }]).products,
    []
  );

  assert.deepEqual(
    run([main, { ...cheaper, price_aud: 110 }]).products,
    []
  );
});

check("Keeps explicit budgets, zero and minimum prices", () => {
  assert.deepEqual(run(undefined, { max_price: 60 }).products, []);
  assert.deepEqual(run(undefined, { max_price: 0 }).products, []);
  assert.deepEqual(run(undefined, { min_price: 80 }).products, []);
  assert.equal(run(undefined, { max_price: 70 }).products.length, 1);
});

check("Preserves size, stock and colour checks", () => {
  for (const change of [
    { sizes_available: ["12"] },
    { sizes_available: ["10.5"] },
    { stock_qty: 0 },
    { stock_qty: 1.5 },
    { is_available: false },
    { colour: "Brown" },
  ]) {
    assert.deepEqual(
      run([main, { ...cheaper, ...change }], { size: "10" }).products,
      []
    );
  }

  assert.deepEqual(
    run(undefined, {
      preferred_colours: [],
      excluded_colours: ["Black"],
    }).products,
    []
  );
});

check("Uses the lowest price when comparing one shortlist", () => {
  const other = {
    ...main,
    product_id: "OTHER",
    product_name: "Other Reference",
    price_aud: 80,
  };

  const result = run(
    [main, other, cheaper],
    {},
    [...refs, { product_id: "OTHER", displayed_price_aud: 80 }]
  );

  assert.equal(result.products[0].product_id, "CHEAPER");
  assert.ok(result.message.includes("A$80.00"));
  assert.ok(result.message.includes("lowest price"));
});

check("Checks reference prices against the catalogue", () => {
  assert.equal(
    run(
      [main, cheaper],
      {},
      [{ product_id: "MAIN", displayed_price_aud: 200 }]
    ).status,
    "needs_more_detail"
  );

  assert.equal(run([cheaper]).status, "needs_more_detail");
});

check("Keeps a known product type and clarifies mixed categories", () => {
  assert.deepEqual(
    run([
      main,
      { ...cheaper, product_type: "Shirt", subcategory: "Tops" },
    ]).products,
    []
  );

  const bag = {
    ...main,
    product_id: "BAG",
    category: "Bags",
  };

  assert.equal(
    run(
      [main, bag, cheaper],
      {},
      [...refs, { product_id: "BAG", displayed_price_aud: 100 }]
    ).status,
    "needs_more_detail"
  );
});

check("Filters before shortlisting and retains partial warnings", () => {
  const expensive = Array.from({ length: 6 }, (_, i) => ({
    ...main,
    product_id: `EXP-${i}`,
    product_name: `Expensive ${i}`,
    price_aud: 120,
    stock_qty: 100,
  }));

  const result = run([
    main,
    ...expensive,
    { ...cheaper, style: "Formal" },
  ]);

  assert.equal(result.status, "partial");
  assert.deepEqual(
    result.products.map((p) => p.product_id),
    ["CHEAPER"]
  );
  assert.ok(result.message.includes("may differ"));
});

check("No-match is normal, including a zero-priced reference", () => {
  assert.equal(run([main]).status, "no_match");

  assert.equal(
    run(
      [{ ...main, price_aud: 0 }, cheaper],
      {},
      [{ product_id: "MAIN", displayed_price_aud: 0 }]
    ).status,
    "no_match"
  );
});

check("Context is copied and comparisons do not rewrite the saved budget", () => {
  const saved = rememberPriceContext([main], preferences);

  assert.notStrictEqual(saved.preferences, preferences);

  searchCheaper(
    [main, cheaper],
    saved.preferences,
    saved.references,
    vocabulary
  );

  assert.equal(saved.preferences.max_price, null);
  assert.equal(rememberPriceContext([], preferences), null);

  const next = rememberPriceContext([cheaper], preferences);

  assert.equal(
    searchCheaper(
      [main, cheaper],
      next.preferences,
      next.references,
      vocabulary
    ).status,
    "no_match"
  );
});

console.log(`\n${passed} cheaper-search checks passed.`);