import assert from "node:assert/strict";
import { makeTurn, acceptReply, TurnReplySchema } from "../lib/stylist/conversationProtocol.ts";
import { allCollectionSession as newSession } from "./fixtures/collection-session.mjs";
import { shortcutPlan, finishConversationTurn, interpreterInput, cancellationReply } from "../lib/stylist/conversationTurn.ts";
import { checkConversationPlan } from "../lib/stylist/conversationPlan.ts";
import { searchByPreferences } from "../lib/search/preferenceSearch.ts";
import { emptyShoppingPreferences } from "../lib/stylist/preferenceScope.ts";
import { catalogue, product } from "./fixtures/customer-scenarios.mjs";

// Real turn handling/search with synthetic records; no model or database calls.
const vocabulary = rows => ({ rows, sizes: [...new Set(rows.flatMap(row => row.sizes_available))],
  categories: [...new Map(rows.flatMap(row => [{ category: row.category, subcategory: null },
    { category: row.category, subcategory: row.subcategory }]).map(row => [JSON.stringify(row), row])).values()] });
const plan = (message, extra = {}) => ({ action: "discover", discovery_intent: "browse", intent_evidence: message.slice(0, 250),
  reference: null, changes: [], question: null, continuation: false, ...extra });
const change = (field, value, evidence) => ({ scope: "item", field, value, evidence, operation: "set" });
const visible = reply => [...reply.products, ...reply.alternatives];
function send(session, message, output, rows = catalogue, shortcut) {
  const turn = makeTurn(session, message, null, shortcut);
  const chosen = output ?? shortcutPlan(turn);
  assert.ok(chosen, `Missing shortcut for ${message}`);
  return acceptReply(turn, finishConversationTurn(rows, turn, chosen, vocabulary(rows)));
}
let passed = 0;
function check(name, run) { run(); passed++; console.log(`PASS: ${name}`); }

check("The screenshot's uncertain request asks one easy question without inventing preferences", () => {
  for (const text of ["i dont know what i am looking for", "I don't know what I'm looking for.", "I feel like buying something new, but I have no idea what I want.", "Help me choose"]) {
    const result = send(newSession(), text);
    assert.equal(result.reply.action, "discover"); assert.equal(result.reply.pending, null);
    assert.equal(result.reply.message.match(/\?/g)?.length, 1);
    assert.equal(result.reply.suggested_replies.length, 3);
    assert.deepEqual(result.session.scopes, newSession().scopes);
    assert.deepEqual(result.session.discovery.asked, ["direction"]);
    assert.match(result.reply.message, /everyday wear.*occasion.*ideas/i);
  }
});
check("Everyday discovery asks one routine question, then browsing skips optional inputs", () => {
  const first = send(newSession(), "Help me choose");
  const everyday = send(first.session, first.reply.suggested_replies[0].message);
  assert.equal(everyday.session.scopes.item.occasion, "Casual");
  assert.equal(everyday.session.scopes.item.category, null);
  assert.deepEqual(everyday.session.discovery.asked, ["direction", "routine"]);
  assert.equal(everyday.reply.message.match(/\?/g)?.length, 1);
  const work = send(everyday.session, everyday.reply.suggested_replies[0].message);
  assert.ok(visible(work.reply).length); assert.equal(work.session.scopes.item.occasion, "Work");
  assert.equal(work.session.scopes.item.size, null); assert.equal(work.session.scopes.item.max_price, null);
  assert.ok(visible(work.reply).every(item => item.occasion === "Work"));
});
check("Repeated uncertainty moves to inspiration and never repeats a skipped question", () => {
  const first = send(newSession(), "Help me choose");
  const second = send(first.session, "I'm still not sure.");
  assert.ok(visible(second.reply).length); assert.equal(second.reply.pending, null);
  assert.deepEqual(second.session.discovery.skipped, ["direction"]);
  assert.deepEqual(second.session.scopes, first.session.scopes);
  assert.equal(new Set(visible(second.reply).map(row => row.category)).size, 4);
  assert.equal(second.reply.optional_question.match(/\?/g)?.length, 1);
});
check("The two-question limit survives short-history eviction", () => {
  const first = send(newSession(), "Help me choose");
  const second = send(first.session, "Something for everyday wear.");
  second.session.history = [];
  const third = send(second.session, "Something for an occasion.");
  assert.ok(visible(third.reply).length); assert.equal(third.session.discovery.asked.length, 2);
  assert.equal(third.session.discovery.stage, "browsing");
});
check("An unspecified occasion is never saved as a fabricated filter", () => {
  const first = send(newSession(), "Help me choose");
  const occasion = send(first.session, first.reply.suggested_replies[1].message);
  assert.equal(occasion.session.discovery.stage, "occasion");
  assert.equal(occasion.session.scopes.item.occasion, null);
  const wedding = send(occasion.session, occasion.reply.suggested_replies[0].message);
  assert.ok(visible(wedding.reply).length); assert.equal(wedding.session.scopes.item.occasion, "Wedding Guest");
});
check("Skipping immediately browses, and surprise me does not start a questionnaire", () => {
  const first = send(newSession(), "Help me choose");
  for (const text of ["Skip this question", "Show me a few different ideas.", "Surprise me"]) {
    const result = send(first.session, text);
    assert.ok(visible(result.reply).length); assert.equal(result.reply.pending, null);
    assert.ok(result.session.discovery.skipped.includes("direction"));
  }
  assert.ok(visible(send(newSession(), "Surprise me").reply).length);
});
check("Fresh batches do not recycle rejected ideas and exhaustion is honest", () => {
  let result = send(newSession(), "Show me ideas");
  const seen = new Set();
  while (visible(result.reply).length) {
    for (const item of visible(result.reply)) { assert.ok(!seen.has(item.product_id)); seen.add(item.product_id); }
    result = send(result.session, "None of these. Show me different ideas.");
  }
  assert.equal(result.reply.status, "no_match");
  assert.match(result.reply.message, /different available ideas/);
  assert.equal(result.reply.pending, null); assert.deepEqual(result.reply.suggested_replies, []);
  assert.equal(seen.size, catalogue.length);
});
check("None of these also skips the current shortlist before discovery has started", () => {
  const state = newSession(); state.context.latest = catalogue.slice(0, 4).map(row => ({
    product_id: row.product_id, product_name: row.product_name, category: row.category,
    subcategory: row.subcategory, product_type: row.product_type, price_aud: row.price_aud,
  }));
  const ids = new Set(state.context.latest.map(row => row.product_id));
  const result = send(state, "None of these.");
  assert.ok(visible(result.reply).length); assert.ok(visible(result.reply).every(item => !ids.has(item.product_id)));
});
check("Discovery honours budgets, exclusions, sizes, features, rejected items and cart items", () => {
  const rows = [
    product("OK", "Bags", 60, {}, { zip_closure: true, closure: "zip" }),
    product("OVER", "Bags", 160, {}, { zip_closure: true, closure: "zip" }),
    product("BROWN", "Bags", 50, { colour: "Brown" }, { zip_closure: true, closure: "zip" }),
    product("WRONG-SIZE", "Bags", 50, { sizes_available: ["Other"] }, { zip_closure: true, closure: "zip" }),
    product("NO-ZIP", "Bags", 50), product("REJECTED", "Bags", 50, {}, { zip_closure: true, closure: "zip" }),
    product("CART", "Bags", 50, {}, { zip_closure: true, closure: "zip" }),
    product("SOLD-OUT", "Bags", 50, { stock_qty: 0 }, { zip_closure: true, closure: "zip" }),
  ];
  const state = newSession();
  Object.assign(state.scopes.item, { category: "Bags", size: "One Size", max_price: 100, excluded_colours: ["Brown"] });
  state.styling.required_features = ["zip_closure"]; state.styling.rejected_ids = ["REJECTED"]; state.cart_product_ids = ["CART"];
  const before = structuredClone(state);
  const result = send(state, "I'm not sure", undefined, rows);
  assert.deepEqual(visible(result.reply).map(row => row.product_id), ["OK"]);
  assert.deepEqual(result.session.scopes, before.scopes);
  assert.deepEqual(result.session.styling, before.styling);
});
check("Unknown and conflicting restrictions still block inspiration", () => {
  const state = newSession(); state.scopes.unresolved_item = ["no leather"];
  const result = send(state, "Show me ideas");
  assert.equal(result.reply.status, "needs_clarification"); assert.equal(visible(result.reply).length, 0);
  assert.deepEqual(result.session.scopes.unresolved_item, ["no leather"]);
  assert.equal(result.reply.pending.action, "discover");
  const conflict = newSession(); conflict.scopes.item.min_price = 100; conflict.scopes.item.max_price = 50;
  assert.equal(send(conflict, "Show me ideas").reply.status, "needs_clarification");
});
check("A blocking discovery requirement can be explicitly removed without losing other limits", () => {
  const state = newSession(); state.scopes.unresolved_item = ["no leather"]; state.scopes.item.max_price = 100;
  const first = send(state, "Show me ideas");
  const message = "Remove my no leather requirement and show me ideas.";
  const result = send(first.session, message, plan(message, { continuation: true,
    changes: [{ scope: "item", field: "unresolved", operation: "remove", value: ["no leather"], evidence: "Remove my no leather requirement" }] }));
  assert.ok(visible(result.reply).length); assert.equal(result.reply.pending, null);
  assert.equal(result.session.scopes.item.max_price, 100);
});
check("Explicit feature requirements also filter broad ideas, and cannot be omitted", () => {
  const message = "Show me ideas with pockets.";
  const rows = [product("POCKETS", "Clothing", 80, {}, { pockets: true }), product("NO-POCKETS", "Clothing", 60)];
  assert.throws(() => send(newSession(), message, plan(message), rows), /kind=requirement/);
  const result = send(newSession(), message, plan(message, { styling_intent: {
    preferences: [{ kind: "requirement", operation: "add", value: "pockets", evidence: "with pockets" }],
    outfit_changes: [], owned_categories: [], external_items: [], offers: null,
  } }), rows);
  assert.deepEqual(visible(result.reply).map(row => row.product_id), ["POCKETS"]);
});
check("Choosing an item after discovery keeps the earlier budget and exclusions", () => {
  const state = newSession(); state.scopes.item.max_price = 100; state.scopes.item.excluded_colours = ["Beige"];
  const first = send(state, "Help me choose");
  const message = "Let's start with dresses.";
  const result = send(first.session, message, plan(message, { action: "new_search", discovery_intent: null,
    changes: [change("category", "Clothing", "dresses"), change("subcategory", "Dresses", "dresses")] }));
  assert.ok(visible(result.reply).length); assert.equal(result.reply.action, "refine");
  assert.equal(result.session.scopes.item.max_price, 100); assert.deepEqual(result.session.scopes.item.excluded_colours, ["Beige"]);
  assert.equal(result.session.discovery.stage, "complete");
});
check("A discovery answer is not a blocking continuation even if the model copies the prior question", () => {
  const first = send(newSession(), "Help me choose");
  const message = "Something for everyday wear. Maybe a dress, but I'm open to ideas.";
  const result = send(first.session, message, plan(message, { action: "new_search", discovery_intent: null,
    continuation: true, question: "Would you prefer a dress?", changes: [change("category", "Clothing", "dress")] }));
  assert.ok(visible(result.reply).length); assert.equal(result.reply.pending, null);
  assert.equal(result.session.scopes.item.occasion, "Casual");
});
check("More like this narrows the item without selecting it or guessing colour and budget", () => {
  const first = send(newSession(), "Show me ideas");
  const anchor = visible(first.reply).find(row => row.category === "Clothing");
  const result = send(first.session, `Show me more like ${anchor.product_name}.`, undefined, catalogue,
    { kind: "similar", product_id: anchor.product_id });
  assert.ok(visible(result.reply).length);
  assert.ok(visible(result.reply).every(row => row.product_id !== anchor.product_id && row.category === anchor.category));
  assert.deepEqual(result.session.styling.outfit, []); assert.deepEqual(result.session.scopes.item.preferred_colours, []);
  assert.equal(result.session.scopes.item.max_price, null);
});
check("Compound uncertainty is interpreted instead of dropping trailing constraints or questions", () => {
  for (const message of ["I'm not sure, but under $80 and no leather.", "Show me ideas under $80.", "I'm not sure. What is your returns policy?"]) {
    assert.equal(shortcutPlan(makeTurn(newSession(), message)), null);
  }
  const message = "Show me ideas under $80.";
  const result = send(newSession(), message, plan(message, { changes: [change("max_price", 80, "under $80")] }));
  assert.ok(visible(result.reply).length); assert.ok(visible(result.reply).every(item => item.price_aud <= 80));
});
check("Active combined-budget outfits and pending product questions are not hijacked", () => {
  const state = newSession(); state.styling.outfit_request = { total_budget_aud: 300, evidence: "dress and shoes for $300 total",
    items: [{ ...emptyShoppingPreferences(), category: "Clothing", subcategory: "Dresses" }, { ...emptyShoppingPreferences(), category: "Shoes" }] };
  const message = "Show me ideas";
  assert.equal(shortcutPlan(makeTurn(state, message)), null);
  assert.throws(() => checkConversationPlan(interpreterInput(makeTurn(state, message)), plan(message)), /active outfit/);
  const pending = newSession(); pending.pending_answer = { intent: { kind: "product", topics: ["material"], references: [{ kind: "context" }], purpose: null, continuation: false }, question: "Which material?", follow_up: null };
  assert.equal(shortcutPlan(makeTurn(pending, message)), null);
});
check("Pure answers and cancellation retain discovery memory without another discovery question", () => {
  const first = send(newSession(), "Help me choose");
  const message = "What is your returns policy?";
  const answer = send(first.session, message, plan(message, { action: "none", discovery_intent: null,
    answer: { kind: "policy", topics: ["returns"], references: [], purpose: null, continuation: false } }));
  assert.equal(answer.reply.status, "answered"); assert.deepEqual(answer.session.discovery, first.session.discovery);
  const cancelled = cancellationReply(makeTurn(first.session, "cancel"));
  assert.equal(cancelled.discovery.stage, "complete");
});
check("Broad discovery is an explicit search permission, never a global removal of search safeguards", () => {
  assert.equal(searchByPreferences(catalogue, emptyShoppingPreferences()).status, "needs_more_detail");
  assert.equal(searchByPreferences(catalogue, emptyShoppingPreferences(), { allowUnanchored: true }).status, "matches");
  assert.equal(TurnReplySchema.safeParse({ ...send(newSession(), "Help me choose").reply,
    suggested_replies: Array(4).fill({ label: "Choice", message: "Show me ideas" }) }).success, false);
});
check("Stylist prose removes em dashes, including model questions, without rewriting evidence", () => {
  const message = "I don't know what I want.";
  const turn = makeTurn(newSession(), message);
  const result = finishConversationTurn([], turn, { action: "clarify", intent_evidence: message,
    reference: null, changes: [], question: "Let's explore\u2014what feels right?", continuation: false }, vocabulary([]));
  assert.doesNotMatch(result.message, /\u2014/); assert.doesNotMatch(result.pending.question, /\u2014/);
  assert.equal(result.pending.goal, message);
  assert.doesNotMatch(send(newSession(), "Help me choose").reply.message, /\u2014/);
});

console.log(`\n${passed} guided-discovery checks passed.`);
