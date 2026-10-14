import assert from "node:assert/strict";

import {
  executeConversationSearch,
} from "../lib/stylist/conversationSearch.ts";

import {
  createPreferenceScopes,
} from "../lib/stylist/preferenceScope.ts";

// Synthetic catalogue and simulated AI plans. No network calls.
const dress = {
  product_id: "D1",
  product_name: "Test Lavender Dress",
  category: "Clothing",
  subcategory: "Dresses",
  product_type: "Wrap Dress",
  price_aud: 100,
  stock_qty: 5,
  is_available: true,
  sizes_available: ["10"],
  colour: "Lavender",
  material: "Cotton",
  occasion: "Beach Wedding",
  style: "Formal",
  gender: null,
  fit: "Regular",
  season: "Summer",
  brand_line: null,
  description: null,
  tags: [],
  image_key: null,
  cross_sell_category: "Bags",
};

const blueDress = {
  ...dress,
  product_id: "D2",
  product_name: "Test Blue Dress",
  colour: "Blue",
  price_aud: 70,
  style: "Relaxed",
};

const upgrade = {
  ...dress,
  product_id: "D3",
  product_name: "Test Relaxed Dress",
  price_aud: 120,
  style: "Relaxed",
};

const bag = {
  ...dress,
  product_id: "B1",
  product_name: "Test Blue Bag",
  category: "Bags",
  subcategory: "Clutches",
  product_type: "Clutch",
  colour: "Blue",
  price_aud: 45,
  sizes_available: ["One Size"],
  style: "Relaxed",
  cross_sell_category: null,
};

const costlyBag = {
  ...bag,
  product_id: "B2",
  product_name: "Test Silk Bag",
  price_aud: 80,
  material: "Silk",
};

const rows = [
  dress,
  blueDress,
  upgrade,
  bag,
  costlyBag,
];

const vocabulary = {
  rows,
  sizes: ["10", "12", "One Size"],
  categories: [
    { category: "Clothing", subcategory: null },
    { category: "Clothing", subcategory: "Dresses" },
    { category: "Bags", subcategory: null },
    { category: "Bags", subcategory: "Clutches" },
    { category: "Shoes", subcategory: null },
  ],
};

const snapshot = ({
  product_id,
  product_name,
  category,
  subcategory,
  product_type,
  price_aud,
}) => ({
  product_id,
  product_name,
  category,
  subcategory,
  product_type,
  price_aud,
});

const context = {
  focused: null,
  latest: [snapshot(dress)],
};

const change = (
  field,
  value,
  evidence,
  scope = "item",
  operation = "set"
) => ({
  field,
  value,
  evidence,
  scope,
  operation,
});

function execute(
  action,
  message,
  changes = [],
  options = {}
) {
  return executeConversationSearch(
    options.rows ?? rows,
    {
      message,
      scopes: options.scopes ?? createPreferenceScopes(),
      context: options.context ?? context,
    },
    {
      action,
      intent_evidence: message,
      changes,
      reference: options.reference ?? null,
      question: options.question ?? null,
    },
    vocabulary
  );
}

const cross = (
  options = {},
  changes = [change("category", "Bags", "bag")]
) =>
  execute(
    "cross_sell",
    "Find a bag for this dress",
    changes,
    options
  );

let passed = 0;

function check(name, test) {
  test();
  passed++;
  console.log(`PASS: ${name}`);
}

check("A new search returns catalogue products without size or budget", () => {
  const result = execute(
    "new_search",
    "Show bags",
    [change("category", "Bags", "bags")]
  );

  assert.equal(result.status, "matches");
  assert.equal(result.products.length, 2);
  assert.equal(result.applied_preferences.max_price, null);
  assert.equal(result.applied_preferences.size, null);
});

check("Cross-sell clears dress-only colour and budget, not shared restrictions", () => {
  const scopes = createPreferenceScopes();

  Object.assign(scopes.item, {
    category: "Clothing",
    size: "10",
    max_price: 30,
    preferred_colours: ["Lavender"],
  });

  const result = cross({ scopes });

  assert.equal(result.status, "matches");
  assert.equal(result.target_category, "Bags");
  assert.equal(result.applied_preferences.max_price, null);
  assert.deepEqual(
    result.applied_preferences.preferred_colours,
    []
  );
  assert.equal(result.applied_preferences.size, null);
});

check("Shared budget remains binding without becoming an item override", () => {
  const scopes = createPreferenceScopes();
  scopes.shared.max_price = 50;

  const result = cross({ scopes });

  assert.deepEqual(
    result.products.map((product) => product.product_id),
    ["B1"]
  );
  assert.equal(result.proposed_scopes.shared.max_price, 50);
  assert.equal(result.proposed_scopes.item.max_price, null);
});

check("Cross-sell applies material and minimum-price restrictions before shortlisting", () => {
  const scopes = createPreferenceScopes();
  scopes.shared.material = "Cotton";
  scopes.shared.min_price = 40;

  const distractors = Array.from(
    { length: 6 },
    (_, index) => ({
      ...costlyBag,
      product_id: `S${index}`,
      product_name: `Silk ${index}`,
      stock_qty: 100,
    })
  );

  const result = cross({
    scopes,
    rows: [dress, ...distractors, bag],
  });

  assert.deepEqual(
    result.products.map((product) => product.product_id),
    ["B1"]
  );

  scopes.shared.min_price = 50;
  assert.equal(cross({ scopes }).status, "no_match");
});

check("A shoes request cannot silently receive the recorded bag category", () => {
  const result = execute(
    "cross_sell",
    "Shoes for this dress",
    [change("category", "Shoes", "Shoes")]
  );

  assert.equal(result.status, "no_rule");
  assert.deepEqual(result.products, []);
  assert.equal(result.applied_preferences.category, "Shoes");
});

check("A general extra request uses the stored rule and remembers target identity", () => {
  const result = execute(
    "cross_sell",
    "An extra for this dress"
  );

  assert.equal(result.status, "matches");
  assert.equal(result.proposed_scopes.item.category, "Bags");
  assert.equal(result.proposed_scopes.item.size, null);
});

check("An ambiguous reference never falls back to the first product", () => {
  const result = cross({
    context: {
      focused: null,
      latest: [
        snapshot(dress),
        snapshot(blueDress),
      ],
    },
  });

  assert.equal(result.status, "needs_clarification");
  assert.deepEqual(result.products, []);
});

check("Missing or changed reference records request refreshed context", () => {
  for (const changedRows of [
    rows.filter((product) => product.product_id !== "D1"),

    rows.map((product) =>
      product.product_id === "D1"
        ? { ...product, product_name: "Changed name" }
        : product
    ),

    rows.map((product) =>
      product.product_id === "D1"
        ? { ...product, is_available: false }
        : product
    ),
  ]) {
    assert.equal(
      cross({ rows: changedRows }).status,
      "needs_clarification"
    );
  }
});

check("Cheaper and blue uses catalogue results without inventing a budget", () => {
  const scopes = createPreferenceScopes();

  Object.assign(scopes.item, {
    category: "Clothing",
    subcategory: "Dresses",
    preferred_colours: ["Lavender"],
  });

  const result = execute(
    "cheaper",
    "Cheaper and blue",
    [change("preferred_colours", ["Blue"], "blue")],
    { scopes }
  );

  assert.equal(result.status, "matches");
  assert.deepEqual(
    result.products.map((product) => product.product_id),
    ["D2"]
  );
  assert.equal(result.applied_preferences.max_price, null);
});

check("Cheaper checks the displayed price and does not fabricate a missing one", () => {
  for (const price_aud of [999, undefined]) {
    const result = execute(
      "cheaper",
      "Anything cheaper",
      [],
      {
        context: {
          focused: null,
          latest: [{
            ...snapshot(dress),
            price_aud,
          }],
        },
      }
    );

    assert.equal(result.status, "needs_clarification");
    assert.deepEqual(result.products, []);
  }
});

check("The relative search still honours a narrower shared ceiling", () => {
  const scopes = createPreferenceScopes();
  scopes.item.category = "Clothing";
  scopes.shared.max_price = 60;

  const result = execute(
    "cheaper",
    "Cheaper and blue",
    [change("preferred_colours", ["Blue"], "blue")],
    { scopes }
  );

  assert.equal(result.status, "no_match");
  assert.equal(result.proposed_scopes.shared.max_price, 60);
});

check("Upsell reuses the benefit rule rather than treating price as a benefit", () => {
  const scopes = createPreferenceScopes();

  Object.assign(scopes.item, {
    category: "Clothing",
    occasion: "Beach Wedding",
    style: "Relaxed",
    preferred_colours: ["Lavender"],
  });

  const result = execute(
    "upsell",
    "Compare this item",
    [],
    { scopes }
  );

  assert.equal(result.status, "matches");
  assert.deepEqual(
    result.products.map((product) => product.product_id),
    ["D3"]
  );
  assert.ok(result.products[0].explanation.includes("style"));

  scopes.item.style = "Formal";

  assert.equal(
    execute("upsell", "Compare this item", [], { scopes }).status,
    "no_upsell"
  );
});

check("Unresolved requirements and questions never produce products", () => {
  const scopes = createPreferenceScopes();
  scopes.unresolved_shared = ["No leather products"];

  assert.equal(
    cross({ scopes }).status,
    "needs_clarification"
  );

  const result = execute(
    "clarify",
    "That one",
    [],
    {
      question: "Which item?",
      rows: [],
    }
  );

  assert.equal(result.status, "needs_clarification");
  assert.deepEqual(result.products, []);
});

check("Unknown required catalogue values trigger clarification", () => {
  const result = execute(
    "new_search",
    "Bags in ultraviolet",
    [
      change("category", "Bags", "Bags"),
      change(
        "preferred_colours",
        ["Ultraviolet"],
        "ultraviolet"
      ),
    ]
  );

  assert.equal(result.status, "needs_clarification");
  assert.deepEqual(result.products, []);
});

check("Missing rules and genuine no-matches remain empty results", () => {
  const modified = rows.map((product) =>
    product.product_id === "D1"
      ? { ...product, cross_sell_category: null }
      : product
  );

  assert.equal(
    cross({ rows: modified }).status,
    "no_rule"
  );

  const scopes = createPreferenceScopes();
  scopes.shared.max_price = 0;

  assert.equal(cross({ scopes }).status, "no_match");
});

check("No-action preserves state and returned IDs come from the catalogue", () => {
  const scopes = createPreferenceScopes();
  const before = JSON.stringify(scopes);

  const result = execute(
    "none",
    "Hello",
    [],
    { scopes, rows: [] }
  );

  assert.equal(result.status, "no_action");
  assert.deepEqual(result.products, []);
  assert.equal(JSON.stringify(scopes), before);

  const ids = new Set(
    rows.map((product) => product.product_id)
  );

  assert.ok(
    cross().products.every(
      (product) => ids.has(product.product_id)
    )
  );
});

console.log(`\n${passed} conversation-search checks passed.`);