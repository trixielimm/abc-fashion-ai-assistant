import assert from "node:assert/strict";
import { resolveFollowUp } from "../lib/ai/resolveFollowUp.ts";

// Synthetic preferences and vocabulary. No network calls.
const current = {
  gender: null,
  category: "Clothing",
  subcategory: null,
  product_type: null,
  occasion: "Beach Wedding",
  style: "Formal",
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

const row = {
  gender: null,
  brand_line: null,
  category: "Clothing",
  subcategory: null,
  product_type: null,
  occasion: "Beach Wedding",
  style: "Formal",
  colour: "Lavender",
  season: null,
  material: null,
  fit: null,
};

const catalogue = {
  rows: [
    row,
    { ...row, colour: "Blue", style: "Relaxed" },
    { ...row, colour: "Brown", style: "Minimalist" },
  ],
  sizes: ["10"],
  categories: [
    { category: "Clothing", subcategory: null },
  ],
};

function run(message, pending, preferences = current) {
  return resolveFollowUp(
    message,
    preferences,
    catalogue,
    pending
  );
}

let passed = 0;

function check(name, test) {
  test();
  passed += 1;
  console.log(`PASS: ${name}`);
}

check("Cheaper asks for a price without inventing a budget", () => {
  const result = run("Something cheaper, please!");

  assert.equal(result.question.kind, "lower_budget");
  assert.deepEqual(result.preferences, current);
});

check("A budget answer changes only the maximum price", () => {
  const result = run("$75", "lower_budget");

  assert.equal(result.question, null);
  assert.deepEqual(result.preferences, {
    ...current,
    max_price: 75,
  });
  assert.equal(current.max_price, 100);
});

check("Invalid, unchanged or increased cheaper budgets are rejected", () => {
  for (const answer of ["150", "100", "-1", "fifty", "$75 off"]) {
    const result = run(answer, "lower_budget");

    assert.equal(result.question.kind, "lower_budget");
    assert.deepEqual(result.preferences, current);
  }
});

check("The previous minimum price is not silently removed", () => {
  const ranged = { ...current, min_price: 60 };
  const result = run("50", "lower_budget", ranged);

  assert.equal(result.question.kind, "lower_budget");
  assert.deepEqual(result.preferences, ranged);
});

check("A zero maximum is preserved as a real number", () => {
  const result = run("0", "lower_budget");

  assert.equal(result.question, null);
  assert.equal(result.preferences.max_price, 0);

  const again = run("0", "lower_budget", result.preferences);
  assert.equal(again.question.kind, "lower_budget");
});

check("Different colour asks before replacing the saved colour", () => {
  const result = run("A different colour");

  assert.equal(result.question.kind, "different_colour");
  assert.deepEqual(result.preferences, current);
  assert.ok(result.question.message.includes("Blue"));
});

check("A colour answer preserves size, budget and exclusions", () => {
  const result = run(" blue ", "different_colour");

  assert.equal(result.question, null);
  assert.deepEqual(result.preferences, {
    ...current,
    preferred_colours: ["Blue"],
  });
});

check("Unknown, excluded or unchanged colour answers need clarification", () => {
  for (const answer of ["Ultraviolet", "Brown", "Lavender"]) {
    const result = run(answer, "different_colour");

    assert.equal(result.question.kind, "different_colour");
    assert.deepEqual(result.preferences, current);
  }
});

check("More casual asks instead of inventing a style mapping", () => {
  const result = run("More casual");

  assert.equal(result.question.kind, "different_style");
  assert.deepEqual(result.preferences, current);
});

check("A chosen catalogue style changes only the style", () => {
  const result = run("relaxed", "different_style");

  assert.equal(result.question, null);
  assert.deepEqual(result.preferences, {
    ...current,
    style: "Relaxed",
  });
});

check("Unknown style answers do not change saved preferences", () => {
  const result = run("Futuristic", "different_style");

  assert.equal(result.question.kind, "different_style");
  assert.deepEqual(result.preferences, current);
});

check("Cancel closes a pending question without removing constraints", () => {
  for (const pending of [
    "lower_budget",
    "different_colour",
    "different_style",
  ]) {
    const result = run("cancel", pending);

    assert.equal(result.question, null);
    assert.deepEqual(result.preferences, current);
  }
});

check("Unrelated and compound messages still use the existing extractor", () => {
  for (const message of [
    "Not cheaper",
    "Find blue shoes in size 7",
    "Make it blue instead",
  ]) {
    assert.equal(run(message), null);
  }
});

check("A new guided question replaces the pending question", () => {
  const result = run("Different colour", "lower_budget");

  assert.equal(result.question.kind, "different_colour");
  assert.deepEqual(result.preferences, current);
});

console.log(`\n${passed} guided follow-up checks passed.`);