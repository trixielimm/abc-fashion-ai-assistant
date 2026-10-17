import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { acceptReply, makeTurn, newSession } from "../lib/stylist/conversationProtocol.ts";

// Explicit live test: calls the local development API, real model and catalogue.
// Usage: node --import tsx scripts/test-conversation-answers-live.mjs http://localhost:3000
const base = new URL(process.argv[2] ?? "http://localhost:3000");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Use a local development server.");
const started = new Date().toISOString();
const evidence = { started, base: base.origin, checks: [] };
let passed = 0;
async function send(state, message, verify) {
  const turn = makeTurn(state, message);
  const began = Date.now();
  const response = await fetch(new URL("/api/conversation-search", base), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request_id: randomUUID(), retry: false, turn }),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await response.json();
  const record = { message, http: response.status, elapsed_ms: Date.now() - began, reply: body };
  evidence.checks.push(record);
  assert.equal(response.status, 200, `${message}: ${JSON.stringify(body)}`);
  const accepted = acceptReply(turn, body);
  try { verify?.(accepted.reply, accepted.session, turn); }
  catch (error) { record.failure = error.message; throw error; }
  record.pass = true; passed++;
  console.log(`PASS (${record.elapsed_ms}ms): ${message} → ${accepted.reply.status}`);
  return accepted.session;
}
function answered(reply, state, turn) {
  assert.equal(reply.status, "answered");
  assert.deepEqual(reply.products, []);
  assert.deepEqual(state.scopes, turn.scopes);
  assert.deepEqual(state.context.latest, turn.context.latest);
  assert.doesNotMatch(reply.message, /Tell me what you'd like to find/);
}
let failed = 0;
async function scenario(name, run) {
  if (process.env.LIVE_SCENARIO && !new RegExp(process.env.LIVE_SCENARIO, "i").test(name)) return;
  try { await run(); }
  catch (error) { failed++; console.error(`FAIL: ${name}: ${error.message}`); }
}

try {
  const seed = await send(newSession(), "Show me dresses under $150", reply => {
    assert.ok(reply.products.length >= 2, "Need at least two live dresses for reference tests.");
  });
  await scenario("Explanation, delivery interjection, material and matching bag", async () => {
    let state = await send(structuredClone(seed), "Why would you recommend the second dress for a beach wedding?", (reply, next, turn) => {
      answered(reply, next, turn);
      assert.match(reply.message, /beach wedding/i);
      assert.equal(next.context.focused.product_id, seed.context.latest[1].product_id);
      assert.ok(reply.answer_sources.length);
    });
    state = await send(state, "Can this arrive by Friday?", (reply, next, turn) => {
      answered(reply, next, turn); assert.match(reply.message, /can't confirm arrival/);
      assert.deepEqual(next.context.focused, turn.context.focused);
    });
    state = await send(state, "What is it made of?", (reply, next, turn) => {
      answered(reply, next, turn); assert.match(reply.message, /material/i);
      assert.equal(next.context.focused.product_id, seed.context.latest[1].product_id);
    });
    await send(state, "Find a bag to match it", reply => {
      assert.notEqual(reply.status, "no_action");
      assert.equal(reply.action, "cross_sell");
    });
  });
  await scenario("Product comparison", () => send(structuredClone(seed), "Compare the first and second dresses: price, material and fit.", (reply, next, turn) => {
    answered(reply, next, turn);
    assert.ok(reply.answer_sources.length >= 2);
    assert.ok(reply.message.includes(seed.context.latest[0].product_name));
    assert.ok(reply.message.includes(seed.context.latest[1].product_name));
    assert.match(reply.message, /A\$/);
  }));
  for (const message of [
    "Will the first dress fit me? What sizes are available?",
    "Is the first dress breathable and comfortable? Can I machine wash it?",
    "Does the first dress have pockets?",
    "Is the first dress in stock?",
    "Can I return this? Is return postage free?",
    "Do you accept PayPal?",
  ]) await scenario(message, () => send(structuredClone(seed), message, answered));
  await scenario("Ambiguous reference and short reply", async () => {
    const state = await send(structuredClone(seed), "Why would you recommend this item for a beach wedding?", (reply, next, turn) => {
      answered(reply, next, turn); assert.ok(reply.pending_answer);
    });
    const interjection = await send(state, "What is your returns policy?", (reply, next, turn) => {
      answered(reply, next, turn); assert.deepEqual(reply.pending_answer, state.pending_answer);
    });
    await send(interjection, "The second dress", (reply, next, turn) => {
      answered(reply, next, turn); assert.equal(reply.pending_answer, null);
      assert.match(reply.message, /beach wedding/i);
      assert.equal(next.context.focused.product_id, seed.context.latest[1].product_id);
    });
  });
  await scenario("Mixed explanation and cheaper search", () => send(structuredClone(seed), "Why the first dress, and show me a cheaper option?", reply => {
    assert.equal(reply.action, "cheaper");
    assert.ok(reply.answer_sources.length);
    assert.ok(reply.message.includes(seed.context.latest[0].product_name));
    assert.ok(reply.products.every(product => product.price_aud < seed.context.latest[0].price_aud));
  }));
  await scenario("Ambiguous mixed request retains cheaper follow-up", async () => {
    const state = await send(structuredClone(seed), "Why this dress, and show me a cheaper option?", reply => {
      assert.ok(reply.pending_answer?.follow_up);
    });
    await send(state, "The first dress", reply => {
      assert.equal(reply.action, "cheaper");
      assert.ok(reply.answer_sources.length);
      assert.equal(reply.pending_answer, null);
    });
  });
  await scenario("Shopping clarification survives a policy question", async () => {
    let state = await send(structuredClone(seed), "Find a bag to match one of these dresses", reply => assert.ok(reply.pending));
    const previous = structuredClone(state.pending);
    state = await send(state, "Can this arrive by Friday?", (reply, next, turn) => {
      answered(reply, next, turn); assert.deepEqual(next.pending, previous);
    });
    await send(state, "The second dress", reply => {
      assert.equal(reply.action, "cross_sell"); assert.equal(reply.pending, null);
    });
  });
  await scenario("Missing context clarifies", () => send(newSession(), "Why would you recommend this item for a beach wedding?", reply => {
    assert.equal(reply.status, "answered"); assert.ok(reply.pending_answer);
    assert.deepEqual(reply.answer_sources, []);
  }));
  await scenario("Acknowledgement preserves shortlist", () => send(structuredClone(seed), "Thank you", (reply, next) => {
    assert.equal(reply.status, "no_action"); assert.match(reply.message, /welcome/i);
    assert.deepEqual(next.context.latest, seed.context.latest);
  }));
} finally {
  evidence.finished = new Date().toISOString(); evidence.passed = passed; evidence.failed_scenarios = failed;
  mkdirSync(new URL("../docs/test-evidence/", import.meta.url), { recursive: true });
  const file = new URL(`../docs/test-evidence/answers-live-${started.replace(/[:.]/g, "-")}.json`, import.meta.url);
  writeFileSync(file, JSON.stringify(evidence, null, 2));
  console.log(`\n${passed} live requests passed; ${failed} failed scenarios. Evidence: ${file.pathname}`);
}
if (failed) process.exitCode = 1;
