import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { makeTurn, newSession, TurnReplySchema } from "../lib/stylist/conversationProtocol.ts";

// Exercise the actual route in production mode without model/database calls.
// Run with NODE_ENV=production node --conditions=react-server --import tsx ...
// Optionally pass a local base URL to run the same checks over HTTP.
assert.equal(process.env.NODE_ENV, "production", "This suite must run in production mode.");
const live = Boolean(process.argv[2]);
const base = new URL(process.argv[2] ?? "http://localhost:3102");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Use a local production test server.");
const endpoint = new URL("/api/conversation-search", base);
let passed = 0;
let externalCalls = 0;
const originalFetch = globalThis.fetch;
if (!live) globalThis.fetch = async () => { externalCalls++; throw new Error("Offline production checks cannot access the network."); };
const POST = live ? request => originalFetch(request) : (await import("../app/api/conversation-search/route.ts")).POST;
function request(body, headers = {}, raw = false) {
  return new Request(endpoint, {
    method: "POST", headers: { host: base.host, "content-type": "application/json", ...headers },
    body: raw ? body : JSON.stringify(body),
  });
}
async function check(name, run) { await run(); passed++; console.log(`PASS: ${name}`); }
async function status(body, expected, headers, raw) {
  const response = await POST(request(body, headers, raw));
  assert.equal(response.status, expected);
  assert.equal(response.headers.get("cache-control"), "no-store");
  return response.json();
}

try {
  await check("The customer conversation route accepts a valid request in production", async () => {
    const reply = TurnReplySchema.parse(await status(makeTurn(newSession(), "cancel"), 200));
    assert.equal(reply.status, "no_action");
    assert.deepEqual(reply.products, []);
  });
  await check("The customer UI envelope works in production", async () => {
    const reply = TurnReplySchema.parse(await status({
      request_id: randomUUID(), retry: false, turn: makeTurn(newSession(), "cancel"),
    }, 200));
    assert.equal(reply.action, "none");
  });
  if (!live) await check("The commerce kill switch disables new comparisons without model or catalogue access", async () => {
    const previous = process.env.STYLIST_COMMERCE_ENABLED;
    process.env.STYLIST_COMMERCE_ENABLED = "false";
    try {
      const state = newSession();
      state.context.latest = [{ product_id: "D1", product_name: "Test Dress", category: "Clothing", subcategory: "Dresses", product_type: "Wrap Dress", price_aud: 80 }];
      const reply = TurnReplySchema.parse(await status(makeTurn(state, "Find an extra", null, { kind: "cross_sell", product_id: "D1" }), 200));
      assert.equal(reply.status, "no_action");
      assert.match(reply.message, /temporarily unavailable/);
      assert.deepEqual(reply.proposed_scopes, state.scopes);
    } finally {
      if (previous === undefined) delete process.env.STYLIST_COMMERCE_ENABLED; else process.env.STYLIST_COMMERCE_ENABLED = previous;
    }
  });
  await check("Same-origin requests remain accepted", async () => {
    await status(makeTurn(newSession(), "cancel"), 200, { origin: base.origin });
  });
  await check("Production cancellation restores pending preferences", async () => {
    const state = newSession();
    const before = structuredClone(state.scopes);
    state.scopes.item.max_price = 75;
    state.pending = {
      action: "refine", reference: null, goal: "Show cheaper dresses", question: "Which dress?", before_scopes: before,
    };
    const reply = TurnReplySchema.parse(await status(makeTurn(state, "cancel"), 200));
    assert.equal(reply.pending, null);
    assert.deepEqual(reply.proposed_scopes, before);
  });
  await check("Cross-origin requests remain rejected", async () => {
    await status(makeTurn(newSession(), "cancel"), 403, { origin: "https://other.example" });
  });
  await check("Malformed origins remain rejected", async () => {
    await status(makeTurn(newSession(), "cancel"), 403, { origin: "invalid origin" });
  });
  await check("Unsupported content types remain rejected", async () => {
    await status(makeTurn(newSession(), "cancel"), 415, { "content-type": "text/plain" });
  });
  await check("Malformed JSON remains rejected", async () => { await status('{"message":', 400, {}, true); });
  await check("Invalid conversation input remains rejected", async () => { await status({ message: "" }, 400); });
  await check("Oversized bodies remain rejected", async () => { await status({ message: "x".repeat(64_001) }, 413); });
  await check("Expired retries still return a useful conflict instead of running a new model call", async () => {
    const result = await status({ request_id: randomUUID(), retry: true, turn: makeTurn(newSession(), "Show dresses") }, 409);
    assert.equal(result.code, "RETRY_EXPIRED");
  });
  assert.equal(externalCalls, 0);
  console.log(`\n${passed} production-route checks passed; ${live ? "HTTP against the local production server" : "no network calls"}.`);
} finally {
  globalThis.fetch = originalFetch;
}
