import assert from "node:assert/strict";
import { friendlyShoppingMessage } from "../lib/stylist/friendlyShoppingMessage.ts";

// Synthetic records only. No OpenAI, Supabase or browser calls.
const first = {
  product_id: "T1", product_name: "Test Lavender Dress", price_aud: 55,
  category: "Clothing", colour: "Lavender", sizes_available: ["10"],
  product_type: "Dress",
};
const second = { ...first, product_id: "T2", product_name: "Test Lavender Cardigan", price_aud: 75, product_type: "Cardigan" };
const base = {
  status: "matches", action: "new_search", baseMessage: "Original reply.",
  products: [first, second], alternatives: [],
  preferences: { min_price: null, max_price: null, size: null },
  references: [], alternativeKind: null, canPreviewOtherColours: false,
  unresolved: [], hasOptionalQuestion: false,
};
const run = (changes = {}) => friendlyShoppingMessage({ ...base, ...changes });
let passed = 0;
function check(name, test) { test(); passed++; console.log(`PASS: ${name}`); }

check("Multiple products get paragraphs with the real displayed price range", () => {
  const text = run();
  assert.match(text, /2 lavender clothing options/);
  assert.match(text, /A\$55\.00 to A\$75\.00/);
  assert.match(text, /dress and cardigan/);
  assert.ok(text.includes("\n\n"));
});
check("Unknown budget and size are not invented or requested", () => {
  const text = run();
  assert.doesNotMatch(text, /per-item limit|requested size|what is your budget|provide your size/i);
});
check("A single product keeps its exact name and price", () => {
  assert.ok(run({ products: [first] }).startsWith("I found Test Lavender Dress for A$55.00."));
});
check("A supplied inclusive limit and listed size can be described", () => {
  const text = run({ preferences: { min_price: null, max_price: 75, size: "10" } });
  assert.match(text, /within your A\$75\.00/);
  assert.match(text, /requested size, 10/);
  assert.doesNotMatch(text, /guaranteed fit|will fit|arrive tomorrow/i);
});
check("Wording does not assert a price or size condition the cards do not meet", () => {
  const text = run({ preferences: { min_price: null, max_price: 50, size: "12" } });
  assert.doesNotMatch(text, /within your|requested size/);
});
check("Cross-sell names the actual reference without inventing styling claims", () => {
  const text = run({ action: "cross_sell", references: [{ product_name: "Reference Item", price_aud: 90 }] });
  assert.match(text, /Reference Item/);
  assert.doesNotMatch(text, /perfect match|guaranteed|luxury/i);
});
check("Cheaper wording uses a verified reference and does not change it into a budget", () => {
  const text = run({ action: "cheaper", references: [{ product_name: "Main", price_aud: 100 }] });
  assert.match(text, /less than the A\$100\.00 reference item/);
  assert.doesNotMatch(text, /per-item limit/);
});
check("Unverified alternative details are not called exact matches", () => {
  const text = run({ status: "alternatives", products: [], alternatives: [{ ...first, differences: ["Style is not recorded; I cannot verify Relaxed."] }] });
  assert.match(text, /haven't found an exact match/);
  assert.match(text, /can't confirm/);
  assert.match(text, /original request is still saved/);
});
check("Colour previews preserve the original colour request", () => {
  const text = run({ status: "alternatives", products: [], alternativeKind: "colour_preview", alternatives: [{ ...first, differences: ["Colour differs."] }] });
  assert.match(text, /not exact matches/);
  assert.match(text, /original request is still saved/);
});
check("No-match keeps the real reason and offers the existing preview only when eligible", () => {
  const changes = { status: "no_match", products: [], baseMessage: "No product met this request." };
  assert.ok(run(changes).startsWith(changes.baseMessage));
  assert.doesNotMatch(run(changes), /Explore other colours/);
  assert.match(run({ ...changes, canPreviewOtherColours: true }), /Explore other colours/);
});
check("Necessary questions are preserved and unsupported details are not a stock claim", () => {
  assert.equal(run({ status: "needs_clarification", products: [], baseMessage: "Which dress do you mean?" }), "Which dress do you mean?");
  const text = run({ status: "needs_clarification", products: [], unresolved: ["Cat pictures"] });
  assert.match(text, /can't verify/);
  assert.doesNotMatch(text, /do not stock|out of stock/i);
});
check("Formatting changes neither product data nor saved preferences", () => {
  const before = JSON.stringify(base);
  friendlyShoppingMessage(base);
  assert.equal(JSON.stringify(base), before);
});
console.log(`\n${passed} friendly-shopping-message checks passed.`);