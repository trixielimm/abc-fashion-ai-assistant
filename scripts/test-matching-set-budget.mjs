import assert from "node:assert/strict";
import { product } from "./fixtures/customer-scenarios.mjs";
import { newSession, makeTurn, snapshot, acceptReply, TurnReplySchema } from "../lib/stylist/conversationProtocol.ts";
import { shortcutPlan, finishConversationTurn } from "../lib/stylist/conversationTurn.ts";
import { checkConversationPlan } from "../lib/stylist/conversationPlan.ts";
import { simpleMatchingSet, additiveCombinedRequest } from "../lib/stylist/combinedShoppingRequest.ts";
import { emptyShoppingPreferences } from "../lib/stylist/preferenceScope.ts";
import { outfitTotals } from "../lib/stylist/outfitPresentation.ts";

const jacket = product("JACKET", "Clothing", 800, { gender: "Men", subcategory: "Outerwear", product_type: "Denim Jacket", product_name: "Navy Denim Jacket", colour: "Navy", style: "Classic", occasion: "Work", season: "All Season" });
const rows = [jacket,
  product("BOTTOM-240", "Clothing", 240, { gender: "Men", subcategory: "Bottoms", product_type: "Tailored Trousers", occasion: "Work", style: "Classic", colour: "Grey", season: "All Season" }),
  product("BOTTOM-300", "Clothing", 300, { gender: "Men", subcategory: "Bottoms", product_type: "Chino Pants", occasion: "Work", style: "Classic", season: "All Season" }),
  product("SHIRT-260", "Clothing", 260, { gender: "Men", subcategory: "Tops", product_type: "Oxford Shirt", occasion: "Work", style: "Classic", colour: "White", season: "All Season" }),
  product("SHIRT-310", "Clothing", 310, { gender: "Men", subcategory: "Tops", product_type: "Work Shirt", occasion: "Work", style: "Classic", season: "All Season" }),
  product("WRONG-TOP", "Clothing", 1, { gender: "Men", subcategory: "Tops", product_type: "Hoodie", occasion: "Work", style: "Classic", season: "All Season" }),
  product("INCOMPATIBLE", "Clothing", 1, { gender: "Men", subcategory: "Bottoms", product_type: "Beach Shorts", occasion: "Party", style: "Streetwear", season: "Summer", colour: "Red" }),
];
const vocabulary = { rows, sizes: ["10", "12"], categories: [...new Map(rows.map(row => [row.subcategory, { category: row.category, subcategory: row.subcategory }])).values()] };
const text = "can you find me bottoms to match the jacket, or some shirt as well, total budget is 500 aud";
const seed = () => { const state = newSession(); state.collection.choice = "Men"; state.context.focused = snapshot(jacket); state.context.latest = [snapshot(jacket)]; return state; };
const output = (message, extra = {}) => ({ action: "new_search", intent_evidence: message.slice(0, 250), reference: { kind: "id", value: "JACKET" }, changes: [], question: null, continuation: false, ...extra });
function send(state = seed(), message = text, plan, catalogue = rows) {
  const turn = makeTurn(state, message);
  return acceptReply(turn, finishConversationTurn(catalogue, turn, plan ?? shortcutPlan(turn), vocabulary));
}
function verifyBudget(reply, total = 500) {
  assert.equal(reply.status, "matches"); assert.equal(reply.pending, null);
  assert.equal(reply.outfit_budget.limit_aud, total); assert.equal(reply.outfit_choices.groups.length, 2);
  const maximum = reply.outfit_choices.groups.reduce((sum, group) => sum + Math.max(...group.product_ids.map(id => reply.products.find(p => p.product_id === id).price_aud)), 0);
  assert.ok(maximum <= total); assert.equal(maximum, reply.outfit_choices.maximum_total_aud);
  assert.ok(reply.products.every(p => p.product_id !== "JACKET" && p.product_id !== "WRONG-TOP" && p.product_id !== "INCOMPATIBLE"));
}
let passed = 0;
function check(name, run) { run(); passed++; console.log(`PASS: ${name}`); }

check("The exact prompt immediately searches two groups under one A$500 total", () => {
  const { reply, session } = send(); verifyBudget(reply);
  assert.equal(reply.outfit_budget.total_aud, 500); assert.deepEqual(reply.outfit_choices.groups.map(g => g.label), ["Bottoms", "Shirts"]);
  assert.equal(session.styling.outfit_request.total_budget_aud, 500);
  assert.deepEqual(session.styling.outfit_request.anchor_product_ids, ["JACKET"]);
  assert.equal(session.scopes.item.max_price, null); assert.equal(session.scopes.item.category, null);
  assert.deepEqual(session.styling.outfit, []); assert.deepEqual(session.cart_product_ids, []);
  assert.match(reply.message, /A\$500.00 combined budget/); assert.match(reply.message, /new pieces only/);
});
check("The reported model clarification is corrected before execution", () => {
  const result = send(seed(), text, output(text, { action: "clarify", reference: null,
    question: "Would you like bottoms only, or both bottoms and a shirt, within the 500 AUD total budget?" }));
  verifyBudget(result.reply);
  const noComma = text.replace("jacket, or", "jacket or"); verifyBudget(send(seed(), noComma).reply);
});
check("Mistaking the total for a per-item limit cannot bypass the combined solver", () => {
  const result = send(seed(), text, output(text, { action: "cross_sell", changes: [
    { scope: "item", field: "max_price", operation: "set", value: 500, evidence: "500 aud" },
  ] }));
  verifyBudget(result.reply); assert.equal(result.session.scopes.item.max_price, null);
});
check("Individually affordable pieces above the combined limit return no_match", () => {
  const expensive = rows.filter(row => ["JACKET", "BOTTOM-300", "SHIRT-310"].includes(row.product_id));
  const result = send(seed(), text, undefined, expensive);
  assert.equal(result.reply.status, "no_match"); assert.deepEqual(result.reply.products, []);
  assert.equal(result.session.styling.outfit_request.total_budget_aud, 500);
});
check("Pairing evidence names the actual jacket and excludes incompatible candidates", () => {
  const { reply } = send();
  for (const p of reply.products) { assert.deepEqual(p.pairing_evidence.anchor_ids, ["JACKET"]); assert.match(p.explanation, /Navy Denim Jacket/); }
});
check("An owned jacket is still a reference, never an A$800 new purchase", () => {
  const state = seed(); state.styling.outfit = [{ ...snapshot(jacket), ownership: "owned" }];
  const result = send(state); verifyBudget(result.reply);
  assert.equal(result.session.styling.outfit[0].ownership, "owned"); assert.equal(result.reply.outfit_budget.items.length, 2);
});
check("The look summary uses the same new-pieces budget when the reference was saved earlier", () => {
  const state = seed(); state.styling.outfit = [{ ...snapshot(jacket), ownership: "selected" }];
  const result = send(state); const totals = outfitTotals(result.session.styling);
  assert.equal(totals.total, 0); assert.equal(totals.remaining, 500);
  const selected = result.reply.outfit_budget.items.map(item => ({ ...snapshot(result.reply.products.find(p => p.product_id === item.product_id)), ownership: "selected" }));
  result.session.styling.outfit.push(...selected);
  assert.equal(outfitTotals(result.session.styling).total, 500); assert.equal(outfitTotals(result.session.styling).remaining, 0);
});
check("Budget-only refinement retains both requested roles and the jacket after history eviction", () => {
  const state = send().session; state.history = []; state.context = { focused: null, latest: [] };
  const message = "Make the combined budget 600 aud, keep everything else";
  const result = send(state, message, output(message, { action: "refine", reference: null,
    outfit_request: { ...state.styling.outfit_request, total_budget_aud: 600, evidence: message } }));
  verifyBudget(result.reply, 600); assert.deepEqual(result.session.styling.outfit_request.anchor_product_ids, ["JACKET"]);
  assert.ok(result.reply.products.every(p => p.pairing_evidence.anchor_ids.includes("JACKET")));
});
check("Missing or ambiguous jacket asks only for the jacket and remembers the set", () => {
  for (const ambiguous of [false, true]) {
    const state = seed(); state.context.focused = null;
    state.context.latest = ambiguous ? [snapshot(jacket), snapshot({ ...jacket, product_id: "OTHER", product_name: "Grey Jacket" })] : [];
    const result = send(state);
    assert.equal(result.reply.status, "needs_clarification"); assert.match(result.reply.message, /Which jacket/);
    assert.equal(result.session.styling.outfit_request.total_budget_aud, 500); assert.equal(result.session.styling.outfit_request.items.length, 2);
    assert.deepEqual(result.reply.products, []);
    if (ambiguous) {
      const message = "The first jacket";
      const next = send(result.session, message, output(message, { action: "new_search", continuation: true,
        reference: { kind: "position", position: 1, subcategory: "jacket" },
        outfit_request: { ...result.session.styling.outfit_request, evidence: message } }));
      verifyBudget(next.reply); assert.deepEqual(next.session.styling.outfit_request.anchor_product_ids, ["JACKET"]);
    }
  }
});
check("A unique jacket can be resolved among a mixed shortlist", () => {
  const state = seed(); state.context.focused = null; state.context.latest = [snapshot(jacket), snapshot(rows[1])];
  verifyBudget(send(state).reply);
});
check("Genuine either/or wording is not converted into buying both", () => {
  for (const message of ["Find bottoms or a shirt, total budget is 500 aud", "Find either bottoms or a shirt as well, total budget is 500 aud", "Find bottoms or a shirt, not both, total budget is 500 aud"]) {
    assert.equal(simpleMatchingSet(message), null); assert.equal(additiveCombinedRequest(message), null);
  }
});
check("Compound qualifiers remain with the model and all component constraints are retained", () => {
  const message = "Find black bottoms in size 10 to match the jacket, and a white shirt in size 12 as well, total budget is 500 aud";
  const state = seed(); assert.equal(shortcutPlan(makeTurn(state, message)), null);
  const item = extra => ({ ...emptyShoppingPreferences(), category: "Clothing", ...extra });
  const plan = output(message, { outfit_request: { total_budget_aud: 500, evidence: message, items: [
    item({ subcategory: "Bottoms", preferred_colours: ["Black"], size: "10" }),
    item({ subcategory: "Tops", product_type: "Shirt", preferred_colours: ["White"], size: "12" }),
  ] } });
  const result = send(state, message, plan);
  assert.deepEqual(result.session.styling.outfit_request.items.map(item => item.size), ["10", "12"]);
  assert.deepEqual(result.session.styling.outfit_request.items.map(item => item.preferred_colours), [["Black"], ["White"]]);
});
check("A non-shortcut model cannot omit one requested component", () => {
  const message = "Please find some bottoms and a shirt to match the jacket, with a total budget of 500 aud";
  assert.throws(() => checkConversationPlan(makeTurn(seed(), message), output(message, { action: "cross_sell" })), /Use outfit_request/);
});
check("Response contract rejects an inflated displayed combination", () => {
  const reply = structuredClone(send().reply); reply.products[0].price_aud = 501;
  assert.equal(TurnReplySchema.safeParse(reply).success, false);
});
console.log(`\n${passed} matching-set combined-budget checks passed.`);
