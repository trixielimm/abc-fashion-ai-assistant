import assert from "node:assert/strict";
import { newSession, makeTurn, acceptReply, snapshot } from "../lib/stylist/conversationProtocol.ts";
import { finishConversationTurn, shortcutPlan } from "../lib/stylist/conversationTurn.ts";
import { checkConversationPlan } from "../lib/stylist/conversationPlan.ts";
import { categoryCollectionDefault, requestedClothing } from "../lib/stylist/collectionPreference.ts";
import { ConversationStore } from "../lib/stylist/conversationStore.ts";
import { product } from "./fixtures/customer-scenarios.mjs";

const rows = ["Women", "Unisex"].flatMap(gender => ["Dresses", "Skirts"].flatMap(subcategory => [
  product(`${gender}-${subcategory}`, "Clothing", 150, { gender, subcategory: subcategory === "Skirts" ? "Bottoms" : subcategory, product_type: subcategory === "Dresses" ? "Midi Dress" : "Midi Skirt", occasion: "Work", style: "Formal" }),
  product(`${gender}-${subcategory}-cheaper`, "Clothing", 90, { gender, subcategory: subcategory === "Skirts" ? "Bottoms" : subcategory, product_type: subcategory === "Dresses" ? "Wrap Dress" : "Pleated Skirt", occasion: "Work", style: "Formal" }),
]));
rows.push(...["Men", "Women", "Unisex"].map(gender => product(`${gender}-shirt`, "Clothing", 120, {
  gender, subcategory: "Tops", product_type: "Dress Shirt", occasion: "Work", style: "Formal",
})));
rows.push(product("Women-trousers", "Clothing", 100, { gender: "Women", subcategory: "Bottoms", product_type: "Tailored Trousers", occasion: "Work" }));
const vocabulary = { rows, sizes: ["10", "12"], categories: [...new Map(rows.map(row => [row.subcategory, { category: row.category, subcategory: row.subcategory }])).values()] };
const change = (field, value, evidence, scope = "item") => ({ scope, field, value, evidence, operation: "set" });
const plan = (message, extra = {}) => ({ action: "new_search", intent_evidence: message.slice(0, 250), changes: [], reference: null, question: null, continuation: false, ...extra });
const visible = reply => [...reply.products, ...reply.alternatives];
function send(state, message, output = plan(message), catalogue = rows) {
  const turn = makeTurn(state, message);
  return acceptReply(turn, finishConversationTurn(catalogue, turn, output, vocabulary));
}
const text = "I want a dress for work under 200 aud";
const first = () => send(newSession(), text);
let passed = 0;
async function check(name, run) { await run(); passed++; console.log(`PASS: ${name}`); }

await check("The exact dress prompt searches Women immediately with Work and A$200", () => {
  const { reply, session } = first();
  assert.ok(visible(reply).length); assert.equal(reply.pending, null);
  assert.equal(reply.discovery?.stage === "collection", false);
  assert.equal(reply.applied_preferences.gender, "Women"); assert.equal(reply.applied_preferences.subcategory, "Dresses");
  assert.equal(reply.applied_preferences.occasion, "Work"); assert.equal(reply.applied_preferences.max_price, 200);
  assert.equal(session.collection.choice, null); assert.deepEqual(session.collection.current, { choice: "Women", source: "category_default" });
  assert.ok(visible(reply).every(p => ["Women", "Unisex"].includes(rows.find(row => row.product_id === p.product_id).gender)));
});
await check("Skirts have the same category default, including tentative choices", () => {
  for (const message of ["I want a skirt for work under 200 aud", "Maybe a skirt", "Show skirts", "Maybe a dress", "a dress", "I have no idea. Maybe a dress", "Something for everyday wear. Maybe a dress"]) {
    const { reply } = send(newSession(), message);
    assert.equal(reply.applied_preferences.gender, "Women", message); assert.ok(visible(reply).length, message);
    if (/skirt/i.test(message)) assert.ok(visible(reply).every(p => /skirt/i.test(p.product_type)), message);
  }
});
await check("A repeated complete request overrides ordinary Men's browsing without overwriting that preference", () => {
  const state = newSession(); state.collection.choice = "Men"; state.scopes.item.gender = "Men";
  Object.assign(state.scopes.item, { category: "Clothing", subcategory: "Dresses", occasion: "Work", max_price: 200 });
  const { reply, session } = send(state, text);
  assert.equal(reply.applied_preferences.gender, "Women"); assert.ok(visible(reply).length);
  assert.equal(session.collection.choice, "Men"); assert.match(reply.message, /women's dresses collection/);
});
await check("The exact legacy checkpoint, Men's no-match, repeated dress request recovers", () => {
  const state = newSession();
  state.collection = { choice: null, checkpoint: { action: "new_search", discovery_intent: null } };
  state.discovery = { stage: "collection", asked: ["collection"], skipped: [], seen_product_ids: [] };
  Object.assign(state.scopes.item, { category: "Clothing", subcategory: "Dresses", occasion: "Work", max_price: 200 });
  const turn = makeTurn(state, "Men's, please.");
  const withoutUnisex = rows.filter(row => row.gender !== "Unisex");
  const men = acceptReply(turn, finishConversationTurn(withoutUnisex, turn, shortcutPlan(turn), vocabulary));
  assert.equal(men.reply.status, "no_match"); assert.equal(men.reply.applied_preferences.gender, "Men");
  assert.match(men.reply.message, /men's dresses collection/); assert.equal(men.reply.suggested_replies.length, 2);
  men.session.history = [];
  const recovered = send(men.session, text, plan(text), withoutUnisex);
  assert.ok(visible(recovered.reply).length); assert.equal(recovered.reply.applied_preferences.gender, "Women");
  assert.equal(recovered.reply.applied_preferences.occasion, "Work"); assert.equal(recovered.reply.applied_preferences.max_price, 200);
});
await check("Explicit Men, Unisex and All beat category defaults", () => {
  for (const [collection, expected] of [["men's", "Men"], ["women's", "Women"], ["Unisex", "Unisex"], ["both collections of", null]]) {
    for (const item of ["dresses", "skirts"]) {
      const message = `Show ${collection} ${item} for work under 200 aud`;
      const { reply } = send(newSession(), message);
      assert.equal(reply.applied_preferences.gender, expected, message);
    }
  }
  const message = "Show dresses from both collections for work";
  assert.equal(send(newSession(), message).reply.applied_preferences.gender, null);
});
await check("Budget, more, more dresses and cheaper retain the current default after history eviction", () => {
  const state = first().session; state.history = []; state.collection.choice = "Men";
  for (const message of ["Under $180", "Show more", "Show more dresses", "Show other dresses"]) {
    const result = send(state, message, plan(message, { action: "refine" }));
    assert.equal(result.reply.applied_preferences.gender, "Women", message); assert.ok(visible(result.reply).length);
  }
  const cheaper = send(state, "Show cheaper options", plan("Show cheaper options", { action: "cheaper" }));
  assert.equal(cheaper.reply.applied_preferences.gender, "Women");
});
await check("More dresses and price edits also preserve an explicit men's dress request", () => {
  const state = send(newSession(), "Show men's dresses for work").session;
  for (const message of ["Under $180", "Show more dresses", "Show other dresses"]) {
    assert.equal(send(state, message, plan(message, { action: "refine" })).reply.applied_preferences.gender, "Men", message);
  }
});
await check("Defaults remain item-specific when switching to ambiguous clothing", () => {
  for (const saved of [null, "Men", "All"]) {
    const initial = newSession(); initial.collection.choice = saved;
    const state = send(initial, text).session;
    const message = "Show dress shirts for work";
    const result = send(state, message, plan(message, { changes: [change("subcategory", "Tops", "shirts"), change("product_type", "Dress Shirt", "dress shirts")] }));
    assert.equal(result.session.collection.choice, saved);
    assert.equal(result.session.scopes.item.subcategory, "Tops");
    if (!saved) { assert.equal(result.reply.discovery.stage, "collection"); assert.deepEqual(visible(result.reply), []); }
    else { assert.equal(result.reply.applied_preferences.gender, saved === "All" ? null : saved); assert.ok(visible(result.reply).length); }
  }
  const result = send(first().session, "Show clothing");
  assert.equal(result.reply.discovery.stage, "collection"); assert.equal(result.session.scopes.item.subcategory, null);
  const skirt = send(newSession(), "Show skirts").session;
  const trousersText = "Show trousers";
  const trousers = send(skirt, trousersText, plan(trousersText, { changes: [change("subcategory", "Bottoms", "trousers"), change("product_type", "Tailored Trousers", "trousers")] }));
  assert.equal(trousers.reply.discovery.stage, "collection"); assert.equal(trousers.session.scopes.item.gender, null);
});
await check("A dress-shirt brief retains its shirt family through the collection checkpoint even when the model omits it", () => {
  const message = "I want a dress shirt for work under A$200.";
  const first = send(newSession(), message, plan(message, { changes: [change("category", "Clothing", "dress shirt")] }));
  assert.equal(first.session.scopes.item.subcategory, "Tops");
  assert.equal(first.session.scopes.item.product_type, "Shirt");
  assert.equal(first.reply.discovery.stage, "collection");
  const turn = makeTurn(first.session, "Men's, please.");
  const reply = finishConversationTurn(rows, turn, shortcutPlan(turn), vocabulary);
  assert.equal(reply.applied_preferences.subcategory, "Tops");
  assert.ok(visible(reply).every(product => /shirt/i.test(product.product_type)));
});
await check("Ambiguous categories and dress compounds never default to Women", () => {
  for (const message of ["Show shirts", "Show suits", "Show trousers", "Show jackets", "Show dress shirts", "Show dress shoes", "Dress me for work", "Show dress code ideas", "I don't want a dress", "I don't want a red dress", "Not a skirt", "Show shoes to match my dress", "I need shoes for a dress", "I own a dress. Show shoes", "Is this dress washable?"]) {
    const target = requestedClothing(message);
    const preferences = { ...newSession().scopes.item, category: "Clothing", subcategory: "Dresses" };
    assert.equal(categoryCollectionDefault(message, preferences, false), null, message);
    assert.notEqual(target?.subcategory, "Dresses", message);
  }
  const message = "Show dress shirts for work";
  const result = send(newSession(), message, plan(message, { changes: [change("subcategory", "Tops", "shirts"), change("product_type", "Dress Shirt", "dress shirts")] }));
  assert.equal(result.session.scopes.item.subcategory, "Tops"); assert.equal(result.reply.discovery.stage, "collection");
});
await check("Broad formal clothing retains collection-first onboarding", () => {
  const result = send(newSession(), "Show formal clothes");
  assert.equal(result.reply.discovery.stage, "collection"); assert.equal(result.reply.suggested_replies.length, 3);
});
await check("Global Men's restrictions require clarification and cannot silently change", () => {
  const state = newSession(); state.scopes.shared.gender = "Men";
  const result = send(state, text);
  assert.equal(result.reply.status, "needs_clarification"); assert.deepEqual(visible(result.reply), []);
  assert.equal(result.session.scopes.shared.gender, "Men");
  assert.match(result.reply.message, /Dresses use the women's collection by default.*Men for all items.*change that shared/);
});
await check("Model category-default evidence is allowed only for the supported requested item", () => {
  assert.equal(send(newSession(), text, plan(text, { changes: [change("gender", "Women", "dress")] })).reply.applied_preferences.gender, "Women");
  assert.throws(() => checkConversationPlan(makeTurn(newSession(), text), plan(text, { changes: [change("gender", "Men", "dress")] })), /supported Dresses\/Skirts category default/);
  assert.throws(() => checkConversationPlan(makeTurn(newSession(), text), plan(text, { changes: [change("gender", "Women", "dress", "shared")] })), /shared collection rule/);
  for (const message of ["Show formal clothes", "Show clothing size 10", "Show shirts"]) {
    assert.throws(() => checkConversationPlan(makeTurn(newSession(), message), plan(message, { changes: [change("gender", "Women", message)] })), /supported Dresses\/Skirts/);
  }
});
await check("No matching stock stays no_match without widening the collection or budget", () => {
  const withoutWork = rows.filter(row => row.subcategory === "Tops");
  const result = send(newSession(), text, plan(text), withoutWork);
  assert.equal(result.reply.status, "no_match"); assert.deepEqual(visible(result.reply), []);
  assert.equal(result.session.scopes.item.max_price, 200); assert.equal(result.session.scopes.item.gender, "Women");
});
await check("Explicit men's no-match suggestions require a choice and preserve constraints", () => {
  const message = "Show men's skirts for work under 200 aud";
  const withoutUnisex = rows.filter(row => row.gender !== "Unisex");
  const result = send(newSession(), message, plan(message), withoutUnisex);
  assert.equal(result.reply.status, "no_match"); assert.equal(result.reply.applied_preferences.gender, "Men");
  const next = result.reply.suggested_replies.map(choice => send(result.session, choice.message, plan(choice.message), withoutUnisex));
  assert.equal(next[0].reply.applied_preferences.gender, "Women"); assert.equal(next[1].reply.applied_preferences.gender, null);
  assert.ok(next.every(item => visible(item.reply).length && item.reply.applied_preferences.max_price === 200 && item.reply.applied_preferences.occasion === "Work"));
});
await check("Product questions and external garment mentions do not change collection metadata", () => {
  const state = first().session; const message = "What material is the first dress?";
  const result = send(state, message, plan(message, { action: "none", answer: {
    kind: "product", topics: ["material"], references: [{ kind: "position", position: 1, subcategory: "Dresses" }], purpose: null, continuation: false,
  } }));
  assert.equal(result.reply.status, "answered"); assert.deepEqual(result.session.collection, state.collection);
  const owned = "I own a dress. Show shoes";
  assert.equal(categoryCollectionDefault(owned, state.scopes.item, false), null);
});
await check("Earlier sessions migrate, reset clears provenance, and page focus cannot inherit the previous default", () => {
  const state = newSession(); delete state.collection;
  state.scopes.item.gender = "Men";
  const result = send(state, text); assert.equal(result.reply.applied_preferences.gender, "Women"); assert.equal(result.session.collection.choice, "Men");
  assert.equal(newSession().collection.current, null);
  const focused = makeTurn(first().session, "What is this?", snapshot(rows.find(row => row.subcategory === "Tops")));
  assert.equal(focused.collection.current, null); assert.equal(focused.scopes.item.gender, null);
});
await check("Retry replay preserves the resolved default", async () => {
  const turn = makeTurn(newSession(), text); const store = new ConversationStore(); let executed = 0;
  const run = () => store.run("category-default", turn, false, async () => plan(text), async output => {
    executed++; return finishConversationTurn(rows, turn, output, vocabulary);
  });
  assert.deepEqual(await run(), await run()); assert.equal(executed, 1);
});
console.log(`\n${passed} category-collection default checks passed.`);
