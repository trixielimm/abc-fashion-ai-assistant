import assert from "node:assert/strict";
import { POST } from "../app/api/stylist-events/route.ts";
import { COMMERCE_POLICY } from "../lib/stylist/commerceSchema.ts";

const previous = { enabled: process.env.STYLIST_ANALYTICS_ENABLED, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
const originalFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = async () => { calls++; throw new Error("Telemetry contract tests are offline."); };
const event = () => ({ event_id: crypto.randomUUID(), session_id: crypto.randomUUID(), recommendation_id: crypto.randomUUID(), event_type: "impression", product_id: "D1", position: 1, policy_version: COMMERCE_POLICY });
function request(body = { events: [event()] }, extra = {}) {
  return new Request("http://localhost:3000/api/stylist-events", { method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json", ...extra }, body: JSON.stringify(body) });
}
let passed = 0;
async function check(name, run) { await run(); passed++; console.log(`PASS: ${name}`); }
try {
  delete process.env.STYLIST_ANALYTICS_ENABLED;
  await check("Telemetry is opt-in and performs no database writes when disabled", async () => assert.equal((await POST(request())).status, 204));
  process.env.STYLIST_ANALYTICS_ENABLED = "true";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  await check("Fifth-position events pass validation; sixth-position events are rejected", async () => {
    assert.equal((await POST(request({ events: [{ ...event(), position: 5 }] }))).status, 503);
    assert.equal((await POST(request({ events: [{ ...event(), position: 6 }] }))).status, 400);
  });
  await check("Cross-origin telemetry is rejected", async () => assert.equal((await POST(request(undefined, { origin: "https://other.example" }))).status, 403));
  await check("Requests without a usable origin are rejected", async () => assert.equal((await POST(request(undefined, { origin: "null" }))).status, 403));
  await check("Unsupported content types are rejected", async () => assert.equal((await POST(request(undefined, { "content-type": "text/plain" }))).status, 415));
  await check("Raw messages, prices, and purchase events cannot enter the telemetry schema", async () => {
    for (const extra of [{ message: "private text" }, { price: 100 }, { event_type: "purchase" }]) assert.equal((await POST(request({ events: [{ ...event(), ...extra }] }))).status, 400);
  });
  await check("Batches cannot mix session IDs", async () => assert.equal((await POST(request({ events: [event(), event()] }))).status, 400));
  await check("Oversized telemetry is rejected before database access", async () => assert.equal((await POST(request({ payload: "x".repeat(9000) }))).status, 413));
  await check("Missing privileged server configuration fails without exposing credentials", async () => assert.equal((await POST(request())).status, 503));
  assert.equal(calls, 0);
  console.log(`\n${passed} telemetry contract checks passed; no network calls.`);
} finally {
  globalThis.fetch = originalFetch;
  if (previous.enabled === undefined) delete process.env.STYLIST_ANALYTICS_ENABLED; else process.env.STYLIST_ANALYTICS_ENABLED = previous.enabled;
  if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
}
