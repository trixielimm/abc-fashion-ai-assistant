import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { newSession, makeTurn, acceptReply } from '../lib/stylist/conversationProtocol.ts';
import { relatedLabel } from '../lib/search/preferenceSearch.ts';

// Read-only, real model/catalogue/HTTP probe. No cart or shared database writes.
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:3002');
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('Use a local app server.');
const started = new Date().toISOString();
const evidence = { started, base: base.origin, checks: [] };
const catalogue = [];
let state = newSession();
async function send(message, verify) {
  const turn = makeTurn(state, message);
  const began = Date.now();
  const response = await fetch(new URL('/api/conversation-search', base), { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: randomUUID(), retry: false, turn }), signal: AbortSignal.timeout(120_000) });
  const record = { message, http: response.status, elapsed_ms: Date.now() - began };
  evidence.checks.push(record);
  const body = await response.json(); record.reply = body;
  assert.equal(response.status, 200, JSON.stringify(body));
  const accepted = acceptReply(turn, body); state = accepted.session;
  for (const product of accepted.reply.products) {
    const source = catalogue.find(row => row.product_id === product.product_id);
    assert.ok(source, 'Only actual catalogue products'); assert.equal(source.price_aud, product.price_aud);
    assert.equal(source.is_available, true); assert.ok(source.stock_qty > 0);
    assert.ok(relatedLabel(source.occasion, 'Formal'), 'Formal request must match recorded occasion');
  }
  verify(accepted.reply);
  assert.deepEqual(state.cart_product_ids, [], 'No automatic cart changes');
  record.pass = true; console.log(`PASS: HTTP ${response.status} ${accepted.reply.status}: ${message}`);
}
let failed = false;
try {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await db.from('product_catalog').select('product_id,category,price_aud,occasion,is_available,stock_qty')
      .order('product_id').range(offset, offset + 199).abortSignal(AbortSignal.timeout(15_000));
    if (error) throw new Error(`Public catalogue audit failed: ${error.code}`);
    catalogue.push(...data); if (data.length < 200) break;
  }
  evidence.catalogue_count = catalogue.length;
  await send('I want a dress and shoes for formal events, my budget for both of them is 400 aud', reply => {
    assert.equal(reply.status, 'matches'); assert.equal(reply.outfit_choices.groups.length, 2);
    assert.ok(reply.outfit_choices.groups.every(group => group.product_ids.length >= 1 && group.product_ids.length <= 5));
    // Real stock and the shared budget can yield fewer than the five-option cap.
    assert.ok(reply.optional_question); assert.equal(reply.pending, null);
    assert.deepEqual(new Set(reply.products.map(row => row.category)), new Set(['Clothing', 'Shoes']));
    assert.ok(reply.outfit_budget.total_aud <= 400); assert.equal(reply.outfit_budget.limit_aud, 400);
    assert.equal(state.scopes.item.max_price, null);
  });
  const remembered = structuredClone(state);
  await send('zibble flomp splatch', reply => {
    assert.equal(reply.intent_understood, false); assert.deepEqual(reply.products, []);
    assert.deepEqual(state.scopes, remembered.scopes); assert.deepEqual(state.styling, remembered.styling);
    assert.deepEqual(state.context, remembered.context); assert.deepEqual(state.history, remembered.history);
  });
  await send('Actually my combined budget is 1 aud. Keep both items and the formal occasion.', reply => {
    assert.equal(reply.status, 'no_match'); assert.deepEqual(reply.products, []);
    assert.equal(state.styling.outfit_request.total_budget_aud, 1); assert.equal(state.styling.outfit_request.items.length, 2);
  });
  await send('Make the combined budget 400 aud again, keeping everything else.', reply => {
    assert.equal(reply.status, 'matches'); assert.equal(reply.outfit_choices.groups.length, 2);
    assert.ok(reply.outfit_budget.total_aud <= 400); assert.equal(reply.outfit_budget.limit_aud, 400);
  });
  await send('What material is the first dress in these results?', reply => {
    assert.equal(reply.status, 'answered'); assert.equal(reply.answer_product_ids.length, 1);
    assert.equal(catalogue.find(row => row.product_id === reply.answer_product_ids[0]).category, 'Clothing');
  });
  state = newSession();
  await send('Build a complete outfit with a dress, shoes and bag for formal events under $400 total.', reply => {
    assert.equal(reply.status, 'matches'); assert.equal(reply.outfit_choices.groups.length, 3);
    assert.deepEqual(new Set(reply.products.map(row => row.category)), new Set(['Clothing', 'Shoes', 'Bags']));
    assert.ok(reply.outfit_budget.total_aud <= 400);
  });
} catch (error) {
  failed = true; evidence.error = error.message; console.error(error);
} finally {
  evidence.finished = new Date().toISOString(); evidence.passed = evidence.checks.filter(row => row.pass).length;
  evidence.failed = failed ? 1 : 0;
  const output = new URL(`../docs/test-evidence/outfit-budget-http-${started.replace(/[:.]/g, '-')}.json`, import.meta.url);
  writeFileSync(output, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ passed: evidence.passed, failed: evidence.failed, evidence: output.pathname }));
  if (failed) process.exitCode = 1;
}
