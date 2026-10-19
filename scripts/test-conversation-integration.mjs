import assert from "node:assert/strict";
import { checkConversationPlan } from "../lib/stylist/conversationPlan.ts";
import { createPreferenceScopes } from "../lib/stylist/preferenceScope.ts";
import { newSession, makeTurn, snapshot, acceptReply, TurnReplySchema } from "../lib/stylist/conversationProtocol.ts";
import { interpreterInput, shortcutPlan, cancellationReply, finishConversationTurn } from "../lib/stylist/conversationTurn.ts";
import { ConversationStore, RetryExpiredError, RequestConflictError } from "../lib/stylist/conversationStore.ts";

// Synthetic catalogue, simulated interpretations and in-memory requests. No network calls.
const main = {
  product_id: "D1", product_name: "Lavender Wrap Dress", price_aud: 100,
  category: "Clothing", subcategory: "Dresses", product_type: "Wrap Dress",
  colour: "Lavender", style: "Formal", occasion: "Beach Wedding",
  gender: null, brand_line: null, material: "Cotton", fit: "Regular", season: "Summer",
  sizes_available: ["10"], stock_qty: 5, is_available: true,
  description: null, tags: [], image_key: null, cross_sell_category: "Bags",
};
const second = { ...main, product_id: "D2", product_name: "Other Lavender Dress", price_aud: 90 };
const blue = { ...main, product_id: "D3", product_name: "Blue Wrap Dress", price_aud: 70, colour: "Blue" };
const bag = { ...main, product_id: "B1", product_name: "Blue Bag", price_aud: 45, colour: "Blue", category: "Bags", subcategory: "Clutches", product_type: "Clutch", sizes_available: ["One Size"], cross_sell_category: null };
const expensiveBag = { ...bag, product_id: "B2", product_name: "Other Bag", price_aud: 80 };
const rows = [main, second, blue, bag, expensiveBag];
const vocabulary = {
  rows, sizes: ["10", "12", "One Size"],
  categories: [
    { category: "Clothing", subcategory: null }, { category: "Clothing", subcategory: "Dresses" },
    { category: "Bags", subcategory: null }, { category: "Bags", subcategory: "Clutches" },
    { category: "Shoes", subcategory: null },
  ],
};
const change = (field, value, evidence, scope = "item") => ({ scope, field, value, evidence, operation: "set" });
const plan = (message, action, changes = [], reference = null, continuation = false) => ({
  action, changes, reference, continuation, question: null, intent_evidence: message,
});
function existingSession() {
  const session = newSession();
  Object.assign(session.scopes.item, { category: "Clothing", subcategory: "Dresses", preferred_colours: ["Lavender"], max_price: 100, size: "10" });
  session.context.latest = [snapshot(main), snapshot(second)];
  return session;
}
const finish = (turn, value, catalogue = rows) => finishConversationTurn(catalogue, turn, value, vocabulary);
let passed = 0;
async function check(name, test) { await test(); passed++; console.log(`PASS: ${name}`); }

await check("New searches do not require size or budget", () => {
  const turn = makeTurn(newSession(), "Show bags");
  const result = finish(turn, plan(turn.message, "new_search", [change("category", "Bags", "bags")]));
  assert.equal(result.status, "matches");
  assert.equal(result.applied_preferences.max_price, null);
  assert.equal(result.applied_preferences.size, null);
});

await check("A card supplies the exact reference and bypasses AI interpretation", () => {
  const turn = makeTurn(existingSession(), "Find an extra for this dress", snapshot(second), { kind: "cross_sell", product_id: "D2" });
  const result = finish(turn, shortcutPlan(turn));
  assert.equal(result.status, "matches");
  assert.equal(result.applied_preferences.category, "Bags");
  assert.equal(result.applied_preferences.max_price, null);
  assert.equal(result.applied_preferences.size, null);
});

await check("Shared restrictions survive shortcuts without inheriting dress-only colour", () => {
  const session = existingSession();
  session.scopes.shared.max_price = 50;
  const turn = makeTurn(session, "Find an extra", snapshot(main), { kind: "cross_sell", product_id: "D1" });
  const result = finish(turn, shortcutPlan(turn));
  assert.deepEqual(result.products.map(p => p.product_id), ["B1"]);
  assert.deepEqual(result.applied_preferences.preferred_colours, []);
  assert.equal(result.proposed_scopes.shared.max_price, 50);
  assert.equal(result.proposed_scopes.item.max_price, null);
});

await check("An ambiguous cross-sell stores the unfinished bag request", () => {
  const turn = makeTurn(existingSession(), "Find a bag for that dress");
  const result = finish(turn, plan(turn.message, "cross_sell", [change("category", "Bags", "bag")]));
  assert.equal(result.status, "needs_clarification");
  assert.equal(result.pending.action, "cross_sell");
  assert.equal(result.proposed_scopes.item.category, "Bags");
  assert.deepEqual(result.products, []);
});

await check("The second-product answer resumes that cross-sell instead of searching for dresses", () => {
  const first = makeTurn(existingSession(), "Find a bag for that dress");
  const question = finish(first, plan(first.message, "cross_sell", [change("category", "Bags", "bag")]));
  const session = acceptReply(first, question).session;
  const next = makeTurn(session, "The second product");
  const answer = plan(next.message, "cross_sell", [], { kind: "position", position: 2, subcategory: null }, true);
  const result = finish(next, answer);
  assert.equal(result.status, "matches");
  assert.equal(result.pending, null);
  assert.equal(result.applied_preferences.category, "Bags");
});

await check("Cancel restores the state before the pending request", () => {
  const first = makeTurn(existingSession(), "Find a bag for that dress");
  const question = finish(first, plan(first.message, "cross_sell", [change("category", "Bags", "bag")]));
  const session = acceptReply(first, question).session;
  const cancelled = cancellationReply(makeTurn(session, "cancel"));
  assert.equal(cancelled.pending, null);
  assert.deepEqual(cancelled.proposed_scopes, first.scopes);
});

await check("An unrelated turn does not delete a pending question", () => {
  const first = makeTurn(existingSession(), "Find a bag for that dress");
  const question = finish(first, plan(first.message, "cross_sell", [change("category", "Bags", "bag")]));
  const session = acceptReply(first, question).session;
  const hello = makeTurn(session, "Hello");
  const result = finish(hello, plan(hello.message, "none"));
  assert.equal(result.status, "no_action");
  assert.deepEqual(result.pending, session.pending);
});

await check("Continuation without a matching pending request is rejected", () => {
  const turn = makeTurn(existingSession(), "The second product");
  assert.throws(() => checkConversationPlan(interpreterInput(turn), plan(turn.message, "cross_sell", [], null, true)));
});

await check("Compound cheaper-and-blue keeps the saved maximum", () => {
  const turn = makeTurn(existingSession(), "Cheaper and blue", snapshot(main));
  const result = finish(turn, plan(turn.message, "cheaper", [change("preferred_colours", ["Blue"], "blue")]));
  assert.equal(result.status, "matches");
  assert.deepEqual(result.products.map(p => p.product_id), ["D3"]);
  assert.equal(result.applied_preferences.max_price, 100);
});

await check("After bag results the context refers to bags", () => {
  const turn = makeTurn(existingSession(), "Find an extra", snapshot(main), { kind: "cross_sell", product_id: "D1" });
  const result = finish(turn, shortcutPlan(turn));
  const next = acceptReply(turn, result).session;
  assert.equal(next.scopes.item.category, "Bags");
  assert.equal(next.context.focused, null);
  assert.ok(next.context.latest.every(p => p.category === "Bags"));
});

await check("Empty results preserve reference memory without recommending stale products", () => {
  const session = existingSession(); session.scopes.shared.max_price = 0;
  const turn = makeTurn(session, "Find an extra", snapshot(main), { kind: "cross_sell", product_id: "D1" });
  const result = finish(turn, shortcutPlan(turn));
  const next = acceptReply(turn, result).session;
  assert.equal(result.status, "no_match");
  assert.deepEqual(result.products, []);
  assert.deepEqual(next.context.latest, turn.context.latest);
  assert.equal(next.scopes.shared.max_price, 0);
});

await check("A different page product does not inherit an old item's budget or colour", () => {
  const session = existingSession(); session.scopes.shared.max_price = 200;
  const turn = makeTurn(session, "Anything cheaper", snapshot(bag));
  assert.equal(turn.scopes.item.max_price, null);
  assert.equal(turn.scopes.item.size, null);
  assert.equal(turn.scopes.shared.max_price, 200);
  assert.deepEqual(turn.scopes.item.preferred_colours, []);
});

await check("Opening an already-recommended product preserves applicable item restrictions", () => {
  const turn = makeTurn(existingSession(), "Anything cheaper", snapshot(main));
  assert.equal(turn.scopes.item.max_price, 100);
  assert.equal(turn.scopes.item.size, "10");
});

await check("Invented shortcut IDs cannot choose an unrelated product", () => {
  const turn = makeTurn(existingSession(), "Find extras", null, { kind: "cross_sell", product_id: "INVENTED" });
  assert.throws(() => shortcutPlan(turn));
});

await check("A changed product reference requires refreshed context", () => {
  const turn = makeTurn(existingSession(), "Find extras", snapshot(main), { kind: "cross_sell", product_id: "D1" });
  const changed = rows.map(p => p.product_id === "D1" ? { ...p, product_name: "Changed" } : p);
  assert.equal(finish(turn, shortcutPlan(turn), changed).status, "needs_clarification");
});

await check("Unsupported shared restrictions remain blocking after a category change", () => {
  const session = existingSession(); session.scopes.unresolved_shared = ["No leather products"];
  const turn = makeTurn(session, "Find extras", snapshot(main), { kind: "cross_sell", product_id: "D1" });
  assert.equal(finish(turn, shortcutPlan(turn)).status, "needs_clarification");
});

await check("Suggestions use real stored cross-sell labels, not invented mappings", () => {
  const turn = makeTurn(newSession(), "Show clothing");
  const result = finish(turn, plan(turn.message, "new_search", [change("category", "Clothing", "clothing")]));
  assert.ok(result.products.every(p => p.extra_target === "Bags"));
});

await check("Response validation rejects an over-budget product", () => {
  const turn = makeTurn(newSession(), "Show bags under $50");
  const result = finish(turn, plan(turn.message, "new_search", [change("category", "Bags", "bags"), change("max_price", 50, "$50")]));
  assert.throws(() => TurnReplySchema.parse({ ...result, products: [{ ...result.products[0], price_aud: 51 }] }));
});

await check("No-match does not become a technical error or contain products", () => {
  const turn = makeTurn(newSession(), "Show bags under $0");
  const result = finish(turn, plan(turn.message, "new_search", [change("category", "Bags", "bags"), change("max_price", 0, "$0")]));
  assert.equal(result.status, "no_match");
  assert.equal(result.pending, null);
  assert.deepEqual(result.products, []);
});

await check("History is bounded and Reset creates an empty conversation", () => {
  let session = existingSession();
  for (let i = 0; i < 8; i++) {
    const turn = makeTurn(session, "Hello");
    session = acceptReply(turn, finish(turn, plan(turn.message, "none"))).session;
  }
  assert.equal(session.history.length, 6);
  assert.deepEqual(newSession().scopes, createPreferenceScopes());
  assert.deepEqual(newSession().context.latest, []);
});

await check("A catalogue retry reuses the validated interpretation", async () => {
  const store = new ConversationStore(); let calls = 0; let searches = 0;
  const generate = async () => { calls++; return { accepted: true }; };
  const execute = async () => { searches++; if (searches === 1) throw new Error("Simulated catalogue failure"); return { ok: true }; };
  await assert.rejects(store.run("id", { message: "bags" }, false, generate, execute));
  assert.deepEqual(await store.run("id", { message: "bags" }, true, generate, execute), { ok: true });
  assert.equal(calls, 1); assert.equal(searches, 2);
});

await check("Duplicate in-flight requests coalesce", async () => {
  const store = new ConversationStore(); let calls = 0;
  const generate = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return { plan: true }; };
  const execute = async () => ({ ok: true });
  const outputs = await Promise.all([
    store.run("same", {}, false, generate, execute),
    store.run("same", {}, false, generate, execute),
  ]);
  assert.equal(calls, 1); assert.deepEqual(outputs[0], outputs[1]);
});

await check("A request ID cannot be reused for different input", async () => {
  const store = new ConversationStore();
  await store.run("id", { message: "bags" }, false, async () => ({}), async () => ({}));
  await assert.rejects(store.run("id", { message: "shoes" }, true, async () => ({}), async () => ({})), RequestConflictError);
});

await check("Expired retries do not silently make a new model call", async () => {
  let now = 0; let calls = 0;
  const store = new ConversationStore(() => now, 10);
  const generate = async () => { calls++; return {}; };
  await store.run("id", {}, false, generate, async () => ({})); now = 11;
  await assert.rejects(store.run("id", {}, true, generate, async () => ({})), RetryExpiredError);
  assert.equal(calls, 1);
});

await check("An interpretation failure can be manually retried, never automatically", async () => {
  const store = new ConversationStore(); let calls = 0;
  const generate = async () => { calls++; if (calls === 1) throw new Error("Simulated provider failure"); return {}; };
  await assert.rejects(store.run("id", {}, false, generate, async () => ({})));
  assert.equal(calls, 1);
  await store.run("id", {}, true, generate, async () => ({}));
  assert.equal(calls, 2);
});

console.log(`\n${passed} conversation-integration checks passed.`);
