import assert from "node:assert/strict";

import {
  automaticCartSize,
  prepareProductAction,
  ProductActionInputError,
} from "../lib/stylist/productActions.ts";

// Synthetic records only. No HTTP, OpenAI or database calls.
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
  size: null,
  min_price: null,
  max_price: null,
  brand_line: null,
};

const main = {
  product_id: "MAIN",
  product_name: "Test Main Set",
  price_aud: 55,
  brand_line: null,
  category: "Clothing",
  subcategory: "Sets",
  product_type: "Co-ord Set",
  colour: "Lavender",
  sizes_available: ["10"],
};

const bag = {
  ...main,
  product_id: "BAG",
  product_name: "Test Bag",
  price_aud: 40,
  category: "Bags",
  subcategory: "Clutches",
  product_type: "Clutch",
  sizes_available: ["One Size"],
};

const crossReply = {
  status: "matches",
  message: "Optional bag.",
  primary_product_id: "MAIN",
  target_category: "Bags",
  budget_scope: "per_additional_item",
  applied_preferences: { ...preferences, category: "Bags" },
  products: [bag],
};

function prepare(kind, changes = {}) {
  return prepareProductAction({
    kind,
    product: main,
    preferences: { ...preferences, ...changes },
  });
}

let passed = 0;

function check(name, test) {
  test();
  passed++;
  console.log(`PASS: ${name}`);
}

check("The card supplies its product ID; missing budget and size stay null", () => {
  const action = prepare("cross_sell");

  assert.equal(action.endpoint, "/api/cross-sell");
  assert.equal(action.body.primary_product_id, "MAIN");
  assert.equal(action.body.max_price, null);
  assert.equal(action.body.size, null);
});

check("An explicit maximum is retained, but clothing size is not copied to extras", () => {
  const action = prepare("cross_sell", {
    size: "10",
    max_price: 50,
  });

  assert.equal(action.body.max_price, 50);
  assert.equal(action.body.size, null);
  assert.equal(
    prepare("cross_sell", { max_price: 0 }).body.max_price,
    0
  );
  assert.deepEqual(action.body.excluded_colours, ["Brown"]);
});

check("Action construction leaves the original preferences unchanged", () => {
  const before = JSON.stringify(preferences);
  const action = prepare("upsell");

  assert.equal(JSON.stringify(preferences), before);
  assert.notStrictEqual(action.body.preferences, preferences);
  assert.equal(action.body.preferences.max_price, null);
});

check("Cross-sell supplies the next active category without changing the main request", () => {
  const result = prepare("cross_sell").read(crossReply);

  assert.equal(result.preferences.category, "Bags");
  assert.equal(result.products[0].product_id, "BAG");
  assert.equal(preferences.category, "Clothing");
});

check("A response for a different reference product is rejected", () => {
  assert.throws(() =>
    prepare("cross_sell").read({
      ...crossReply,
      primary_product_id: "OTHER",
    })
  );
});

check("No-rule responses remain normal empty results", () => {
  const result = prepare("cross_sell").read({
    ...crossReply,
    status: "no_rule",
    products: [],
    target_category: null,
    applied_preferences: null,
  });

  assert.deepEqual(result.products, []);
  assert.equal(result.preferences, null);
});

check("Unsupported saved requirements are not silently removed", () => {
  assert.throws(
    () => prepare("cross_sell", { material: "Cotton" }),
    ProductActionInputError
  );
});

check("Upsell explanations survive response handling", () => {
  const alternative = {
    ...main,
    product_id: "ALTERNATIVE",
    price_aud: 70,
    extra_cost_aud: 15,
    improved_preferences: ["style: Relaxed"],
    unmatched_preferences: [],
    explanation: "Adds a requested style match.",
  };

  const result = prepare("upsell").read({
    status: "options",
    message: "Optional alternative.",
    primary_product_id: "MAIN",
    primary_price_aud: 55,
    budget_scope: "per_replacement_item",
    applied_preferences: preferences,
    products: [alternative],
  });

  assert.equal(
    result.products[0].explanation,
    alternative.explanation
  );
});

check("Only an actual One Size label can be automatic", () => {
  assert.equal(automaticCartSize(["One Size"]), "One Size");
  assert.equal(
    automaticCartSize([" one   size "]),
    " one   size "
  );
});

check("A numbered size or multi-size product still needs a customer choice", () => {
  for (const sizes of [["10"], ["M"], ["8", "10"], []]) {
    assert.equal(automaticCartSize(sizes), null);
  }
});

console.log(`\n${passed} card-action checks passed.`);