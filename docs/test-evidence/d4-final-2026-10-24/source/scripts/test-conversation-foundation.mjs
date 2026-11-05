import assert from "node:assert/strict";

import {
  resolveProductReference,
} from "../lib/stylist/productReference.ts";

import {
  createPreferenceScopes,
  emptyShoppingPreferences,
  composePreferences,
  startAdditionalItem,
} from "../lib/stylist/preferenceScope.ts";

// Synthetic products and interpreted instructions. No network calls.
const first = {
  product_id: "D1",
  product_name: "Black Wrap Dress",
  subcategory: "Dresses",
};

const second = {
  product_id: "D2",
  product_name: "Blue Slip Dress",
  subcategory: "Dresses",
};

const bag = {
  product_id: "B1",
  product_name: "Mini Bag",
  subcategory: "Handbags",
};

const context = {
  focused: null,
  latest: [first, bag, second],
};

const resolve = (reference, input = context) =>
  resolveProductReference(input, reference);

function ready(state) {
  const result = composePreferences(state);
  assert.equal(result.status, "ready", result.message);
  return result.preferences;
}

let passed = 0;

function check(name, test) {
  test();
  passed++;
  console.log(`PASS: ${name}`);
}

check("The second product uses the displayed order", () => {
  const result = resolve({
    kind: "position",
    position: 2,
    subcategory: null,
  });

  assert.equal(result.product_id, "B1");
});

check("The second dress uses the matching subcategory order", () => {
  const result = resolve({
    kind: "position",
    position: 2,
    subcategory: "Dresses",
  });

  assert.equal(result.product_id, "D2");
});

check("An exact product name is resolved without requiring its ID", () => {
  const result = resolve({
    kind: "name",
    value: " black  wrap dress ",
  });

  assert.equal(result.product_id, "D1");
});

check("An unknown ID or unavailable position is not replaced by a guess", () => {
  assert.equal(
    resolve({
      kind: "id",
      value: "INVENTED",
    }).status,
    "needs_clarification"
  );

  assert.equal(
    resolve({
      kind: "position",
      position: 4,
      subcategory: "Dresses",
    }).status,
    "needs_clarification"
  );
});

check("Ambiguous context and duplicate names require clarification", () => {
  assert.equal(
    resolve({ kind: "context" }).status,
    "needs_clarification"
  );

  const result = resolve(
    {
      kind: "name",
      value: first.product_name,
    },
    {
      focused: null,
      latest: [
        first,
        { ...first, product_id: "D3" },
      ],
    }
  );

  assert.equal(result.status, "needs_clarification");
});

check("A genuinely focused page or card is used for this item", () => {
  assert.equal(
    resolve(
      { kind: "context" },
      { ...context, focused: second }
    ).product_id,
    "D2"
  );

  assert.equal(
    resolve(
      { kind: "context" },
      { focused: null, latest: [first] }
    ).product_id,
    "D1"
  );
});

check("Empty context and invalid positions cannot choose a product", () => {
  assert.equal(
    resolve(
      { kind: "context" },
      { focused: null, latest: [] }
    ).status,
    "needs_clarification"
  );

  assert.throws(() =>
    resolve({
      kind: "position",
      position: 0,
      subcategory: null,
    })
  );
});

check("Unknown size and budget stay unknown", () => {
  const value = ready(createPreferenceScopes());

  assert.equal(value.size, null);
  assert.equal(value.max_price, null);
});

check("Dress-specific colour, size and budget do not become bag requirements", () => {
  const state = createPreferenceScopes();

  state.item = {
    ...state.item,
    category: "Clothing",
    size: "10",
    max_price: 300,
    preferred_colours: ["Black"],
  };

  const before = JSON.stringify(state);

  const next = startAdditionalItem(state, {
    ...emptyShoppingPreferences(),
    category: "Bags",
  });

  const value = ready(next);

  assert.equal(value.category, "Bags");
  assert.equal(value.size, null);
  assert.equal(value.max_price, null);
  assert.deepEqual(value.preferred_colours, []);
  assert.equal(JSON.stringify(state), before);
});

check("Explicit shared colours, exclusions and per-item maximum survive category changes", () => {
  const state = createPreferenceScopes();

  state.shared.preferred_colours = ["Black"];
  state.shared.excluded_colours = ["Brown"];
  state.shared.max_price = 100;

  const next = startAdditionalItem(state, {
    ...emptyShoppingPreferences(),
    category: "Bags",
  });

  const value = ready(next);

  assert.deepEqual(value.preferred_colours, ["Black"]);
  assert.deepEqual(value.excluded_colours, ["Brown"]);
  assert.equal(value.max_price, 100);
});

check("A narrower item budget wins without raising a shared ceiling", () => {
  const state = createPreferenceScopes();

  state.shared.max_price = 100;
  state.item.max_price = 50;

  assert.equal(ready(state).max_price, 50);

  state.item.max_price = 200;

  assert.equal(ready(state).max_price, 100);
});

check("Zero limits and conflicting price ranges are not ignored", () => {
  const state = createPreferenceScopes();

  state.shared.max_price = 0;
  assert.equal(ready(state).max_price, 0);

  state.item.min_price = 1;

  assert.equal(
    composePreferences(state).status,
    "needs_clarification"
  );
});

check("Allowed colours are intersected rather than broadened", () => {
  const state = createPreferenceScopes();

  state.shared.preferred_colours = ["Black", "Blue"];
  state.item.preferred_colours = ["blue", "Green"];

  assert.deepEqual(
    ready(state).preferred_colours,
    ["blue"]
  );

  state.item.preferred_colours = ["Green"];

  assert.equal(
    composePreferences(state).status,
    "needs_clarification"
  );
});

check("Exclusions combine and preferred/excluded conflicts are not hidden", () => {
  const state = createPreferenceScopes();

  state.shared.excluded_colours = ["Brown"];
  state.item.excluded_colours = ["Red", "brown"];

  assert.equal(
    ready(state).excluded_colours.length,
    2
  );

  state.item.preferred_colours = ["Brown"];

  assert.equal(
    composePreferences(state).status,
    "needs_clarification"
  );
});

check("Incompatible shared and item requirements require clarification", () => {
  const state = createPreferenceScopes();

  state.shared.material = "Cotton";
  state.item.material = "Silk";

  assert.equal(
    composePreferences(state).status,
    "needs_clarification"
  );
});

check("A clothing size cannot be stored as a universal shared size", () => {
  const state = createPreferenceScopes();

  assert.throws(() =>
    composePreferences({
      ...state,
      shared: {
        ...state.shared,
        size: "10",
      },
    })
  );
});

check("Unsupported shared restrictions survive a new item and block unsafe search", () => {
  const state = createPreferenceScopes();
  state.unresolved_shared = ["No leather products"];

  const next = startAdditionalItem(state, {
    ...emptyShoppingPreferences(),
    category: "Bags",
  });

  const result = composePreferences(next);

  assert.equal(result.status, "needs_clarification");
  assert.ok(
    result.message.includes("No leather products")
  );
});

check("Composition does not mutate either scope", () => {
  const state = createPreferenceScopes();

  state.shared.max_price = 100;
  state.shared.excluded_colours = ["Brown"];

  const before = JSON.stringify(state);
  const value = ready(state);

  value.excluded_colours.push("Red");

  assert.equal(JSON.stringify(state), before);
});

console.log(
  `\n${passed} conversation-foundation checks passed.`
);