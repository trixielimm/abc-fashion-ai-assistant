import assert from "node:assert/strict";

import {
  checkConversationPlan,
  ConversationPlanSchema,
  ConversationPlanRequestSchema,
} from "../lib/stylist/conversationPlan.ts";

import {
  createPreferenceScopes,
} from "../lib/stylist/preferenceScope.ts";

// Synthetic context and simulated model outputs. No network calls.
const first = {
  product_id: "D1",
  product_name: "Black Wrap Dress",
  category: "Clothing",
  subcategory: "Dresses",
  product_type: "Wrap Dress",
};

const second = {
  ...first,
  product_id: "D2",
  product_name: "Blue Slip Dress",
  product_type: "Slip Dress",
};

const context = {
  focused: null,
  latest: [first, second],
};

function scopes() {
  const state = createPreferenceScopes();

  state.item = {
    ...state.item,
    category: "Clothing",
    subcategory: "Dresses",
    size: "10",
    max_price: 300,
    preferred_colours: ["Black"],
  };

  return state;
}

function change(
  field,
  value,
  evidence,
  scope = "item",
  operation = "set"
) {
  return {
    scope,
    field,
    operation,
    value,
    evidence,
  };
}

function run(
  message,
  action,
  changes = [],
  options = {}
) {
  return checkConversationPlan(
    {
      message,
      scopes: options.scopes ?? scopes(),
      context,
    },
    {
      action,
      intent_evidence: message,
      changes,
      reference: options.reference ?? null,
      question: options.question ?? null,
    }
  );
}

let passed = 0;

function check(name, test) {
  test();
  passed++;
  console.log(`PASS: ${name}`);
}

check("A new search sets only supplied item preferences", () => {
  const output = run(
    "Show me bags",
    "new_search",
    [change("category", "Bags", "bags")]
  );

  assert.equal(output.status, "ready_for_validation");
  assert.equal(output.preferences.category, "Bags");
  assert.equal(output.preferences.max_price, null);
  assert.equal(output.preferences.size, null);
  assert.deepEqual(output.preferences.preferred_colours, []);
});

check("Refinement preserves every unmentioned preference", () => {
  const output = run(
    "Blue instead",
    "refine",
    [change("preferred_colours", ["Blue"], "Blue")]
  );

  assert.equal(output.preferences.size, "10");
  assert.equal(output.preferences.max_price, 300);
  assert.deepEqual(
    output.preferences.preferred_colours,
    ["Blue"]
  );
});

check("A bag for the second dress resolves the ID and clears dress-only constraints", () => {
  const output = run(
    "A bag for the second dress",
    "cross_sell",
    [change("category", "Bags", "bag")],
    {
      reference: {
        kind: "position",
        position: 2,
        subcategory: "Dresses",
      },
    }
  );

  assert.equal(output.status, "ready_for_validation");
  assert.deepEqual(output.reference_product_ids, ["D2"]);
  assert.equal(output.preferences.category, "Bags");
  assert.equal(output.preferences.size, null);
  assert.equal(output.preferences.max_price, null);
});

check("Shared restrictions survive an additional-item request", () => {
  const saved = scopes();
  saved.shared.max_price = 100;
  saved.shared.excluded_colours = ["Brown"];

  const output = run(
    "A bag for the first dress",
    "cross_sell",
    [change("category", "Bags", "bag")],
    {
      scopes: saved,
      reference: { kind: "id", value: "D1" },
    }
  );

  assert.equal(output.preferences.max_price, 100);
  assert.deepEqual(
    output.preferences.excluded_colours,
    ["Brown"]
  );
});

check("An explicit shared ceiling can be added and item limits cannot raise it", () => {
  const output = run(
    "Keep every item under $100; this one under $200",
    "refine",
    [
      change(
        "max_price",
        100,
        "every item under $100",
        "shared"
      ),
      change(
        "max_price",
        200,
        "this one under $200"
      ),
    ]
  );

  assert.equal(output.preferences.max_price, 100);
});

check("Shared size or product identity is rejected", () => {
  assert.throws(() =>
    run(
      "Use size 10 everywhere",
      "refine",
      [change("size", "10", "size 10 everywhere", "shared")]
    )
  );

  assert.throws(() =>
    run(
      "All Bags",
      "refine",
      [change("category", "Bags", "All Bags", "shared")]
    )
  );
});

check("Unsupported exclusions remain recorded and block unsafe retrieval", () => {
  const output = run(
    "No leather products",
    "refine",
    [
      change(
        "unresolved",
        ["No leather products"],
        "No leather products",
        "shared",
        "add"
      ),
    ]
  );

  assert.equal(output.status, "needs_clarification");
  assert.equal(output.preferences, null);
  assert.deepEqual(
    output.proposed_scopes.unresolved_shared,
    ["No leather products"]
  );
});

check("Adding an exclusion does not erase previous exclusions", () => {
  const saved = scopes();
  saved.shared.excluded_colours = ["Brown"];

  const output = run(
    "Also exclude red everywhere",
    "refine",
    [
      change(
        "excluded_colours",
        ["Red"],
        "exclude red everywhere",
        "shared",
        "add"
      ),
    ],
    { scopes: saved }
  );

  assert.deepEqual(
    output.preferences.excluded_colours,
    ["Brown", "Red"]
  );

  assert.throws(() =>
    run(
      "Exclude red",
      "refine",
      [change("excluded_colours", ["Red"], "red")]
    )
  );
});

check("A stated removal deletes only the named restriction", () => {
  const saved = scopes();
  saved.shared.excluded_colours = ["Brown", "Red"];

  const output = run(
    "Stop excluding brown for all items",
    "refine",
    [
      change(
        "excluded_colours",
        ["Brown"],
        "Stop excluding brown for all items",
        "shared",
        "remove"
      ),
    ],
    { scopes: saved }
  );

  assert.deepEqual(
    output.preferences.excluded_colours,
    ["Red"]
  );
});

check("Invented evidence, duplicate changes and invalid value types are rejected", () => {
  assert.throws(() =>
    run(
      "Blue instead",
      "refine",
      [change("max_price", 500, "raise my budget")]
    )
  );

  assert.throws(() =>
    run(
      "Blue",
      "refine",
      [
        change("style", "Blue", "Blue"),
        change("style", "Formal", "Blue"),
      ]
    )
  );

  assert.throws(() =>
    run(
      "Budget fifty",
      "refine",
      [change("max_price", "fifty", "fifty")]
    )
  );
});

check("Ambiguous and unknown references do not choose the first product", () => {
  for (const reference of [
    { kind: "context" },
    { kind: "id", value: "INVENTED" },
  ]) {
    const output = run(
      "Find an extra for that one",
      "cross_sell",
      [],
      { reference }
    );

    assert.equal(output.status, "needs_clarification");
    assert.deepEqual(output.reference_product_ids, []);
  }
});

check("Cheaper and blue can be interpreted without inventing a budget", () => {
  const saved = scopes();
  saved.item.max_price = null;

  const output = run(
    "Something cheaper and blue",
    "cheaper",
    [change("preferred_colours", ["Blue"], "blue")],
    { scopes: saved }
  );

  assert.equal(output.action, "cheaper");
  assert.equal(output.preferences.max_price, null);
  assert.deepEqual(
    output.reference_product_ids,
    ["D1", "D2"]
  );
});

check("Changing category clears only incompatible identity and size", () => {
  const output = run(
    "Shoes instead",
    "refine",
    [change("category", "Shoes", "Shoes")]
  );

  assert.equal(output.preferences.category, "Shoes");
  assert.equal(output.preferences.subcategory, null);
  assert.equal(output.preferences.size, null);
  assert.equal(output.preferences.max_price, 300);
});

check("Zero maximum remains a real limit", () => {
  const output = run(
    "Maximum $0",
    "refine",
    [change("max_price", 0, "$0")]
  );

  assert.equal(output.preferences.max_price, 0);
});

check("Unrelated messages and clarification do not execute actions", () => {
  const saved = scopes();
  const before = JSON.stringify(saved);

  assert.equal(
    run("Hello", "none", [], { scopes: saved }).status,
    "no_action"
  );

  assert.equal(JSON.stringify(saved), before);

  assert.equal(
    run(
      "That one",
      "clarify",
      [],
      { question: "Which item?" }
    ).status,
    "needs_clarification"
  );

  assert.throws(() =>
    run(
      "Hello",
      "none",
      [change("max_price", 500, "Hello")]
    )
  );
});

check("Unexpected fields and invalid plans cannot be treated as recommendations", () => {
  assert.equal(
    ConversationPlanRequestSchema.safeParse({
      message: "Hi",
      api_key: "not-allowed",
    }).success,
    false
  );

  assert.equal(
    ConversationPlanSchema.safeParse({
      action: "add_to_cart",
    }).success,
    false
  );

  const output = run(
    "Show me bags",
    "new_search",
    [change("category", "Bags", "bags")]
  );

  assert.equal("products" in output, false);
});

console.log(`\n${passed} conversation-plan checks passed.`);