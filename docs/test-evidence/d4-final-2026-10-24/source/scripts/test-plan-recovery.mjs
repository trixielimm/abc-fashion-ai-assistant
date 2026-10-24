import assert from "node:assert/strict";
import { zodTextFormat } from "openai/helpers/zod";
import { ModelPlanSchema } from "../lib/ai/conversationModelPlan.ts";
import {
  ConversationChangeSchema,
  ConversationPlanSchema,
  checkConversationPlan,
  generateValidatedConversationPlan,
} from "../lib/stylist/conversationPlan.ts";
import { newSession, makeTurn, acceptReply } from "../lib/stylist/conversationProtocol.ts";
import { finishConversationTurn, cancellationReply } from "../lib/stylist/conversationTurn.ts";
import { emptyShoppingPreferences } from "../lib/stylist/preferenceScope.ts";

// Real validation and turn handling, simulated model responses. No network.
const change = (field, value, evidence, operation = "set") => ({
  scope: "item", field, value, evidence, operation,
});
const plan = (message, changes) => ({
  action: "new_search", intent_evidence: message, reference: null,
  changes, question: null, continuation: false,
});
const emptyVocabulary = { rows: [], sizes: [], categories: [] };
let passed = 0;
async function check(name, test) {
  await test(); passed++; console.log(`PASS: ${name}`);
}

await check("The model schema binds list, number and enum values to their fields", () => {
  for (const invalid of [
    change("unresolved", "no leather", "no leather", "add"),
    change("unresolved", [], "no leather", "add"),
    change("unresolved", ["no leather"], "no leather", "set"),
    change("preferred_colours", "Blue", "blue"),
    change("max_price", "150", "$150"),
    change("category", "Footwear", "shoes"),
    change("category", ["Shoes"], "shoes"),
  ]) assert.equal(ConversationChangeSchema.safeParse(invalid).success, false);
  assert.equal(ConversationChangeSchema.safeParse(change("category", "Shoes", "shoes")).success, true);
  assert.equal(ConversationChangeSchema.safeParse(change("max_price", null, "no budget")).success, true);

  const schema = zodTextFormat(ModelPlanSchema, "shopping_turn_plan").schema;
  const transport = schema.properties.changes.items;
  assert.ok(transport.properties.field.enum.includes("preferred_colours"));
  assert.ok(transport.required.includes("text_value"));
  assert.ok(transport.required.includes("number_value"));
  assert.equal(transport.properties.list_values.type, "array");
});

await check("A malformed unresolved list can be corrected before an outfit request is executed", async () => {
  const message = "Build me a complete outfit with a dress, shoes and bag for $200 total.";
  const requirement = "a dress, shoes and bag for $200 total";
  const valid = { ...plan(message, []), outfit_request: { total_budget_aud: 200, evidence: message,
    items: [{ ...emptyShoppingPreferences(), category: "Clothing", subcategory: "Dresses" },
      { ...emptyShoppingPreferences(), category: "Shoes" }, { ...emptyShoppingPreferences(), category: "Bags" }] } };
  const malformed = plan(message, [change("unresolved", requirement, requirement, "add")]);
  let calls = 0;
  const result = await generateValidatedConversationPlan({ message }, async (_field, feedback) => {
    calls++;
    if (calls === 1) { assert.equal(feedback, null); return malformed; }
    assert.match(feedback, /changes\.0\.value/);
    return valid;
  });
  const checked = checkConversationPlan({ message }, result);
  assert.equal(calls, 2);
  assert.equal(checked.status, "ready_for_validation");
  assert.deepEqual(checked.proposed_scopes.unresolved_item, []);
  assert.equal(checked.proposed_scopes.item.max_price, null);
  assert.equal(checked.styling.outfit_request.total_budget_aud, 200);
  assert.equal(checked.styling.outfit_request.items.length, 3);
});

await check("No-leather requirements stay recorded and cannot retrieve unchecked products", async () => {
  const message = "Show me shoes for work under $150, but no leather.";
  const result = await generateValidatedConversationPlan({ message }, async () => plan(message, [
    change("category", "Shoes", "shoes"),
    change("occasion", "Work", "work"),
    change("max_price", 150, "under $150"),
    change("unresolved", ["no leather"], "no leather", "add"),
  ]));
  const reply = finishConversationTurn([], makeTurn(newSession(), message), result, emptyVocabulary);
  assert.equal(reply.status, "needs_clarification");
  assert.equal(reply.proposed_scopes.item.category, "Shoes");
  assert.equal(reply.proposed_scopes.item.material, null);
  assert.equal(reply.proposed_scopes.item.max_price, 150);
  assert.deepEqual(reply.proposed_scopes.unresolved_item, ["no leather"]);
  assert.deepEqual(reply.products, []);
});

await check("Invalid shoe categories get a correction and still obey cross-sell rules", async () => {
  const session = newSession();
  Object.assign(session.scopes.item, { category: "Clothing", subcategory: "Dresses", size: "10", max_price: 300 });
  session.context.latest = [1, 2].map(n => ({
    product_id: `D${n}`, product_name: `Dress ${n}`, category: "Clothing",
    subcategory: "Dresses", product_type: "Midi Dress", price_aud: 100,
  }));
  const message = "Find shoes to go with the second dress.";
  const turn = makeTurn(session, message);
  const valid = { ...plan(message, [change("category", "Shoes", "shoes")]),
    action: "cross_sell", reference: { kind: "position", position: 2, subcategory: "Dresses" } };
  let calls = 0;
  const result = await generateValidatedConversationPlan(turn, async (_field, feedback) => {
    if (++calls === 1) return { ...valid, changes: [change("category", "Footwear", "shoes")] };
    assert.match(feedback, /changes\.0\.value/);
    return valid;
  });
  const checked = checkConversationPlan(turn, result);
  assert.equal(calls, 2);
  assert.deepEqual(checked.reference_product_ids, ["D2"]);
  assert.equal(checked.preferences.category, "Shoes");
  assert.equal(checked.preferences.size, null);
  assert.equal(checked.preferences.max_price, null);

  const main = { ...session.context.latest[1], stock_qty: 1, is_available: true,
    sizes_available: ["10"], cross_sell_category: "Bags" };
  const reply = finishConversationTurn([main], turn, result, {
    rows: [], sizes: [], categories: [{ category: "Shoes", subcategory: null }, { category: "Bags", subcategory: null }],
  });
  assert.equal(reply.status, "no_match");
  assert.deepEqual(reply.products, []);
});

await check("Two invalid plans clarify without changing saved limits or selecting references", async () => {
  const session = newSession();
  Object.assign(session.scopes.item, { category: "Clothing", max_price: 50, size: "10" });
  session.scopes.shared.excluded_colours = ["Brown"];
  const before = structuredClone(session.scopes);
  const message = "Build me a complete outfit with a dress, shoes and bag for $200 total.";
  const turn = makeTurn(session, message);
  let calls = 0;
  const result = await generateValidatedConversationPlan(turn, async () => {
    calls++;
    return plan(message, [change("unresolved", message, message, "add")]);
  });
  const reply = finishConversationTurn([], turn, result, emptyVocabulary);
  assert.equal(calls, 2);
  assert.equal(result.action, "clarify");
  assert.equal(result.reference, null);
  assert.deepEqual(result.changes, []);
  assert.equal(reply.status, "needs_clarification");
  assert.deepEqual(reply.proposed_scopes, before);
  assert.deepEqual(session.scopes, before);
  assert.equal(reply.pending.goal, message);
  assert.match(reply.message, /couldn't reliably interpret that outfit request/);
  assert.deepEqual(reply.products, []);
  assert.deepEqual(reply.alternatives, []);

  const next = acceptReply(turn, reply).session;
  const cancelled = cancellationReply(makeTurn(next, "cancel"));
  assert.equal(cancelled.pending, null);
  assert.deepEqual(cancelled.proposed_scopes, before);
});

await check("Well-shaped plans cannot hide a material exclusion in a soft style or omit it", async () => {
  const message = "Show me shoes for work under $150, but no leather.";
  for (const changes of [
    [change("category", "Shoes", "shoes"), change("style", "no leather", "no leather")],
    [change("category", "Shoes", "shoes"), change("material", "Leather", "leather")],
    [change("category", "Shoes", "shoes")],
  ]) {
    const candidate = plan(message, changes);
    assert.equal(ConversationPlanSchema.safeParse(candidate).success, true);
    assert.throws(() => checkConversationPlan({ message }, candidate), /exclusion must remain an unresolved requirement/);
    const result = await generateValidatedConversationPlan({ message }, async () => candidate);
    const reply = finishConversationTurn([], makeTurn(newSession(), message), result, emptyVocabulary);
    assert.equal(reply.status, "needs_clarification");
    assert.deepEqual(reply.products, []);
    assert.deepEqual(reply.alternatives, []);
    assert.equal(reply.pending.goal, message);
    assert.match(reply.message, /verify leather-free products/);
  }
});

await check("A well-shaped outfit plan cannot silently reinterpret the total as a per-item limit", () => {
  const message = "Build me a complete outfit with a dress, shoes and bag for $200 total.";
  assert.throws(() => checkConversationPlan({ message }, plan(message, [
    change("category", "Clothing", "dress"),
    change("max_price", 200, "$200 total"),
  ])), /Use outfit_request/);
});

await check("Explicitly removing an unsupported requirement or switching to a single item still works", () => {
  const session = newSession();
  session.collection = { choice: "All", checkpoint: null };
  session.scopes.unresolved_item = ["no leather"];
  const message = "Remove my no leather restriction.";
  const result = checkConversationPlan(makeTurn(session, message), {
    ...plan(message, [change("unresolved", ["no leather"], "no leather", "remove")]), action: "refine",
  });
  assert.equal(result.status, "ready_for_validation");
  assert.deepEqual(result.proposed_scopes.unresolved_item, []);
  const unrelatedRemoval = "Remove blue, but keep no leather.";
  assert.throws(() => checkConversationPlan(makeTurn(session, unrelatedRemoval), {
    ...plan(unrelatedRemoval, [change("unresolved", ["no leather"], unrelatedRemoval, "remove")]), action: "refine",
  }), /exclusion must remain an unresolved requirement/);
  session.scopes.unresolved_item = ["a whole outfit for $200 total"];
  const replacement = "Forget the whole outfit. Just show me a dress.";
  const next = checkConversationPlan(makeTurn(session, replacement), plan(replacement, [
    change("category", "Clothing", "dress"), change("subcategory", "Dresses", "dress"),
  ]));
  assert.equal(next.status, "ready_for_validation");
  assert.deepEqual(next.proposed_scopes.unresolved_item, []);
});

await check("SDK parse errors and invalid JSON get the same bounded recovery", async () => {
  const message = "Show me shoes";
  const valid = plan(message, [change("category", "Shoes", "shoes")]);
  for (const fail of [
    () => ConversationPlanSchema.parse({ ...valid, changes: [change("category", "Footwear", "shoes")] }),
    () => { throw new SyntaxError("Invalid model JSON"); },
  ]) {
    let calls = 0;
    const result = await generateValidatedConversationPlan({ message }, async () => {
      if (++calls === 1) fail();
      return valid;
    });
    assert.equal(calls, 2);
    assert.equal(result.changes[0].value, "Shoes");
  }
});

await check("Invalid requests and unexpected application failures are not concealed", async () => {
  let calls = 0;
  await assert.rejects(generateValidatedConversationPlan({ message: "" }, async () => { calls++; }));
  assert.equal(calls, 0);
  const failure = new Error("Unexpected application failure");
  await assert.rejects(generateValidatedConversationPlan({ message: "Show shoes" }, async () => {
    calls++; throw failure;
  }), error => error === failure);
  assert.equal(calls, 1);
});

console.log(`\n${passed} plan-recovery checks passed.`);
