import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { acceptReply, makeTurn, newSession } from '../../lib/stylist/conversationProtocol.ts';
import { postChatJson } from '../../lib/ai/chatRequest.ts';
import { ConversationStore, RequestConflictError, RetryExpiredError } from '../../lib/stylist/conversationStore.ts';

export class CatalogueBlocked extends Error {}
export class TransportError extends Error {}
export const visibleProducts = reply => [...reply.products, ...reply.alternatives];
const cents = value => Math.round(value * 100);
const normalise = value => String(value).trim().toLowerCase();
export const fingerprint = value => createHash('sha256').update(value).digest('hex');

export function readPath(root, path) {
  let value = root;
  for (const part of path.split('.')) {
    if (value == null || !Object.hasOwn(Object(value), part)) throw new Error(`Missing evidence field: ${path}`);
    value = value[part];
  }
  return value;
}
export function resolveValues(value, context) {
  if (Array.isArray(value)) return value.map(item => resolveValues(item, context));
  if (value && typeof value === 'object') {
    if (Object.keys(value).length === 1 && typeof value.ref === 'string') return readPath(context, value.ref);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveValues(item, context)]));
  }
  return value;
}
export function renderPrompt(prompt, bindings) {
  return prompt.replace(/\{\{([\w.]+)\}\}/g, (_, path) => String(readPath(bindings, path)));
}
export function runCheck(rule, context) {
  const actual = readPath(context, rule.path);
  const expected = resolveValues(rule.value, context);
  const message = `${rule.path} ${rule.op} ${JSON.stringify(expected)}`;
  switch (rule.op) {
    case 'eq': assert.deepEqual(actual, expected, message); break;
    case 'notEq': assert.notDeepEqual(actual, expected, message); break;
    case 'includes': assert.ok(Array.isArray(actual) && actual.includes(expected), message); break;
    case 'oneOf': assert.ok(expected.includes(actual), message); break;
    case 'truthy': assert.ok(actual, message); break;
    case 'nonempty': assert.ok(Array.isArray(actual) && actual.length > 0, message); break;
    case 'matches': assert.match(actual, new RegExp(expected, 'i'), message); break;
    case 'setEq': assert.deepEqual(new Set(actual), new Set(expected), message); break;
    case 'piece':
    case 'issue': assert.ok(Array.isArray(actual) && actual.some(item => Object.entries(expected).every(([key, value]) => item[key] === value)), message); break;
    default: throw new Error(`Unknown check operator: ${rule.op}`);
  }
}

// These checks use the journey's requested values, independently of the
// endpoint's echoed applied_preferences and its production Zod validation.
export function checkProducts(products, rawRule, context) {
  const rule = resolveValues(rawRule ?? {}, context);
  for (const product of products) {
    for (const key of ['category', 'subcategory', 'colour']) {
      if (rule[key]) assert.equal(normalise(product[key]), normalise(rule[key]), `${product.product_id}: requested ${key}`);
    }
    if (rule.size) assert.ok(product.sizes_available.some(size => normalise(size) === normalise(rule.size)), `${product.product_id}: requested size`);
    if (rule.typePattern) assert.match(product.product_type ?? '', new RegExp(rule.typePattern, 'i'), `${product.product_id}: requested product family`);
    if (rule.max !== undefined) assert.ok(cents(product.price_aud) <= cents(rule.max), `${product.product_id}: maximum price`);
    if (rule.below !== undefined) assert.ok(cents(product.price_aud) < cents(rule.below), `${product.product_id}: strictly cheaper`);
    assert.ok(!(rule.excludedColours ?? []).some(colour => normalise(product.colour) === normalise(colour)), `${product.product_id}: excluded colour`);
    assert.ok(!(rule.excludedIds ?? []).includes(product.product_id), `${product.product_id}: excluded product`);
    if (rule.anchor) assert.ok(product.pairing_evidence?.anchor_ids.includes(rule.anchor), `${product.product_id}: pairing anchor`);
    if (rule.externalAnchor) assert.ok(product.pairing_evidence?.external_anchor_ids?.length, `${product.product_id}: external pairing anchor`);
  }
}

function checkOutfit(reply, step, context) {
  if (step.components) {
    const components = context.state.styling.outfit_request?.items ?? [];
    for (const wanted of step.components) {
      assert.ok(components.some(component => Object.entries(wanted).every(([key, value]) =>
        JSON.stringify(component[key]) === JSON.stringify(value))), `Missing independently specified outfit component: ${JSON.stringify(wanted)}`);
    }
  }
  if (step.requireOutfit) {
    assert.ok(reply.outfit_budget && reply.outfit_choices, 'Expected complete grouped outfit choices');
    const groups = reply.outfit_choices.groups;
    const products = visibleProducts(reply);
    assert.equal(groups.length, context.state.styling.outfit_request.items.length, 'Every requested component has a group');
    const maximum = groups.reduce((sum, group) => sum + Math.max(...group.product_ids.map(id => {
      const product = products.find(item => item.product_id === id);
      assert.ok(product, `Group references a displayed product: ${id}`);
      return cents(product.price_aud);
    })), 0);
    assert.ok(maximum <= cents(context.state.styling.outfit_request.total_budget_aud), 'Every displayed combination fits the requested combined limit');
  }
  if (step.requirePurchaseBudget) {
    const budget = reply.purchase_budget;
    const selected = context.state.styling.outfit.filter(piece => piece.ownership === 'selected');
    const fixed = selected.reduce((sum, piece) => sum + cents(piece.price_aud), 0);
    assert.equal(cents(budget.fixed_total_aud), fixed, 'Selected purchases consume the budget');
    assert.equal(cents(budget.remaining_aud), cents(budget.limit_aud) - fixed);
    assert.ok(visibleProducts(reply).every(product => fixed + cents(product.price_aud) <= cents(budget.limit_aud)));
  }
}

export function evaluateStep(step, reply, state, before, bindings) {
  const context = { reply, state, before, bindings };
  assert.deepEqual(state.cart_product_ids ?? [], before.cart_product_ids ?? [], 'Chat never adds products to cart automatically');
  for (const rule of step.checks) runCheck(rule, context);
  const products = visibleProducts(reply);
  if (reply.complementary_offer) {
    const offer = reply.complementary_offer;
    const anchors = reply.offer_refresh ? before.context.latest : reply.products;
    assert.ok(anchors.some(product => product.product_id === offer.anchor.product_id), 'The complementary anchor is a displayed primary match or an explicitly refreshed result');
    if (step.offerAnchor) assert.equal(offer.anchor.product_id, resolveValues(step.offerAnchor, context), 'Refresh uses the requested dress');
    assert.ok(offer.items.length >= 1 && offer.items.length <= 2, 'A bounded complementary shortlist');
    assert.equal(state.styling.offers_paused, false, 'Paused offers cannot display extras');
    assert.equal(state.task.complementary_shown, true, 'The offer is remembered to avoid repeated pitches');
    assert.deepEqual(state.context.complementary.map(product => product.product_id), offer.items.map(item => item.product.product_id), 'Additional references preserve the exact offered products');
    assert.deepEqual(state.context.latest.map(product => product.product_id),
      (reply.offer_refresh ? before.context.latest : products).map(product => product.product_id), 'Primary references keep their order without additions');
    const ids = [...products.map(product => product.product_id), ...offer.items.map(item => item.product.product_id)];
    assert.equal(new Set(ids).size, ids.length, 'Primary and additional products are distinct');
    const selected = state.styling.outfit.filter(piece => piece.ownership === 'selected');
    const ownedAnchor = state.styling.outfit.some(piece => piece.product_id === offer.anchor.product_id && piece.ownership === 'owned');
    const base = selected.reduce((sum, piece) => sum + cents(piece.price_aud), 0) +
      (ownedAnchor || selected.some(piece => piece.product_id === offer.anchor.product_id) ? 0 : cents(offer.anchor.price_aud));
    const total = base + offer.items.reduce((sum, item) => sum + cents(item.product.price_aud), 0);
    assert.equal(cents(offer.base_total_aud), base, 'Selected/owned anchor pricing is independent of the echoed total');
    assert.equal(cents(offer.total_aud), total, 'The full displayed combination total is accurate');
    if (state.styling.purchase_budget) assert.ok(total <= cents(state.styling.purchase_budget.limit_aud), 'All additions together fit the saved total');
    if (step.complementaryBudget === 'separate') assert.equal(offer.combined_limit_aud, null, 'A dress-only cap is not a combined outfit budget');
    for (const item of offer.items) {
      checkProducts([item.product], { anchor: offer.anchor.product_id,
        excludedColours: state.scopes.shared.excluded_colours, max: state.scopes.shared.max_price ?? undefined,
        excludedIds: state.styling.rejected_ids }, context);
      assert.ok(!state.styling.owned_categories.includes(item.product.category), 'Owned roles are not sold again');
      if (step.complementaryBudget === 'separate') {
        for (const key of ['max_price', 'size', 'material', 'preferred_colours']) {
          assert.deepEqual(item.preferences[key], state.scopes.shared[key] ?? (key === 'preferred_colours' ? [] : null), `Additional ${key} comes from shared preferences, not dress-only filters`);
        }
      }
    }
  }
  checkProducts(products, step.products, context);
  if (step.noProducts) assert.equal(products.length, 0, 'This turn must not show new primary product cards');
  if (step.needProducts && products.length < step.needProducts) {
    if (['matches', 'partial', 'alternatives', 'no_match'].includes(reply.status)) {
      throw new CatalogueBlocked(`Need ${step.needProducts} eligible products, but received ${products.length} (${reply.status}). Inspect the catalogue to distinguish stock limits from a search bug.`);
    }
    throw new Error(`Expected at least ${step.needProducts} products; received ${products.length} (${reply.status}).`);
  }
  if (step.needComplementary) assert.ok(reply.complementary_offer, 'Expected actual complementary products on this turn; an absent offer is not a recommendation pass');
  checkOutfit(reply, step, context);
  if (step.compareTo) {
    const anchor = resolveValues(step.compareTo, context);
    assert.ok(reply.answer_product_ids.includes(anchor), 'Comparison must include the original named product');
    assert.ok(products.some(product => product.product_id !== anchor && reply.answer_product_ids.includes(product.product_id)), 'Comparison must include a newly returned product');
    assert.equal(reply.pending_answer, null, 'A future-results comparison must complete after the search');
  }
  if (step.requireDisclosures) {
    assert.ok(products.every(product => reply.unverified_requirements.every(value => product.unverified_requirements.includes(value))), 'Each provisional card discloses every unknown requirement');
  }
  for (const [name, selector] of Object.entries(step.bind ?? {})) {
    const source = selector.source === 'primary' ? reply.products : selector.source === 'complementary'
      ? reply.complementary_offer?.items.map(item => item.product) ?? [] : products;
    const pool = source.filter(product => (!selector.category || product.category === selector.category) &&
      (!selector.excludeAnchor || product.product_id !== reply.complementary_offer?.anchor.product_id));
    assert.ok(pool[selector.index], `No returned product available to bind as ${name}`);
    bindings[name] = structuredClone(pool[selector.index]);
  }
}

export async function runLiveJourney(journey, { base, variant = 1, timeoutMs = 120_000, fetchImpl = fetch, onTurn = () => {} }) {
  let state = newSession();
  const bindings = {};
  const result = { id: journey.id, name: journey.name, mode: 'live', variant, status: 'AUTO_PASS',
    human_review: 'PENDING', review: journey.review, expected: journey.expected, turns: [] };
  for (const [index, step] of journey.turns.entries()) {
    const began = Date.now();
    const record = { number: index + 1, checks: step.checks, status: 'NOT_RUN' };
    result.turns.push(record);
    try {
      const prompt = index === 0 ? journey.variants[variant - 1] : step.prompt;
      const message = renderPrompt(prompt, bindings);
      const before = structuredClone(state);
      const turn = makeTurn(state, message);
      if (step.offerAnchor) turn.offer_anchor_id = resolveValues(step.offerAnchor, { bindings });
      const envelope = { request_id: randomUUID(), retry: false, turn };
      record.message = message;
      record.request = envelope;
      const response = await fetchImpl(new URL('/api/conversation-search', base), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope), signal: AbortSignal.timeout(timeoutMs),
      });
      record.http_status = response.status;
      if (!response.ok) {
        // Keep error codes, never arbitrary HTML, proxy pages, headers or credentials.
        try { const body = await response.json(); record.error_code = body.code; } catch { /* Non-JSON failure. */ }
        throw new TransportError(`HTTP ${response.status}${record.error_code ? ` (${record.error_code})` : ''}`);
      }
      let raw;
      try { raw = await response.json(); } catch { throw new Error('The successful endpoint response was not JSON.'); }
      const accepted = acceptReply(turn, raw);
      record.reply = accepted.reply;
      record.state = accepted.session;
      evaluateStep(step, accepted.reply, accepted.session, before, bindings);
      state = accepted.session;
      record.status = 'AUTO_PASS';
    } catch (error) {
      result.status = error instanceof CatalogueBlocked ? 'BLOCKED_CATALOGUE'
        : error instanceof TransportError || ['TimeoutError', 'AbortError', 'TypeError'].includes(error.name) ? 'ERROR' : 'FAIL';
      record.status = result.status;
      record.failure = error.message;
      result.unexecuted_turns = journey.turns.length - index - 1;
    }
    record.elapsed_ms = Date.now() - began;
    onTurn(record);
    if (result.status !== 'AUTO_PASS') break;
  }
  return result;
}

export async function runFaultJourney(journey) {
  const result = { id: journey.id, name: journey.name, mode: 'fault', status: 'AUTO_PASS', human_review: 'PENDING',
    scope: 'Controlled in-process fault, not a real provider/database/browser outage.', review: journey.review, expected: journey.expected, checks: [] };
  const original = newSession();
  original.scopes.item.max_price = 150;
  const input = makeTurn(original, 'Show me dresses under A$150.');
  const before = JSON.stringify(input);
  const note = text => result.checks.push(text);
  const success = async () => Response.json({ status: 'recovered' });
  const stalled = (_url, options) => new Promise((resolve, reject) => {
    void resolve;
    options.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
  });
  try {
    if (journey.fault === 'timeout' || journey.fault === 'cancel') {
      const controller = new AbortController();
      const work = postChatJson('/api/conversation-search', input, {
        signal: controller.signal, timeoutMs: journey.fault === 'timeout' ? 10 : 1000, fetchImpl: stalled,
      });
      if (journey.fault === 'cancel') controller.abort();
      await assert.rejects(work, error => error.kind === (journey.fault === 'timeout' ? 'timeout' : 'cancelled'));
      assert.equal(JSON.stringify(input), before);
      note(`${journey.fault} produces the correct typed error without changing input state`);
      assert.equal((await postChatJson('/api/conversation-search', input, { signal: new AbortController().signal, fetchImpl: success })).status, 'recovered');
      note('A subsequent request succeeds');
    } else if (journey.fault === 'catalogue') {
      const store = new ConversationStore();
      let interpretations = 0, executions = 0;
      const interpret = async () => { interpretations++; return { action: 'new_search' }; };
      const execute = async () => { executions++; if (executions === 1) throw new Error('Injected catalogue failure'); return { status: 'recovered' }; };
      await assert.rejects(store.run('catalogue-fault', input, false, interpret, execute), /Injected catalogue failure/);
      assert.equal((await store.run('catalogue-fault', input, true, interpret, execute)).status, 'recovered');
      assert.equal(interpretations, 1); assert.equal(executions, 2);
      note('Catalogue execution fails once; retry reuses the one validated interpretation and executes again');
    } else if (journey.fault === 'duplicates') {
      const store = new ConversationStore();
      let interpretations = 0, executions = 0;
      const interpret = async () => { interpretations++; return { action: 'new_search' }; };
      const execute = async () => { executions++; return { status: 'recovered' }; };
      const replies = await Promise.all([false, true].map(retry => store.run('duplicate', input, retry, interpret, execute)));
      assert.deepEqual(replies[0], replies[1]); assert.equal(interpretations, 1); assert.equal(executions, 1);
      await assert.rejects(store.run('duplicate', { ...input, message: 'Different request' }, true, interpret, execute), RequestConflictError);
      note('Concurrent duplicates execute once; changed content with the same ID is rejected');
    } else if (journey.fault === 'restart') {
      original.context.latest = [{ product_id: 'TEST', product_name: 'Test Dress', category: 'Clothing', subcategory: 'Dresses', product_type: 'Midi Dress' }];
      original.styling.rejected_ids = ['REJECTED'];
      const clean = newSession();
      assert.equal(clean.scopes.item.max_price, null); assert.deepEqual(clean.context.latest, []);
      assert.deepEqual(clean.styling.rejected_ids, []); assert.deepEqual(clean.history, []);
      note('New chat removes saved preferences, product references, rejections and history');
      const interpret = async () => ({ action: 'none' });
      const execute = async () => ({ status: 'recovered' });
      await new ConversationStore().run('old', input, false, interpret, execute);
      const restarted = new ConversationStore();
      await assert.rejects(restarted.run('old', input, true, interpret, execute), RetryExpiredError);
      assert.equal((await restarted.run('new', makeTurn(clean, 'Hello'), false, interpret, execute)).status, 'recovered');
      note('A restarted process rejects the expired retry; a new request succeeds');
    } else throw new Error(`Unknown fault: ${journey.fault}`);
  } catch (error) { result.status = 'FAIL'; result.failure = error.message; }
  return result;
}

export function validatePack(journeys, everydayIds) {
  assert.equal(journeys.length, 54, 'Exactly 54 pre-release journeys');
  assert.equal(new Set(journeys.map(journey => journey.id)).size, 54, 'Unique journey IDs');
  assert.equal(everydayIds.length, 13);
  assert.deepEqual(journeys.filter(journey => journey.everyday).map(journey => journey.id), everydayIds);
  assert.equal(journeys.filter(journey => journey.mode === 'live').length, 49);
  for (const [category, count] of [['Shopping', 15], ['Refinement', 10], ['Outfits', 10], ['Difficult conversations', 10], ['Recovery', 5], ['Recommendations', 4]]) {
    assert.equal(journeys.filter(journey => journey.category === category).length, count, `${category}: intended coverage`);
  }
  const operators = new Set(['eq', 'notEq', 'includes', 'oneOf', 'truthy', 'nonempty', 'matches', 'setEq', 'piece', 'issue']);
  for (const journey of journeys) {
    assert.match(journey.id, /^J\d{2}$/);
    assert.ok(journey.expected && journey.review.length);
    if (journey.mode === 'fault') { assert.ok(journey.actions.length); continue; }
    assert.equal(journey.variants.length, 3, `${journey.id}: three opening wordings`);
    assert.equal(new Set(journey.variants).size, 3, `${journey.id}: distinct wordings`);
    assert.equal(journey.turns[0].prompt, journey.variants[0], `${journey.id}: primary opening agrees`);
    const bindings = new Set();
    for (const turn of journey.turns) {
      assert.ok(turn.checks.length, `${journey.id}: explicit assertions on each turn`);
      for (const rule of turn.checks) assert.ok(operators.has(rule.op), `Known operator: ${rule.op}`);
      for (const [, path] of turn.prompt.matchAll(/\{\{([\w.]+)\}\}/g)) assert.ok(bindings.has(path.split('.')[0]), `${journey.id}: binding ${path} exists before use`);
      for (const [, name] of JSON.stringify(turn).matchAll(/"ref":"bindings\.([^."]+)/g)) assert.ok(bindings.has(name), `${journey.id}: assertion binding ${name} exists before use`);
      for (const selector of Object.values(turn.bind ?? {})) {
        if (selector.source !== undefined) assert.ok(['primary', 'complementary'].includes(selector.source), 'Known product binding source');
        assert.ok(Object.keys(selector).every(key => ['index', 'category', 'source', 'excludeAnchor'].includes(key)), 'Known product selector fields');
        assert.ok(Number.isInteger(selector.index) && selector.index >= 0, 'Product binding index is a non-negative integer');
        if (selector.excludeAnchor !== undefined) assert.equal(typeof selector.excludeAnchor, 'boolean');
      }
      if (turn.needComplementary !== undefined) assert.equal(typeof turn.needComplementary, 'boolean');
      if (turn.complementaryBudget !== undefined) assert.equal(turn.complementaryBudget, 'separate');
      Object.keys(turn.bind ?? {}).forEach(binding => bindings.add(binding));
    }
  }
  return { journeys: journeys.length, everyday: everydayIds.length, live: 49, controlled_faults: 5,
    primary_live_turns: journeys.reduce((sum, journey) => sum + journey.turns.length, 0) };
}

export function packSourceHash() {
  return fingerprint(JSON.stringify(['stylist-journeys.mjs', 'proactive-cross-sell-journeys.mjs'].map(file =>
    [file, readFileSync(new URL(`../fixtures/${file}`, import.meta.url), 'utf8')])));
}
