import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JOURNEYS, EVERYDAY_IDS } from './fixtures/stylist-journeys.mjs';
import { acceptReply, makeTurn, newSession, TurnReplySchema } from '../lib/stylist/conversationProtocol.ts';
import { finishConversationTurn, shortcutPlan } from '../lib/stylist/conversationTurn.ts';
import { product } from './fixtures/customer-scenarios.mjs';
import { rows, vocabulary } from './fixtures/proactive-cross-sell.mjs';
import { validatePack, runLiveJourney, runFaultJourney, runCheck, evaluateStep, renderPrompt, checkProducts } from './lib/stylist-journey-harness.mjs';
import { parseOptions, selectJourneys, manualGuide } from './run-stylist-journeys.mjs';

let passed = 0;
async function check(name, run) { await run(); passed++; console.log(`PASS: ${name}`); }
const first = JOURNEYS[0];
await check('Independent family checks reject trousers offered as skirts', () => {
  assert.throws(() => checkProducts([{ ...product('WRONG-FAMILY', 'Clothing', 100), product_type: 'Trousers' }], { typePattern: '\\bskirt\\b' }, {}), /requested product family/);
});
function response(turn, overrides = {}) {
  return TurnReplySchema.parse({ status: 'no_action', action: 'none', message: 'Recorded catalogue facts.',
    products: [], proposed_scopes: turn.scopes, applied_preferences: null, pending: null,
    styling: turn.styling, ...overrides });
}
function dressReply(turn, { noMatch = false, budget = 200 } = {}) {
  const scopes = structuredClone(turn.scopes);
  Object.assign(scopes.item, { category: 'Clothing', subcategory: 'Dresses', gender: 'Women', max_price: budget });
  return response(turn, { status: noMatch ? 'no_match' : 'matches', action: 'new_search', proposed_scopes: scopes,
    applied_preferences: scopes.item, products: noMatch ? [] : [product('BOUND-DRESS', 'Clothing', 120)] });
}

await check('The full pack retains the original 50 journeys and adds four recommendation cases, three to everyday', () => {
  assert.equal(validatePack(JOURNEYS, EVERYDAY_IDS).primary_live_turns, 111);
  assert.equal(selectJourneys(parseOptions([])).length, 13);
  assert.equal(selectJourneys(parseOptions(['--suite', 'prerelease'])).length, 54);
  for (let index = 1; index <= 50; index++) assert.ok(JOURNEYS.some(journey => journey.id === `J${String(index).padStart(2, '0')}`));
  assert.deepEqual(EVERYDAY_IDS.slice(-3), ['J51', 'J52', 'J53']);
  assert.ok(!EVERYDAY_IDS.includes('J54'));
});
await check('Invalid flags and unsafe or unintended endpoints are rejected before requests', () => {
  for (const args of [['--base', 'https://example.com'], ['--base', 'http://localhost.evil.test'],
    ['--base', 'http://localhost:3000/other'], ['--base', 'http://user:secret@localhost:3000'],
    ['--base', 'http://localhost:3000/?secret=x'], ['--filter', 'J50'], ['--repeat', '0'],
    ['--repeat', '1.5'], ['--variant', '4'], ['--suite', 'release'], ['--typo'], ['--base']]) {
    assert.throws(() => parseOptions(args), `Must reject ${args[0]}`);
  }
  assert.equal(parseOptions(['--base', 'http://[::1]:3002']).base, 'http://[::1]:3002');
  assert.equal(selectJourneys(parseOptions(['--suite', 'prerelease', '--filter', 'J18,J32'])).length, 2);
});
await check('Generated manual guide is current and includes all 54 journeys and their review criteria', () => {
  const guide = manualGuide();
  assert.equal(readFileSync(new URL('../docs/ai-stylist-journey-pack.md', import.meta.url), 'utf8'), guide);
  assert.equal((guide.match(/^### J\d{2}:/gm) ?? []).length, 54);
  assert.match(guide, /441 live conversations plus five fault cases/);
  assert.match(guide, /Human review remains PENDING/);
});
await check('Each controlled recovery case executes and passes without any HTTP/model dependency', async () => {
  for (const journey of JOURNEYS.filter(journey => journey.mode === 'fault')) {
    const result = await runFaultJourney(journey);
    assert.equal(result.status, 'AUTO_PASS', `${journey.id}: ${result.failure}`);
    assert.equal(result.human_review, 'PENDING');
    assert.ok(result.checks.length);
  }
});
await check('A complete journey follows actual returned product identity and uses the requested opening variant', async () => {
  const requests = [];
  const result = await runLiveJourney(first, { base: 'http://localhost:3000', variant: 2, fetchImpl: async (url, options) => {
    assert.equal(url.pathname, '/api/conversation-search');
    const envelope = JSON.parse(options.body); requests.push(envelope);
    const turn = envelope.turn;
    const reply = requests.length === 1 ? dressReply(turn) : response(turn, { status: 'answered', answer_product_ids: ['BOUND-DRESS'] });
    return Response.json(reply);
  } });
  assert.equal(result.status, 'AUTO_PASS', result.turns.at(-1).failure);
  assert.equal(requests[0].turn.message, first.variants[1]);
  assert.match(requests[1].turn.message, /BOUND-DRESS Dress/);
  assert.equal(requests[1].turn.context.latest[0].product_id, 'BOUND-DRESS');
  assert.notEqual(requests[0].request_id, requests[1].request_id);
  assert.equal(result.human_review, 'PENDING');
});
await check('No-match cannot count as a successful shopping journey and dependent turns are not sent', async () => {
  let calls = 0;
  const result = await runLiveJourney(first, { base: 'http://localhost:3000', fetchImpl: async (_url, options) => {
    calls++; return Response.json(dressReply(JSON.parse(options.body).turn, { noMatch: true }));
  } });
  assert.equal(result.status, 'BLOCKED_CATALOGUE'); assert.equal(calls, 1);
  assert.equal(result.unexecuted_turns, 1); assert.equal(result.turns.length, 1);
});
await check('A single valid result blocks a two-product comparison rather than falsely failing or passing it', async () => {
  const comparison = { ...first, turns: [{ ...first.turns[0], needProducts: 2 }, first.turns[1]] };
  const result = await runLiveJourney(comparison, { base: 'http://localhost:3000', fetchImpl: async (_url, options) =>
    Response.json(dressReply(JSON.parse(options.body).turn)) });
  assert.equal(result.status, 'BLOCKED_CATALOGUE');
  assert.equal(result.unexecuted_turns, 1);
});
await check('Wrong saved preferences are a failure even when products and schema are internally consistent', async () => {
  const result = await runLiveJourney(first, { base: 'http://localhost:3000', fetchImpl: async (_url, options) =>
    Response.json(dressReply(JSON.parse(options.body).turn, { budget: 201 })) });
  assert.equal(result.status, 'FAIL');
  assert.match(result.turns[0].failure, /max_price/);
});
await check('HTTP failures are errors with safe error codes, not no-match or model-quality passes', async () => {
  const result = await runLiveJourney(first, { base: 'http://localhost:3000', fetchImpl: async () =>
    Response.json({ code: 'CATALOGUE_UNAVAILABLE', error: 'Not saved provider detail' }, { status: 503 }) });
  assert.equal(result.status, 'ERROR'); assert.equal(result.turns[0].error_code, 'CATALOGUE_UNAVAILABLE');
  assert.ok(!JSON.stringify(result).includes('Not saved provider detail'));
});
await check('Malformed successful responses fail schema/contract evaluation', async () => {
  const result = await runLiveJourney(first, { base: 'http://localhost:3000', fetchImpl: async () =>
    new Response('not JSON', { status: 200 }) });
  assert.equal(result.status, 'FAIL');
  assert.match(result.turns[0].failure, /not JSON/);
});
await check('Missing fields or unresolved placeholders cannot accidentally pass an assertion', () => {
  assert.throws(() => renderPrompt('What about {{missing.product_name}}?', {}), /Missing evidence/);
  assert.throws(() => runCheck({ path: 'state.missing', op: 'eq', value: null }, { state: {} }), /Missing evidence/);
  assert.throws(() => runCheck({ path: 'state.size', op: 'eq', value: '7' }, { state: { size: '38' } }));
});
await check('Independent product checks reject over-budget, same-price, wrong-size and rejected items', () => {
  const row = product('D', 'Clothing', 120);
  for (const rule of [{ max: 119 }, { below: 120 }, { size: '7' }, { colour: 'Blue' }, { excludedIds: ['D'] }, { category: 'Shoes' }]) {
    assert.throws(() => checkProducts([row], rule, {}));
  }
});
await check('A missing group cannot pass as a complete shared-budget outfit', () => {
  const state = newSession();
  assert.throws(() => evaluateStep({ checks: [], requireOutfit: true },
    { products: [], alternatives: [] }, state, structuredClone(state), {}), /complete grouped outfit/);
});

function recommendationReply(turn) {
  const message = turn.message;
  const changes = [
    ['category', 'Clothing', 'dress'], ['subcategory', 'Dresses', 'dress'],
    ['occasion', 'Beach Wedding', 'beach wedding'], ['gender', 'Women', "women's"],
    ...(message.includes('200') ? [['max_price', 200, 'A$200']] : []),
  ].map(([field, value, evidence]) => ({ scope: 'item', field, operation: 'set', value, evidence }));
  return finishConversationTurn(rows, turn, { action: 'new_search', intent_evidence: message,
    reference: null, changes, question: null, continuation: false }, vocabulary);
}
const recommendation = JOURNEYS.find(journey => journey.id === 'J51');
function recommendationEvidence() {
  const before = newSession();
  const turn = makeTurn(before, recommendation.variants[0]);
  const reply = recommendationReply(turn);
  return { before, reply, state: acceptReply(turn, reply).session };
}
await check('Required proactive products cannot silently pass when eligible primary results exist', async () => {
  let calls = 0;
  const journey = { ...first, turns: [{ ...first.turns[0], needComplementary: true }, first.turns[1]] };
  const result = await runLiveJourney(journey, { base: 'http://localhost:3000', fetchImpl: async (_url, options) => {
    calls++; return Response.json(dressReply(JSON.parse(options.body).turn));
  } });
  assert.equal(result.status, 'FAIL');
  assert.match(result.turns[0].failure, /Expected actual complementary products/);
  assert.equal(calls, 1); assert.equal(result.unexecuted_turns, 1);
});
await check('Recommendation bindings use actual additions while the second dress keeps its primary ordinal', () => {
  const { before, reply, state } = recommendationEvidence();
  const bindings = {};
  evaluateStep(recommendation.turns[0], reply, state, before, bindings);
  assert.equal(bindings.extra.product_id, reply.complementary_offer.items[0].product.product_id);
  assert.equal(bindings.secondDress.product_id, reply.products[1].product_id);
  assert.match(renderPrompt(recommendation.turns[1].prompt, bindings), new RegExp(bindings.extra.product_name));
});
await check('The independent offer checks reject inherited dress budgets, owned roles and changed primary order', () => {
  const { before, reply, state } = recommendationEvidence();
  const inherited = structuredClone(reply);
  inherited.complementary_offer.items[0].preferences.max_price = 200;
  assert.throws(() => evaluateStep(recommendation.turns[0], inherited, state, before, {}), /Additional max_price/);
  const owned = structuredClone(state);
  owned.styling.owned_categories.push(reply.complementary_offer.items[0].product.category);
  assert.throws(() => evaluateStep(recommendation.turns[0], reply, owned, before, {}), /Owned roles/);
  const reordered = structuredClone(state); reordered.context.latest.reverse();
  assert.throws(() => evaluateStep(recommendation.turns[0], reply, reordered, before, {}), /Primary references keep their order/);
});
await check('The rematching journey sends the bound anchor control and accepts additions without primary cards', async () => {
  const journey = JOURNEYS.find(item => item.id === 'J54');
  const requests = [];
  const result = await runLiveJourney(journey, { base: 'http://localhost:3000', fetchImpl: async (_url, options) => {
    const { turn } = JSON.parse(options.body); requests.push(turn);
    return Response.json(requests.length === 1 ? recommendationReply(turn) :
      finishConversationTurn(rows, turn, shortcutPlan(turn), vocabulary));
  } });
  assert.equal(result.status, 'AUTO_PASS', result.turns.at(-1).failure);
  const firstReply = result.turns[0].reply;
  assert.notEqual(requests[1].offer_anchor_id, firstReply.complementary_offer.anchor.product_id);
  assert.ok(firstReply.products.some(item => item.product_id === requests[1].offer_anchor_id));
  assert.equal(result.turns[1].reply.products.length, 0);
  assert.equal(result.turns[1].reply.complementary_offer.anchor.product_id, requests[1].offer_anchor_id);
  const before = result.turns[0].state;
  assert.throws(() => evaluateStep(journey.turns[1], result.turns[1].reply, result.turns[1].state, before,
    { otherDress: firstReply.complementary_offer.anchor }), /Refresh uses the requested dress/);
});
await check('The no-extras journey explicitly requests the returned matching category and keeps the pause', async () => {
  const journey = JOURNEYS.find(item => item.id === 'J52');
  let calls = 0;
  const result = await runLiveJourney(journey, { base: 'http://localhost:3000', fetchImpl: async (_url, options) => {
    const { turn } = JSON.parse(options.body);
    const reply = ++calls === 1 ? recommendationReply(turn) : finishConversationTurn(rows, turn, {
      action: 'cross_sell', intent_evidence: turn.message, reference: { kind: 'id', value: turn.context.latest[0].product_id },
      changes: [{ scope: 'item', field: 'category', operation: 'set', value: 'Bags', evidence: 'Bags' }],
      question: null, continuation: false,
    }, vocabulary);
    return Response.json(reply);
  } });
  assert.equal(result.status, 'AUTO_PASS', result.turns.at(-1).failure);
  assert.match(result.turns[1].message, /matching Bags/);
  assert.equal(result.turns[1].state.styling.offers_paused, true);
});
await check('Invalid product binding sources and indices are rejected before any requests', () => {
  for (const selector of [{ source: 'extra', index: 0 }, { source: 'primary', index: -1 }, { index: 0.5 }, { index: 0, typo: true }]) {
    const pack = structuredClone(JOURNEYS);
    pack.find(journey => journey.id === 'J51').turns[0].bind.extra = selector;
    assert.throws(() => validatePack(pack, EVERYDAY_IDS), /binding|selector/);
  }
});

console.log(`\n${passed} journey-harness checks passed. No live model or catalogue calls.`);
