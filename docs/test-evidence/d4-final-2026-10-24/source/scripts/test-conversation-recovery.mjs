import assert from "node:assert/strict";
import { newSession, makeTurn, snapshot, acceptReply } from "../lib/stylist/conversationProtocol.ts";
import { finishConversationTurn } from "../lib/stylist/conversationTurn.ts";
import { checkConversationPlan, generateValidatedConversationPlan } from "../lib/stylist/conversationPlan.ts";
import { groundConversationPlan } from "../lib/stylist/conversationGrounding.ts";
import { explicitSizeEdit } from "../lib/stylist/sizeEdit.ts";
import { requestedComponents } from "../lib/stylist/combinedShoppingRequest.ts";
import { prepareConversationTask } from "../lib/stylist/taskState.ts";
import { product } from "./fixtures/customer-scenarios.mjs";

// Integration regressions for actual failed browser prompts. Synthetic records
// make state, identity and budget assertions independent of changing stock/model output.
const dress = product("DRESS", "Clothing", 155, { product_name: "Olive Maxi Dress", subcategory: "Dresses", product_type: "Maxi Dress", colour: "Olive", occasion: "Wedding Guest", sizes_available: ["12", "M"], cross_sell_category: "Shoes" });
const flats = product("FLATS", "Shoes", 110, { product_name: "Sage Ballet Flats", subcategory: "Flats", product_type: "Ballet Flats", occasion: "Wedding Guest", sizes_available: ["38"], cross_sell_category: null });
const over = { ...flats, product_id: "OVER", price_aud: 130 };
const shirt = product("SHIRT", "Clothing", 50, { product_name: "Blue Oxford Shirt", subcategory: "Tops", product_type: "Oxford Shirt", occasion: "Work", gender: "Men", sizes_available: ["M"] });
const jacket = product("JACKET", "Clothing", 80, { subcategory: "Outerwear", product_type: "Denim Jacket", occasion: "Casual" });
const bag = product("BAG", "Bags", 30, { occasion: "Casual" });
const rows = [dress, flats, over, shirt, jacket, bag,
  ...["Red", "White", "Cream"].map(colour => product(`COLOUR-${colour}`, "Bags", 30, { colour }))];
const vocabulary = { rows, sizes: ["12", "M", "38"], categories: [...new Map(rows.flatMap(row => [{ category: row.category, subcategory: null }, { category: row.category, subcategory: row.subcategory }]).map(value => [JSON.stringify(value), value])).values()] };
const change = (field, value, evidence, operation = "set", scope = "item") => ({ field, value, evidence, operation, scope });
const plan = (message, changes = [], extra = {}) => ({ action: "refine", intent_evidence: message.slice(0, 250), changes, reference: null, question: null, continuation: false, ...extra });
const session = () => { const state = newSession(); state.collection.choice = "All"; return state; };
const dresses = () => { const state = session(); Object.assign(state.scopes.item, { category: "Clothing", subcategory: "Dresses", size: "999", max_price: 1 }); return state; };
const outfit = () => { const state = session(); state.styling.outfit_request = { total_budget_aud: 280, evidence: "$280 total", items: [{ ...state.scopes.item, category: "Clothing", subcategory: "Dresses" }, { ...state.scopes.item, category: "Shoes" }] }; return state; };
function send(state, message, changes = [], extra = {}) {
  const turn = makeTurn(state, message);
  return acceptReply(turn, finishConversationTurn(rows, turn, plan(message, changes, extra), vocabulary));
}
let passed = 0;
async function check(name, run) { await run(); passed++; console.log(`PASS: ${name}`); }

await check("No size filter clears an invalid size without inventing filter", () => {
  const state = dresses(); state.scopes.shared.excluded_colours = ["Red"];
  const message = "Show women's dresses under $180. No size filter.";
  const result = send(state, message, [change("size", "filter", "size filter")]);
  assert.equal(result.reply.status, "matches", JSON.stringify(result.reply.issues)); assert.equal(result.session.scopes.item.size, null);
  assert.equal(result.session.scopes.item.max_price, 180); assert.deepEqual(result.session.scopes.shared.excluded_colours, ["Red"]);
});
await check("Set size to 12 replaces the size while retaining unrelated constraints", () => {
  const state = dresses(); state.scopes.item.max_price = 180; state.scopes.item.excluded_colours = ["Cream"];
  const result = send(state, "Set size to 12.", [change("size", "to", "size to")]);
  assert.equal(result.reply.status, "matches", JSON.stringify(result.reply.issues)); assert.equal(result.session.scopes.item.size, "12");
  assert.deepEqual(result.session.scopes.item.excluded_colours, ["Cream"]); assert.equal(result.session.scopes.item.max_price, 180);
});
await check("Dropping size 999 with a budget correction removes the old size", () => {
  const message = "Okay, drop the impossible $1 and size 999. Back to real women's dresses below $180, no size filter and no cream.";
  const result = send(dresses(), message, [change("excluded_colours", ["Cream"], "no cream", "add")]);
  assert.equal(result.reply.status, "matches", JSON.stringify(result.reply.issues)); assert.equal(result.session.scopes.item.size, null);
  assert.equal(result.session.scopes.item.max_price, 180); assert.deepEqual(result.session.scopes.item.excluded_colours, ["Cream"]);
  assert.equal(explicitSizeEdit("Drop the impossible $1 and size 999.").value, null);
});
await check("Size parsing does not fabricate labels from prose or execute a negated edit", () => {
  for (const text of ["No idea what his size is.", "I need size advice.", "Don't set size to 12.", "Do not remove size 12.", "No size 12, please."]) assert.equal(explicitSizeEdit(text), null, text);
  assert.equal(explicitSizeEdit("Drop size 999, then use size 12.").value, "12");
  const invalid = send(dresses(), "Show dresses in size 999 under $180.");
  assert.equal(invalid.reply.status, "needs_clarification"); assert.equal(invalid.reply.issues[0].value, "999");
});
await check("Removed outfit components are not counted as new combined purchases", () => {
  const message = "Let's change tack. Drop the shoes and the combined outfit search. Show only women's wedding guest dresses below $180, no white or cream. Any size for browsing.";
  assert.deepEqual([...requestedComponents(message).keys()], ["Dresses"]);
  const state = outfit(); state.scopes.shared.excluded_colours = ["Red"]; state.styling.outfit = [{ ...snapshot(dress), ownership: "selected" }];
  const result = send(state, message, [change("excluded_colours", ["White", "Cream"], "no white or cream", "add")], { action: "new_search" });
  assert.equal(result.reply.status, "matches", JSON.stringify(result.reply.issues)); assert.equal(result.session.styling.outfit_request, null); assert.equal(result.reply.outfit_choices, null);
  assert.deepEqual(result.reply.products.map(row => row.product_id), ["DRESS"]); assert.equal(result.session.scopes.item.max_price, 180);
  assert.deepEqual(result.session.scopes.item.excluded_colours, ["White", "Cream"]); assert.deepEqual(result.session.scopes.shared.excluded_colours, ["Red"]);
  assert.equal(result.session.styling.outfit[0].product_id, "DRESS"); assert.equal(result.session.task.generation, 1);
});
await check("A complete single-dress restatement clears the active group even if the model says refine", () => {
  const message = "Show women's wedding guest dresses under $180, excluding white and cream.";
  const result = send(outfit(), message, [change("excluded_colours", ["White", "Cream"], "excluding white and cream", "add")]);
  assert.equal(result.reply.status, "matches", JSON.stringify(result.reply.issues)); assert.equal(result.session.styling.outfit_request, null);
  assert.equal(result.reply.outfit_budget, null); assert.ok(result.reply.products.every(row => row.subcategory === "Dresses"));
});
await check("An actual grouped request still cannot omit shoes or bypass the combined budget", () => {
  const message = "Show a dress and shoes, $280 total.";
  assert.deepEqual([...requestedComponents(message).keys()], ["Dresses", "Shoes"]);
  assert.throws(() => checkConversationPlan(makeTurn(session(), message), plan(message, [], { action: "new_search" })), /Use outfit_request/);
  const state = outfit(); const edit = "Show more dresses, keep the shoes and $280 combined budget.";
  const result = send(state, edit, [], { outfit_request: { ...state.styling.outfit_request, evidence: edit } });
  assert.equal(result.session.styling.outfit_request.items.length, 2); assert.ok(result.reply.outfit_choices.maximum_total_aud <= 280);
  const retained = prepareConversationTask(makeTurn(state, "Show dresses under $180, but don't drop the shoes."));
  assert.deepEqual(retained.styling.outfit_request, state.styling.outfit_request);
});
await check("Compound both-collections/weekend answers normalize item scope and browse immediately", () => {
  const state = newSession(); state.collection.checkpoint = { action: "discover", discovery_intent: "start" };
  state.discovery = { stage: "collection", asked: ["collection"], skipped: [], seen_product_ids: [] };
  const message = "Both, honestly. I steal my boyfriend's jumpers. Can you surprise me with something for an ordinary weekend, not an occasion?";
  const result = send(state, message, [change("gender", null, "Both", "set", "shared")], { action: "discover", discovery_intent: "browse" });
  assert.equal(result.session.collection.choice, "All"); assert.equal(result.session.collection.checkpoint, null);
  assert.equal(result.session.scopes.shared.gender, null); assert.equal(result.session.scopes.item.occasion, "Casual");
  assert.equal(result.session.discovery.stage, "browsing"); assert.ok(result.reply.products.length + result.reply.alternatives.length);
});
await check("A clear collection answer survives a failed interpretation of its other clauses", () => {
  const state = newSession(); state.collection.checkpoint = { action: "discover", discovery_intent: "start" };
  const result = send(state, "Both, honestly. Show me weekend ideas.", [], { action: "clarify", question: "Could you rephrase the requested change?" });
  assert.equal(result.reply.intent_understood, false); assert.equal(result.session.collection.choice, "All");
  const next = send(result.session, "Relaxed weekends. Show me ideas.", [], { action: "discover", discovery_intent: "browse" });
  assert.equal(next.session.collection.checkpoint, null); assert.equal(next.session.discovery.stage, "browsing");
});
await check("Detailed saved-dress shoes continuation uses only shoes and A$125 remaining", () => {
  const state = dresses(); state.scopes.item.size = "12"; state.scopes.item.max_price = 180;
  state.styling.outfit = [{ ...snapshot(dress), ownership: "selected" }]; state.context.latest = [snapshot(dress)];
  const message = "I saved the olive dress. I still need shoes for grass at the winery — flats would be sensible. Keep the dress and shoes under $280 combined, so shoes can't cost more than $125. Any ideas?";
  const result = send(state, message, [], { action: "new_search", outfit_request: { ...outfit().styling.outfit_request, evidence: message } });
  assert.equal(result.reply.action, "cross_sell"); assert.equal(result.reply.purchase_budget.fixed_total_aud, 155);
  assert.equal(result.reply.purchase_budget.remaining_aud, 125); assert.equal(result.reply.purchase_budget.maximum_total_aud, 265, JSON.stringify({status:result.reply.status,message:result.reply.message,preferences:result.reply.applied_preferences}));
  assert.deepEqual([...result.reply.products, ...result.reply.alternatives].map(row => row.product_id), ["FLATS"]);
  assert.equal(result.session.scopes.item.size, null); assert.equal(result.session.styling.outfit[0].product_id, "DRESS");
});
await check("Purchase-budget confirmation plus options is not routed to a pure price answer", () => {
  const state = session(); state.styling.outfit = [{ ...snapshot(dress), ownership: "selected" }];
  const message = "The saved Olive Maxi Dress is a planned purchase, not something I already own. My total purchase budget is $280 for that dress and one pair of flats. Please confirm the remaining shoe budget and show options.";
  const result = send(state, message, [], { action: "none", answer: { kind: "product", topics: ["price"], references: [{ kind: "id", value: "DRESS" }], purpose: null, continuation: false } });
  assert.equal(result.reply.action, "cross_sell"); assert.equal(result.reply.purchase_budget.remaining_aud, 125);
  assert.ok(result.reply.message.includes("A$125.00")); assert.equal(result.session.styling.outfit[0].ownership, "selected");
});
await check("Owned anchors and selected purchases have different remaining budgets", () => {
  const message = "Keep my saved Olive Maxi Dress. I need flat shoes, $280 combined total.";
  const run = ownership => { const state = session(); state.styling.outfit = [{ ...snapshot(dress), ownership }]; return send(state, message); };
  assert.equal(run("selected").reply.purchase_budget.remaining_aud, 125);
  assert.equal(run("owned").reply.purchase_budget.remaining_aud, 280);
});
await check("Ambiguous saved dresses are not silently resolved to the first item", () => {
  const state = session(); state.styling.outfit = [{ ...snapshot(dress), ownership: "selected" }, { ...snapshot({ ...dress, product_id: "OTHER", product_name: "Navy Dress" }), ownership: "selected" }];
  const message = "Keep my saved dress. I need flat shoes under $125.";
  const grounded = groundConversationPlan(makeTurn(state, message), plan(message, [], { action: "clarify", question: "Which saved dress?" }));
  assert.equal(grounded.action, "clarify"); assert.equal(grounded.reference, null);
});
await check("Exhausted model repair cannot turn task replacement into unverified retrieval", async () => {
  const message = "Drop the shoes. Show only dresses under $180, no white or cream.";
  const turn = makeTurn(outfit(), message);
  const result = await generateValidatedConversationPlan(turn, async () => { throw new SyntaxError("bad JSON"); });
  assert.equal(result.action, "clarify"); assert.deepEqual(result.changes, []);
  const reply = finishConversationTurn(rows, turn, result, vocabulary);
  assert.equal(reply.status, "needs_clarification"); assert.deepEqual(reply.products, []);
});
console.log(`${passed} conversation recovery integration checks passed.`);
