import assert from "node:assert/strict";
import { checkConversationPlan, generateValidatedConversationPlan } from "../lib/stylist/conversationPlan.ts";
import { acceptReply, makeTurn, newSession, snapshot, TurnReplySchema } from "../lib/stylist/conversationProtocol.ts";
import { cancellationReply, finishConversationTurn, resumesAnswerSearch, shortcutPlan } from "../lib/stylist/conversationTurn.ts";
import { resolveAnswerProducts } from "../lib/stylist/conversationAnswers.ts";
import { ConversationStore } from "../lib/stylist/conversationStore.ts";
import { DELIVERY_AND_RETURNS_COPY } from "../lib/storePolicies.ts";

// Synthetic authoritative records. No model, network or database calls.
const first = {
  product_id: "D1", product_name: "Lavender Wrap Dress", price_aud: 100,
  category: "Clothing", subcategory: "Dresses", product_type: "Wrap Dress",
  colour: "Lavender", style: "Formal", occasion: "BeachWedding", gender: null,
  brand_line: null, material: "Cotton", fit: "Regular", season: "Summer",
  sizes_available: ["10", "12"], stock_qty: 5, is_available: true,
  description: null, tags: [], image_key: null, cross_sell_category: "Bags",
};
const second = { ...first, product_id: "D2", product_name: "Blue Dinner Dress", price_aud: 80, colour: "Blue", occasion: "Dinner", material: null, fit: null };
const cheaper = { ...first, product_id: "D3", product_name: "Less Expensive Wrap Dress", price_aud: 60 };
const bag = { ...first, product_id: "B1", product_name: "Clutch Bag", price_aud: 40, category: "Bags", subcategory: "Clutches", product_type: "Clutch", sizes_available: ["One Size"], cross_sell_category: null };
const rows = [first, second, cheaper, bag];
const vocabulary = { rows, sizes: ["10", "12", "One Size"], categories: [{ category: "Clothing", subcategory: null }, { category: "Clothing", subcategory: "Dresses" }, { category: "Bags", subcategory: null }, { category: "Bags", subcategory: "Clutches" }] };
const pos = position => ({ kind: "position", position, subcategory: "Dresses" });
const intent = (topics, references = [pos(1)], extra = {}) => ({ kind: "product", topics, references, purpose: null, continuation: false, ...extra });
const policy = topics => intent(topics, [], { kind: "policy" });
const plan = (message, answer = null, extra = {}) => ({ action: "none", intent_evidence: message.slice(0, 250), reference: null, changes: [], question: null, continuation: false, answer, ...extra });
function session() {
  const result = newSession();
  result.context.latest = [snapshot(first), snapshot(second)];
  Object.assign(result.scopes.item, { category: "Clothing", subcategory: "Dresses", max_price: 120, size: "10", preferred_colours: ["Lavender"] });
  return result;
}
const finish = (turn, answer, catalogue = rows, extra = {}) => finishConversationTurn(catalogue, turn, plan(turn.message, answer, extra), vocabulary);
let passed = 0;
async function check(name, test) { await test(); passed++; console.log(`PASS: ${name}`); }

await check("Recommendation answers identify the requested product and factual occasion match", () => {
  const turn = makeTurn(session(), "Why this dress for a beach wedding?");
  const reply = finish(turn, intent(["recommendation"], [pos(1)], { purpose: "beach wedding" }));
  assert.equal(reply.status, "answered");
  assert.match(reply.message, /explicitly lists Beach Wedding/);
  assert.match(reply.message, /A\$100.00.*A\$120.00/);
  assert.match(reply.message, /colour also matches/);
  assert.deepEqual(reply.answer_product_ids, ["D1"]);
  assert.deepEqual(reply.answer_sources, [{ label: "Lavender Wrap Dress: catalogue details", url: "/products/D1" }]);
  assert.deepEqual(reply.products, []);
  assert.deepEqual(reply.proposed_scopes, turn.scopes);
});

await check("An occasion mismatch and a stale budget are disclosed", () => {
  const state = session(); state.scopes.shared.max_price = 50;
  const turn = makeTurn(state, "Why the second dress for a beach wedding?");
  const reply = finish(turn, intent(["recommendation"], [pos(2)], { purpose: "beach wedding" }));
  assert.match(reply.message, /occasion match is uncertain/);
  assert.match(reply.message, /catalogue lists Dinner/);
  assert.match(reply.message, /exceeds your saved A\$50.00/);
});

await check("Questions preserve shortlist order, preferences and input immutability", () => {
  const turn = makeTurn(session(), "What is the second dress made of?");
  const before = structuredClone(turn);
  const reply = finish(turn, intent(["material"], [pos(2)]));
  const accepted = acceptReply(turn, reply).session;
  assert.match(reply.message, /material isn't recorded/);
  assert.deepEqual(accepted.context.latest, before.context.latest);
  assert.equal(accepted.context.focused.product_id, "D2");
  assert.deepEqual(accepted.scopes, before.scopes);
  assert.deepEqual(turn, before);
});

await check("A subsequent matching-bag request resolves it to the discussed dress", () => {
  const turn = makeTurn(session(), "Why the second dress?");
  const state = acceptReply(turn, finish(turn, intent(["recommendation"], [pos(2)]))).session;
  const next = makeTurn(state, "Find a bag to match it");
  const shopping = plan(next.message, null, { action: "cross_sell", reference: { kind: "context" }, changes: [{ scope: "item", field: "category", operation: "set", value: "Bags", evidence: "bag" }] });
  assert.deepEqual(checkConversationPlan(next, shopping).reference_product_ids, ["D2"]);
  const reply = finishConversationTurn(rows, next, shopping, vocabulary);
  assert.equal(reply.status, "matches");
  assert.equal(reply.products[0].product_id, "B1");
});

await check("Comparisons use both authoritative records and a real price difference", () => {
  const turn = makeTurn(session(), "Compare the first and second dresses");
  const reply = finish(turn, intent(["general", "price", "material"], [pos(1), pos(2)], { kind: "compare" }));
  assert.match(reply.message, /Lavender Wrap Dress/);
  assert.match(reply.message, /Blue Dinner Dress/);
  assert.match(reply.message, /costs A\$20.00 less/);
  assert.match(reply.message, /material isn't recorded/);
  assert.equal(reply.answer_sources.length, 2);
  const focused = makeTurn(session(), turn.message, snapshot(first));
  assert.equal(acceptReply(focused, reply).session.context.focused, null);
});

await check("Duplicate comparison references clarify instead of comparing one product to itself", () => {
  const turn = makeTurn(session(), "Compare these");
  const reply = finish(turn, intent(["general"], [pos(1), pos(1)], { kind: "compare" }));
  assert.match(reply.message, /Which two products/);
  assert.ok(reply.pending_answer);
  assert.deepEqual(reply.answer_sources, []);
});

await check("Friday delivery answers use shared policy without inventing an ETA", () => {
  const turn = makeTurn(session(), "Can this arrive by Friday?");
  const reply = finish(turn, policy(["delivery"]), []);
  assert.equal(reply.status, "answered");
  assert.match(reply.message, /Standard delivery is available across Australia/);
  assert.match(reply.message, /can't confirm arrival by Friday/);
  assert.match(reply.message, /don't have live delivery estimates/);
  assert.deepEqual(reply.products, []);
  assert.deepEqual(resolveAnswerProducts(turn, policy(["delivery"])).ids, []);
  assert.deepEqual(acceptReply(turn, reply).session.context, turn.context);
});

await check("Returns preserve published limits and do not promise eligibility or free postage", () => {
  const turn = makeTurn(newSession(), "Can I return it and is return postage free?");
  const reply = finish(turn, policy(["returns"]), []);
  assert.ok(DELIVERY_AND_RETURNS_COPY.includes("30 days"));
  assert.match(reply.message, /30 days of delivery/);
  assert.match(reply.message, /doesn't specify item eligibility, return postage/);
  assert.deepEqual(reply.answer_sources, []);
});

await check("Fit, sizes, care and quality answers acknowledge missing evidence", () => {
  const turn = makeTurn(session(), "Will it fit me, is it breathable, and can I machine wash it?");
  const reply = finish(turn, intent(["fit", "sizes", "care", "quality"]));
  assert.match(reply.message, /recorded fit is Regular/);
  assert.match(reply.message, /Recorded sizes: 10, 12/);
  assert.match(reply.message, /don't have garment measurements/);
  assert.match(reply.message, /don't have verified washing or care/);
  assert.match(reply.message, /doesn't verify comfort, breathability/);
});

await check("Unknown product questions are answered with their information limit", () => {
  const turn = makeTurn(session(), "Does it have pockets?");
  assert.match(finish(turn, intent(["general"])).message, /don't have verified catalogue information that answers that specific question/);
});

await check("Unavailable and unknown stock are differentiated, and stock is never reserved", () => {
  const turn = makeTurn(session(), "Is the first dress available?");
  assert.match(finish(turn, intent(["availability"])).message, /Stock isn't reserved/);
  assert.match(finish(turn, intent(["availability"]), [{ ...first, is_available: false, stock_qty: 0 }]).message, /unavailable/);
  assert.match(finish(turn, intent(["availability"]), [{ ...first, is_available: null, stock_qty: null }]).message, /can't confirm availability/);
});

await check("Missing or changed products cannot produce stale factual answers", () => {
  const turn = makeTurn(session(), "What does the first dress cost?");
  for (const catalogue of [[], [{ ...first, product_name: "Changed Name" }], [{ ...first, category: "Bags" }]]) {
    const reply = finish(turn, intent(["price"]), catalogue);
    assert.match(reply.message, /can't verify that product/);
    assert.deepEqual(reply.answer_sources, []);
    assert.deepEqual(reply.answer_product_ids, []);
  }
});

await check("A forged product snapshot price cannot affect the answer", () => {
  const turn = makeTurn(session(), "What is the price of the first dress?");
  turn.context.latest[0].price_aud = 1;
  const reply = finish(turn, intent(["price"]));
  assert.match(reply.message, /A\$100.00/);
  assert.doesNotMatch(reply.message, /A\$1.00/);
});

await check("Ambiguous questions retain the original goal and accept a short reference answer", () => {
  const turn = makeTurn(session(), "What is this made of?");
  const reply = finish(turn, intent(["material"], [{ kind: "context" }]));
  assert.match(reply.message, /Which item/);
  const state = acceptReply(turn, reply).session;
  assert.equal(state.pending_answer.question, turn.message);
  const next = makeTurn(state, "The first dress");
  const result = finish(next, intent(["material"], [pos(1)], { continuation: true }));
  assert.match(result.message, /recorded material is Cotton/);
  assert.equal(result.pending_answer, null);
});

await check("A policy interjection preserves a pending product question", () => {
  const turn = makeTurn(session(), "What is this made of?");
  const reply = finish(turn, intent(["material"], [{ kind: "context" }]));
  const state = acceptReply(turn, reply).session;
  const next = makeTurn(state, "Can this arrive by Friday?");
  const result = finish(next, policy(["delivery"]), []);
  // A new question must not quietly discard the unresolved product question.
  assert.deepEqual(result.pending_answer, state.pending_answer);
});

await check("Policy and product questions do not consume a pending shopping clarification", () => {
  const state = session();
  state.pending = { action: "cross_sell", reference: null, goal: "Find a bag for that dress", question: "Which dress?", before_scopes: structuredClone(state.scopes) };
  for (const answer of [policy(["returns"]), intent(["price"])]) {
    const turn = makeTurn(state, "Can you answer my question?");
    const reply = finish(turn, answer);
    assert.deepEqual(reply.pending, state.pending);
    assert.deepEqual(acceptReply(turn, reply).session.scopes, state.scopes);
  }
});

await check("Cancelling an answer clarification preserves the unfinished search", () => {
  const state = session();
  state.pending = { action: "cross_sell", reference: null, goal: "Find a bag", question: "Which dress?", before_scopes: structuredClone(state.scopes) };
  const turn = makeTurn(state, "What is this made of?");
  const next = acceptReply(turn, finish(turn, intent(["material"], [{ kind: "context" }]))).session;
  const cancelled = cancellationReply(makeTurn(next, "cancel"));
  assert.equal(cancelled.pending_answer, null);
  assert.deepEqual(cancelled.pending, state.pending);
});

await check("Mixed explanation and cheaper search performs both with the explicit reference", () => {
  const turn = makeTurn(session(), "Why the first dress, and show me a cheaper option?");
  const reply = finish(turn, intent(["recommendation"]), rows, { action: "cheaper", reference: pos(1) });
  assert.match(reply.message, /Lavender Wrap Dress/);
  assert.equal(reply.status, "matches");
  assert.ok(reply.products.every(product => product.price_aud < 100));
  assert.ok(reply.answer_sources.some(source => source.url === "/products/D1"));
});

await check("Ambiguous mixed requests resume both the answer and saved shopping action", () => {
  const turn = makeTurn(session(), "Why this dress, and show me a cheaper option?");
  const reply = finish(turn, intent(["recommendation"], [{ kind: "context" }]), rows, { action: "cheaper", reference: { kind: "context" } });
  assert.equal(reply.status, "answered");
  assert.deepEqual(reply.products, []);
  assert.equal(reply.pending_answer.follow_up.action, "cheaper");
  const next = makeTurn(acceptReply(turn, reply).session, "The first dress");
  const continued = intent(["recommendation"], [pos(1)], { continuation: true });
  assert.equal(resumesAnswerSearch(next, plan(next.message, continued)), true);
  const result = finish(next, continued);
  assert.match(result.message, /Lavender Wrap Dress/);
  assert.equal(result.status, "matches");
  assert.ok(result.products.every(product => product.price_aud < 100));
  assert.equal(result.pending_answer, null);
});

await check("Resolving an explanation does not replace a separately specified cheaper reference", () => {
  const turn = makeTurn(session(), "Why this dress, and find something cheaper than the second dress?");
  const reply = finish(turn, intent(["recommendation"], [{ kind: "context" }]), rows, { action: "cheaper", reference: pos(2) });
  const next = makeTurn(acceptReply(turn, reply).session, "The first dress");
  const result = finish(next, intent(["recommendation"], [pos(1)], { continuation: true }));
  assert.equal(result.action, "cheaper");
  assert.match(result.message, /Lavender Wrap Dress/);
  assert.ok(result.products.every(product => product.price_aud < second.price_aud));
});

await check("A new ambiguous question does not inherit a previous mixed shopping action", () => {
  const turn = makeTurn(session(), "Why this dress, and show me a cheaper option?");
  const reply = finish(turn, intent(["recommendation"], [{ kind: "context" }]), rows, { action: "cheaper", reference: { kind: "context" } });
  const next = makeTurn(acceptReply(turn, reply).session, "What is this made of?");
  const result = finish(next, intent(["material"], [{ kind: "context" }]));
  assert.equal(result.pending_answer.follow_up, null);
});

await check("Simple clarification selections resolve deterministically without losing the saved question", () => {
  const turn = makeTurn(session(), "Why this dress, and show me a cheaper option?");
  const reply = finish(turn, intent(["recommendation"], [{ kind: "context" }]), rows, { action: "cheaper", reference: { kind: "context" } });
  const state = acceptReply(turn, reply).session;
  for (const message of ["The first dress", "first", "1", first.product_name, first.product_id]) {
    const next = makeTurn(state, message);
    const selection = shortcutPlan(next);
    assert.ok(selection);
    const result = finishConversationTurn(rows, next, selection, vocabulary);
    assert.equal(result.action, "cheaper");
    assert.match(result.message, /Lavender Wrap Dress/);
  }
  assert.equal(shortcutPlan(makeTurn(state, "The first dress, and remove my budget")), null);
});

await check("Malformed question continuations retain the original question and mixed action", async () => {
  const turn = makeTurn(session(), "Why this dress, and show me a cheaper option?");
  const reply = finish(turn, intent(["recommendation"], [{ kind: "context" }]), rows, { action: "cheaper", reference: { kind: "context" } });
  const next = makeTurn(acceptReply(turn, reply).session, "that one please");
  const fallback = await generateValidatedConversationPlan(next, async () => ({}));
  const result = finishConversationTurn(rows, next, fallback, vocabulary);
  assert.equal(result.status, "answered");
  assert.equal(result.pending_answer.question, turn.message);
  assert.equal(result.pending_answer.follow_up.action, "cheaper");
  assert.deepEqual(result.proposed_scopes, next.scopes);
});

await check("A policy question combined with an explicit search supersedes an old product clarification", () => {
  const turn = makeTurn(session(), "What is this made of?");
  const initial = finish(turn, intent(["material"], [{ kind: "context" }]));
  const next = makeTurn(acceptReply(turn, initial).session, "Can this arrive by Friday, and show me bags?");
  const result = finish(next, policy(["delivery"]), rows, {
    action: "new_search", changes: [{ scope: "item", field: "category", operation: "set", value: "Bags", evidence: "bags" }],
  });
  assert.equal(result.status, "matches");
  assert.match(result.message, /can't confirm arrival by Friday/);
  assert.equal(result.products[0].product_id, "B1");
  assert.equal(result.pending_answer, null);
});

await check("An answer cannot sneak in preferences, a forged purpose or change the pending question", () => {
  const turn = makeTurn(session(), "Why the first dress?");
  assert.throws(() => finish(turn, intent(["recommendation"], [pos(1)], { purpose: "beach wedding" })), /purpose must be quoted/);
  assert.throws(() => finish(turn, intent(["price"], [pos(1)], { continuation: true })), /requires a pending product question/);
  const reply = finish(turn, intent(["recommendation"]));
  const forged = structuredClone(reply); forged.proposed_scopes.item.max_price = 999;
  assert.throws(() => acceptReply(turn, forged), /cannot change saved/);
  assert.throws(() => TurnReplySchema.parse({ ...reply, action: "refine" }));
  assert.throws(() => TurnReplySchema.parse({ ...reply, answer_sources: [{ label: "Fake", url: "https://example.com" }] }));
});

await check("Pure questions cannot save their occasion as a preference and get actionable correction feedback", async () => {
  const turn = makeTurn(session(), "Why the first dress for a beach wedding?");
  const answer = intent(["recommendation"], [pos(1)], { purpose: "beach wedding" });
  let calls = 0;
  const output = await generateValidatedConversationPlan(turn, async (_field, feedback) => {
    if (++calls === 1) return plan(turn.message, answer, { changes: [{ scope: "item", field: "occasion", operation: "set", value: "Beach Wedding", evidence: "beach wedding" }] });
    assert.match(feedback, /changes=\[\]/);
    return plan(turn.message, answer);
  });
  const reply = finishConversationTurn(rows, turn, output, vocabulary);
  assert.equal(calls, 2);
  assert.equal(reply.status, "answered");
  assert.equal(reply.proposed_scopes.item.occasion, null);
});

await check("Answer retries reuse interpretation and duplicate requests reuse the same answer", async () => {
  const store = new ConversationStore(); let interpretations = 0; let executions = 0;
  const turn = makeTurn(session(), "What does the first dress cost?");
  const interpret = async () => { interpretations++; return plan(turn.message, intent(["price"])); };
  const execute = async value => { if (++executions === 1) throw new Error("Simulated catalogue outage"); return finishConversationTurn(rows, turn, value, vocabulary); };
  await assert.rejects(store.run("answer", turn, false, interpret, execute));
  const reply = await store.run("answer", turn, true, interpret, execute);
  assert.deepEqual(await store.run("answer", turn, false, interpret, execute), reply);
  assert.equal(interpretations, 1); assert.equal(executions, 2);
});


console.log(`\n${passed} conversation-answer checks passed.`);
