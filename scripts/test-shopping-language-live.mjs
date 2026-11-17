import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeTurn, newSession, acceptReply } from "../lib/stylist/conversationProtocol.ts";

// Explicit live verification: local API, real model and current public stock.
// No cart actions, catalogue writes or analytics calls.
const base = new URL(process.argv[2] ?? "http://127.0.0.1:3002");
if (base.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Use a local app server.");
const started = new Date().toISOString();
const directory = join("docs/test-evidence/shopping-language", started.replace(/[:.]/g, "-"));
mkdirSync(directory, { recursive: true });
const evidence = { started, base: base.origin, scope: "Real model and public catalogue through the local API. Automated response/state checks only; browser review is separate.", scenarios: [] };
evidence.source_hashes = Object.fromEntries(["lib/ai/interpretConversation.ts", "lib/ai/validatePreferences.ts", "lib/catalogue/shoppingLanguage.ts", "lib/catalogue/productFamilies.ts", "lib/stylist/collectionPreference.ts", "lib/stylist/conversationGrounding.ts", "lib/stylist/conversationPlan.ts", "lib/stylist/conversationSearch.ts", "lib/stylist/shoppingPresentation.ts", "lib/stylist/friendlyShoppingMessage.ts", "lib/search/noMatchReason.ts", "scripts/test-shopping-language-live.mjs"].map(file => [file, createHash("sha256").update(readFileSync(file)).digest("hex")]));
function save() { writeFileSync(join(directory, "results.json"), JSON.stringify(evidence, null, 2)); }
let current;
async function send(state, message, verify, preview = false) {
  const requestId = randomUUID();
  const turn = makeTurn(state, message, null, undefined, preview);
  const record = { request_id: requestId, message, turn, started: new Date().toISOString() };
  current.turns.push(record); save();
  const response = await fetch(new URL("/api/conversation-search", base), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: requestId, retry: false, turn }), signal: AbortSignal.timeout(90_000),
  });
  record.http = response.status;
  record.reply = await response.json();
  assert.equal(response.status, 200, JSON.stringify(record.reply));
  const accepted = acceptReply(turn, record.reply);
  verify(accepted.reply, accepted.session);
  record.passed = true; save();
  console.log(`PASS: ${message} -> ${accepted.reply.status} (${accepted.reply.products.length + accepted.reply.alternatives.length} products)`);
  return accepted.session;
}
async function scenario(name, run) {
  if (process.env.SHOPPING_LANGUAGE_FILTER && !new RegExp(process.env.SHOPPING_LANGUAGE_FILTER, "i").test(name)) return;
  current = { name, turns: [] }; evidence.scenarios.push(current);
  try { await run(); current.passed = true; }
  catch (error) { current.passed = false; current.failure = error.message; console.error(`FAIL: ${name}: ${error.message}`); }
  save();
}
const visible = reply => [...reply.products, ...reply.alternatives];
const hasProducts = reply => {
  assert.ok(["matches", "alternatives"].includes(reply.status), reply.message);
  assert.ok(visible(reply).length > 0, reply.message);
};
const dresses = reply => {
  hasProducts(reply);
  assert.equal(reply.applied_preferences.subcategory, "Dresses");
  assert.deepEqual(reply.applied_preferences.preferred_colours, ["Lavender"]);
  assert.ok(visible(reply).every(product => product.colour === "Lavender" && product.subcategory === "Dresses"));
};
for (const message of ["i want a lavendar dress", "I want a lavender dress", "I want a lavendar dres", "I WANT A LAVENDAR DRES"]) {
  await scenario(message, () => send(newSession(), message, reply => { dresses(reply); assert.equal(reply.applied_preferences.product_type, null); assert.equal(reply.pending, null); }));
}
for (const [message, expected] of [
  ["Show me a burgandy dress", { preferred_colours: ["Burgundy"], subcategory: "Dresses" }],
  ["Show me a burgandy skrit", { preferred_colours: ["Burgundy"], subcategory: "Bottoms" }],
  ["Show me white sneekers", { preferred_colours: ["White"], category: "Shoes" }],
  ["Show me women's burgandy blous", { preferred_colours: ["Burgundy"], subcategory: "Tops" }],
  ["Show me women's cotten shrits", { material: "Cotton", subcategory: "Tops" }],
  ["I want a black handbg", { preferred_colours: ["Black"], category: "Bags" }],
  ["I want a dress for a weddding", { occasion: "Wedding Guest", subcategory: "Dresses" }],
]) await scenario(message, () => send(newSession(), message, reply => {
  hasProducts(reply);
  for (const [field, value] of Object.entries(expected)) assert.deepEqual(reply.applied_preferences[field], value);
}));
// The catalogue audit found no Black skirts and no White blouses. These are
// genuine inventory gaps: verify understanding, no false matches and recovery.
for (const [message, colour, subcategory] of [["Show me a black skrit", "Black", "Bottoms"], ["Show me women's white blous", "White", "Tops"]]) {
  await scenario(`Known inventory gap: ${message}`, () => send(newSession(), message, reply => {
    assert.equal(reply.status, "no_match");
    assert.equal(reply.applied_preferences.subcategory, subcategory);
    assert.deepEqual(reply.applied_preferences.preferred_colours, [colour]);
    assert.deepEqual(visible(reply), []);
    assert.equal(reply.can_preview_other_colours, true);
    assert.doesNotMatch(reply.message, /what kind of item/i);
  }));
}
await scenario("Shirts to lavender dresses after the optional occasion question", async () => {
  let state = await send(newSession(), "Show me womens shirts", reply => { hasProducts(reply); assert.match(reply.optional_question, /What occasion/); });
  state = await send(state, "i want a lavendar dress", reply => { dresses(reply); assert.equal(reply.applied_preferences.product_type, null); });
  await send(state, "I want a lavender dress", dresses);
});
await scenario("Saved budget, spelling correction and explicit colour preview", async () => {
  let state = await send(newSession(), "Show me dresses under $100", hasProducts);
  const budgetBlocked = reply => {
    assert.equal(reply.status, "no_match");
    assert.equal(reply.applied_preferences.max_price, 100);
    assert.deepEqual(reply.applied_preferences.preferred_colours, ["Lavender"]);
    assert.match(reply.message, /A\$100\.00.*lowest-priced matching option is A\$150\.00/s);
    assert.deepEqual(visible(reply), []);
  };
  state = await send(state, "i want a lavendar dress", budgetBlocked);
  state = await send(state, "I want a lavender dress", reply => { budgetBlocked(reply); assert.match(reply.message, /^I understood your request/); assert.equal(reply.can_preview_other_colours, true); });
  await send(state, "Show other colours as clearly labelled alternatives, keeping my original preferences saved.", reply => {
    assert.equal(reply.alternative_kind, "colour_preview");
    assert.ok(reply.alternatives.length > 0);
    assert.ok(reply.alternatives.every(product => product.price_aud <= 100 && product.colour !== "Lavender"));
    assert.equal(reply.applied_preferences.max_price, 100);
    assert.deepEqual(reply.proposed_scopes.item.preferred_colours, ["Lavender"]);
  }, true);
});
await scenario("Misspelled negative colour remains an exclusion", () => send(newSession(), "I want a dress, no lavendar", reply => {
  hasProducts(reply);
  assert.deepEqual(reply.applied_preferences.preferred_colours, []);
  assert.ok(reply.applied_preferences.excluded_colours.includes("Lavender"));
  assert.ok(visible(reply).every(product => product.colour !== "Lavender"));
}));
await scenario("Misspelled medium remains a size requirement", () => send(newSession(), "I want a dress in meduim", reply => {
  assert.equal(reply.applied_preferences.size, "M");
  assert.equal(reply.status, "no_match");
  assert.match(reply.message, /requested size, M/);
  assert.equal(reply.can_preview_other_colours, false);
}));
await scenario("Unsupported requirements survive typo correction", () => send(newSession(), "I want a waterproof lavendar dres", reply => {
  assert.equal(reply.status, "needs_clarification");
  assert.ok(reply.proposed_scopes.unresolved_item.some(value => /waterproof/i.test(value)));
  assert.deepEqual(visible(reply), []);
}));
await scenario("Misspelled material exclusion remains a requirement", () => send(newSession(), "I want a lavendar dress, no polyster", reply => {
  assert.equal(reply.status, "needs_clarification");
  assert.ok(reply.proposed_scopes.unresolved_item.some(value => /polyster|polyester/i.test(value)));
  assert.deepEqual(visible(reply), []);
}));
await scenario("A different shade is never silently changed to lavender", () => send(newSession(), "I want a lilac dress", reply => {
  assert.equal(reply.status, "needs_clarification");
  assert.ok(reply.proposed_scopes.item.preferred_colours.some(value => /^lilac$/i.test(value)));
  assert.deepEqual(visible(reply), []);
}));
evidence.finished = new Date().toISOString();
evidence.passed = evidence.scenarios.filter(value => value.passed).length;
evidence.failed = evidence.scenarios.length - evidence.passed;
save();
console.log(`\n${evidence.passed}/${evidence.scenarios.length} live scenarios passed. Evidence: ${directory}/results.json`);
if (evidence.failed) process.exitCode = 1;
