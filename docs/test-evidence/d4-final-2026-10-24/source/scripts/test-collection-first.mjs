import assert from "node:assert/strict";
import { newSession, makeTurn, acceptReply } from "../lib/stylist/conversationProtocol.ts";
import { checkConversationPlan } from "../lib/stylist/conversationPlan.ts";
import { finishConversationTurn, shortcutPlan, cancellationReply } from "../lib/stylist/conversationTurn.ts";
import { executeConversationSearch } from "../lib/stylist/conversationSearch.ts";
import { product } from "./fixtures/customer-scenarios.mjs";
import { ConversationStore } from "../lib/stylist/conversationStore.ts";

const rows = ["Men", "Women", "Unisex"].flatMap(gender => [
  product(`${gender}-formal`, "Clothing", 90, { gender, occasion: "Formal", style: "Formal" }),
  product(`${gender}-red`, "Clothing", 80, { gender, occasion: "Formal", colour: "Red", style: "Formal" }),
  product(`${gender}-casual`, "Clothing", 70, { gender, occasion: "Casual" }),
  product(`${gender}-blue`, "Clothing", 70, { gender, occasion: "Casual", colour: "Blue" }),
]);
const vocabulary = { rows, sizes: ["10", "12"], categories: [{ category: "Clothing", subcategory: "Dresses" }] };
const visible = reply => [...reply.products, ...reply.alternatives];
const plan = (message, extra = {}) => ({ action: "new_search", intent_evidence: message.slice(0, 250),
  changes: [], reference: null, question: null, continuation: false, ...extra });
const change = (field, value, evidence, scope = "item") => ({ scope, field, value, evidence, operation: "set" });
function send(state, message, output) {
  const turn = makeTurn(state, message);
  const chosen = output ?? shortcutPlan(turn);
  assert.ok(chosen, `Missing exact-answer shortcut: ${message}`);
  return acceptReply(turn, finishConversationTurn(rows, turn, chosen, vocabulary));
}
const example = "I dont know what I want, can you show me some formal clothes";
const start = () => send(newSession(), example, plan(example));
let passed = 0;
async function check(name, run) { await run(); passed++; console.log(`PASS: ${name}`); }

await check("The exact request asks collection first and saves the full clothing brief", () => {
  const { reply, session } = start();
  assert.equal(reply.status, "no_action"); assert.deepEqual(visible(reply), []);
  assert.equal(reply.pending, null); assert.equal(reply.suggested_replies.length, 3);
  assert.match(reply.message, /men's clothing, women's clothing, or both\?/);
  assert.equal(session.scopes.item.category, "Clothing"); assert.equal(session.scopes.item.occasion, "Formal");
  assert.deepEqual(session.discovery.asked, ["collection"]); assert.ok(session.collection.checkpoint);
});
await check("Every button resumes formal clothing and applies its own collection rules", () => {
  for (const [index, choice] of ["Men", "Women", "All"].entries()) {
    const first = start(); const next = send(first.session, first.reply.suggested_replies[index].message);
    assert.ok(visible(next.reply).length); assert.equal(next.session.collection.choice, choice);
    assert.equal(next.session.collection.checkpoint, null); assert.equal(next.reply.applied_preferences.occasion, "Formal");
    assert.equal(next.reply.applied_preferences.category, "Clothing");
    assert.equal(next.reply.applied_preferences.gender, choice === "All" ? null : choice);
    assert.ok(visible(next.reply).every(p => rows.find(row => row.product_id === p.product_id).occasion === "Formal"));
    if (choice !== "All") assert.ok(visible(next.reply).every(p => [choice, "Unisex"].includes(rows.find(row => row.product_id === p.product_id).gender)));
  }
});
await check("Typed choices, apostrophes and explicit Unisex work", () => {
  for (const [text, expected] of [["men", "Men"], ["women’s", "Women"], ["Unisex", "Unisex"], ["either", "All"], ["no preference", "All"], ["Both / no preference", "All"]]) {
    const first = start();
    const next = send(first.session, text);
    assert.equal(next.session.collection.choice, expected); assert.ok(visible(next.reply).length);
    if (expected === "Unisex") assert.ok(visible(next.reply).every(p => p.product_id.startsWith("Unisex-")));
  }
});
await check("Explicit collections in an initial request bypass the question", () => {
  for (const collection of ["men's", "women's", "Unisex", "both collections of"]) {
    const text = `Show me ${collection} formal clothing`;
    const result = send(newSession(), text, plan(text));
    assert.notEqual(result.reply.discovery?.stage, "collection"); assert.ok(visible(result.reply).length);
  }
});
await check("A compound answer retains the old brief and all new restrictions", () => {
  const state = newSession(); state.scopes.item.excluded_colours = ["Blue"];
  const first = send(state, example, plan(example, { action: "refine" }));
  const text = "Women's, under $100, no red";
  const next = send(first.session, text, plan(text, { changes: [
    change("max_price", 100, "under $100"),
    { ...change("excluded_colours", ["Red"], "no red"), operation: "add" },
  ] }));
  assert.equal(next.reply.applied_preferences.occasion, "Formal");
  assert.equal(next.reply.applied_preferences.max_price, 100);
  assert.deepEqual(next.reply.applied_preferences.excluded_colours, ["Blue", "Red"]);
  assert.ok(visible(next.reply).length); assert.ok(visible(next.reply).every(p => p.colour !== "Red"));
});
await check("Both with a new budget is unrestricted browsing, not an unanswered collection", () => {
  const first = start(); const text = "Both, under $100";
  const next = send(first.session, text, plan(text, { changes: [change("max_price", 100, "under $100")] }));
  assert.equal(next.session.collection.choice, "All"); assert.equal(next.reply.applied_preferences.gender, null);
  assert.equal(next.reply.applied_preferences.max_price, 100); assert.ok(visible(next.reply).length);
});
await check("An owned garment's collection and personal identity do not filter the requested clothes", () => {
  for (const text of ["I am female. Show me formal clothes", "My wife wears women's clothing. Show me formal clothes"]) {
    const result = send(newSession(), text, plan(text));
    assert.equal(result.session.collection.choice, null); assert.equal(result.reply.discovery.stage, "collection");
  }
  const text = "Show women's clothing to go with my men's jacket";
  const result = send(newSession(), text, plan(text));
  assert.equal(result.reply.applied_preferences.gender, "Women");
});
await check("Pure uncertainty asks collection, then at most one more discovery question", () => {
  const first = send(newSession(), "Help me choose");
  assert.equal(first.session.discovery.stage, "collection");
  const second = send(first.session, "Women's");
  assert.equal(second.session.discovery.stage, "direction");
  assert.deepEqual(second.session.discovery.asked, ["collection", "direction"]);
  const third = send(second.session, "Something for everyday wear.");
  assert.ok(visible(third.reply).length); assert.equal(third.reply.applied_preferences.occasion, "Casual");
  assert.equal(third.session.discovery.asked.length, 2);
});
await check("Skipping or repeated uncertainty browses across collections without looping", () => {
  for (const text of ["Skip this question", "Just show me ideas", "I'm still not sure.", "I don't know", "I don't know what I want", "I have no idea what I want", "Help me choose", "I don't mind", "Surprise me"]) {
    const first = send(newSession(), "Help me choose");
    const next = send(first.session, text);
    assert.equal(next.session.collection.choice, "All", text); assert.ok(visible(next.reply).length, text);
    assert.equal(next.session.collection.checkpoint, null);
  }
});
await check("A deterministic dress shortcut uses the category default and keeps its feature requirement", () => {
  const text = "Show me dresses with pockets";
  const state = newSession(); const turn = makeTurn(state, text); const output = shortcutPlan(turn);
  assert.ok(output); assert.equal(checkConversationPlan(turn, output).status, "ready_for_validation");
  assert.deepEqual(executeConversationSearch(rows, turn, output, vocabulary).products, []);
  const reply = finishConversationTurn(rows, turn, output, vocabulary);
  assert.equal(reply.applied_preferences.gender, "Women"); assert.ok(reply.styling.required_features.includes("pockets"));
});
await check("Guessing collection from formal, a name, or a size is rejected", () => {
  for (const text of [example, "I'm Alex, show formal clothing", "Show clothing size 10"]) {
    assert.throws(() => checkConversationPlan(makeTurn(newSession(), text), plan(text, {
      changes: [change("gender", "Women", text.includes("formal") ? "formal" : "size 10")],
    })), /explicit collection request/);
  }
});
await check("Collection survives history eviction and a different clothing category", () => {
  const first = start(); const state = send(first.session, "Men").session;
  state.history = [];
  const text = "Find clothing";
  const next = send(state, text, plan(text, { changes: [change("category", "Clothing", "clothing")] }));
  assert.equal(next.reply.applied_preferences.gender, "Men"); assert.ok(visible(next.reply).length);
  const switchText = "Find women's clothing";
  const switched = send(next.session, switchText, plan(switchText));
  assert.equal(switched.reply.applied_preferences.gender, "Women");
  assert.equal(newSession().collection.choice, null);
});
await check("A confirmed choice in an older session is retained across a new search", () => {
  const state = newSession(); delete state.collection; state.scopes.item.gender = "Men";
  const text = "Show clothing";
  const next = send(state, text, plan(text));
  assert.equal(next.reply.applied_preferences.gender, "Men"); assert.equal(next.session.collection.choice, "Men");
});
await check("Shared collection restrictions still block a conflicting choice", () => {
  const state = newSession(); state.scopes.shared.gender = "Women";
  const text = "Show men's formal clothing";
  const result = send(state, text, plan(text));
  assert.equal(result.reply.status, "needs_clarification"); assert.deepEqual(visible(result.reply), []);
  assert.equal(result.session.scopes.shared.gender, "Women");
  assert.throws(() => send(state, text, plan(text, { changes: [change("gender", "Men", "men's", "shared")] })), /shared collection rule/);
});
await check("Greetings and policy answers preserve a checkpoint without interrogating the shopper", () => {
  const first = start();
  const greeting = send(first.session, "Hi", plan("Hi", { action: "none" }));
  assert.match(greeting.reply.message, /Hi!/); assert.equal(greeting.reply.suggested_replies.length, 0);
  assert.deepEqual(greeting.session.collection, first.session.collection);
  const text = "What is the returns policy?";
  const answer = send(first.session, text, plan(text, { action: "none", answer: {
    kind: "policy", topics: ["returns"], references: [], purpose: null, continuation: false,
  } }));
  assert.equal(answer.reply.status, "answered"); assert.deepEqual(answer.session.collection, first.session.collection);
});
await check("Cancelling clears the suspended clothing request", () => {
  const first = start(); const turn = makeTurn(first.session, "Cancel");
  const result = acceptReply(turn, cancellationReply(turn));
  assert.equal(result.session.collection.checkpoint, null); assert.equal(result.session.discovery.stage, "complete");
});
await check("A genuinely different bag request clears the old collection checkpoint", () => {
  const first = start(); const text = "Forget clothing. Show bags";
  const next = send(first.session, text, plan(text, { changes: [change("category", "Bags", "bags")] }));
  assert.equal(next.session.collection.checkpoint, null);
  assert.equal(next.session.scopes.item.category, "Bags");
});
await check("Retry replay returns the same checkpoint and rejects altered content", async () => {
  const turn = makeTurn(newSession(), example); const output = plan(example); const store = new ConversationStore();
  let executions = 0;
  const run = () => store.run("collection-retry", turn, false, async () => output, async chosen => {
    executions++; return finishConversationTurn([], turn, chosen, { rows: [], sizes: [], categories: [] });
  });
  const first = await run(); const second = await run();
  assert.deepEqual(first, second); assert.equal(executions, 1);
  await assert.rejects(store.run("collection-retry", { ...turn, message: "Different" }, true, async () => output, async () => first));
});
console.log(`\n${passed} collection-first checks passed.`);
