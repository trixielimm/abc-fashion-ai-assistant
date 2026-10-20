import assert from "node:assert/strict";
import { searchWithValidatedPreferences } from "../lib/search/validatedPreferenceSearch.ts";

// Synthetic fixtures only. No OpenAI or Supabase calls.
const product = {
  product_id: "TEST-01",
  product_name: "Synthetic Lavender Set",
  price_aud: 55,
  stock_qty: 2,
  is_available: true,
  gender: "Women",
  brand_line: "ABC Casual",
  category: "Clothing",
  subcategory: "Sets",
  product_type: "Co-ord Set",
  colour: "Lavender",
  occasion: "Beach Wedding",
  style: "Relaxed",
  season: "Summer",
  material: "Cotton",
  fit: "Regular",
  sizes_available: ["10"],
  description: null,
  tags: [],
  cross_sell_category: null,
  image_key: null,
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
  size: "10",
  min_price: null,
  max_price: 100,
  brand_line: null,
};

// Reference vocabulary is separate from saleable stock.
// A defined size can exist even when no product is available in that size.
const vocabulary = {
  rows: [product],
  sizes: ["10", "10.5", "12", "One Size"],
  categories: [
    { category: "Clothing", subcategory: null },
    { category: "Clothing", subcategory: "Sets" },
    { category: "Shoes", subcategory: "Heels" },
  ],
};

function run(productChanges = {}, preferenceChanges = {}) {
  return searchWithValidatedPreferences(
    [{ ...product, ...productChanges }],
    { ...preferences, ...preferenceChanges },
    vocabulary
  );
}

function noMatch(output) {
  assert.equal(output.result.status, "no_match");
  assert.deepEqual(output.result.products, []);
}

let passed = 0;

function check(name, test) {
  test();
  passed += 1;
  console.log(`PASS: ${name}`);
}

check("Recognised labels are normalised without changing the input", () => {
  const input = {
    ...preferences,
    style: " relaxed ",
    preferred_colours: [" lavender ", "LAVENDER"],
  };

  const output = searchWithValidatedPreferences(
    [product],
    input,
    vocabulary
  );

  assert.equal(output.validation.preferences.style, "Relaxed");
  assert.deepEqual(
    output.validation.preferences.preferred_colours,
    ["Lavender"]
  );
  assert.equal(output.result.status, "matches");
  assert.equal(input.style, " relaxed ");
  assert.equal(input.preferred_colours.length, 2);
});

check("Unknown material, preferred colour and brand require clarification", () => {
  const cases = [
    ["material", "Unobtainium"],
    ["preferred_colours", ["Ultraviolet"]],
    ["brand_line", "ABC Occasion"],
  ];

  for (const [field, value] of cases) {
    const output = run({}, { [field]: value });

    assert.equal(output.validation.needs_clarification, true);
    assert.equal(output.result.status, "needs_more_detail");
    assert.deepEqual(output.result.products, []);
    assert.deepEqual(output.validation.preferences[field], value);
  }
});

check("Unknown style is retained and disclosed as a partial preference", () => {
  const output = run({}, { style: "Futuristic" });

  assert.equal(output.validation.needs_clarification, false);
  assert.equal(output.validation.preferences.style, "Futuristic");
  assert.equal(output.result.status, "partial");
  assert.ok(output.result.message.includes("Futuristic"));
});

check("Contradictory budgets request clarification", () => {
  const output = run({}, { min_price: 200, max_price: 100 });

  assert.equal(output.result.status, "needs_more_detail");
  assert.deepEqual(output.result.products, []);
});

check("Incompatible category and subcategory request clarification", () => {
  const output = run({}, {
    category: "Shoes",
    subcategory: "Sets",
  });

  assert.equal(output.result.status, "needs_more_detail");
  assert.ok(
    output.validation.issues.some(
      (issue) => issue.code === "category_mismatch"
    )
  );
});

check("Price at the maximum is allowed; higher price is excluded", () => {
  assert.equal(run({ price_aud: 100 }).result.products.length, 1);
  noMatch(run({ price_aud: 101 }));
});

check("Zero-dollar and minimum-price filters are honoured", () => {
  noMatch(run({}, { max_price: 0 }));

  assert.equal(
    run({ price_aud: 0 }, { max_price: 0 }).result.products.length,
    1
  );

  noMatch(run({}, { min_price: 60 }));
});

check("A defined but unavailable size produces no match", () => {
  const output = run({}, { size: "12" });

  assert.equal(output.validation.needs_clarification, false);
  noMatch(output);
});

check("Size 10 does not match size 10.5", () => {
  noMatch(run({ sizes_available: ["10.5"] }));
});

check("One Size matching ignores case and extra spaces only", () => {
  const output = run(
    { sizes_available: [" one   size "] },
    { size: "One Size" }
  );

  assert.equal(output.result.products.length, 1);
});

check("Unavailable products and invalid stock are excluded", () => {
  noMatch(run({ is_available: false }));

  for (const stock_qty of [0, -1, 1.5, Number.POSITIVE_INFINITY]) {
    noMatch(run({ stock_qty }));
  }
});

check("Preferred and excluded colours remain required filters", () => {
  noMatch(run({ colour: "Brown" }));

  noMatch(run({}, {
    preferred_colours: [],
    excluded_colours: ["Lavender"],
  }));
});

check("Missing product colour cannot bypass a colour exclusion", () => {
  noMatch(run(
    { colour: null },
    {
      preferred_colours: [],
      excluded_colours: ["Lavender"],
    }
  ));
});

check("Malformed size lists are rejected without crashing", () => {
  for (const sizes_available of [
    [42, "10"],
    ["10", 42],
    [],
    [" "],
  ]) {
    noMatch(run({ sizes_available }));
  }
});

console.log(`\n${passed} validation-and-search checks passed.`);