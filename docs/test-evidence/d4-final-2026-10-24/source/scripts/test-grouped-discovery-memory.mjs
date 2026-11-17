import assert from 'node:assert/strict';
import { discoveryCatalogue as rows, product } from './fixtures/customer-scenarios.mjs';
import { emptyShoppingPreferences } from '../lib/stylist/preferenceScope.ts';
import { newSession, makeTurn, acceptReply, TurnReplySchema } from '../lib/stylist/conversationProtocol.ts';
import { finishConversationTurn, shortcutPlan } from '../lib/stylist/conversationTurn.ts';
import { resolveProductReference } from '../lib/stylist/productReference.ts';

const initial = 'I want a dress and shoes for formal events, my budget for both of them is 400 aud';
const item = values => ({ ...emptyShoppingPreferences(), ...values });
const components = [item({ category: 'Clothing', subcategory: 'Dresses' }), item({ category: 'Shoes' })];
const plan = (message, extra = {}) => ({ action: 'new_search', intent_evidence: message, reference: null, changes: [],
  question: null, continuation: false, outfit_request: { total_budget_aud: 400, items: components, evidence: message }, ...extra });
const vocabulary = catalogue => ({ rows: catalogue, sizes: [...new Set(catalogue.flatMap(row => row.sizes_available))],
  categories: catalogue.flatMap(row => [{ category: row.category, subcategory: null }, { category: row.category, subcategory: row.subcategory }]) });
function send(state, message, output = plan(message), catalogue = rows) {
  const turn = makeTurn(state, message);
  const reply = finishConversationTurn(catalogue, turn, output, vocabulary(catalogue));
  return { ...acceptReply(turn, reply), turn };
}
const seed = () => send(newSession(), initial);
let passed = 0;
function check(name, run) { run(); passed++; console.log(`PASS: ${name}`); }

const plentiful = ['Clothing', 'Shoes', 'Bags', 'Accessories'].flatMap(category =>
  Array.from({ length: 6 }, (_, index) => product(`FIVE-${category}-${index}`, category, 40 + index,
    { occasion: 'Formal' })));
check('Plentiful inventory shows exactly five per group and every combination fits the shared budget', () => {
  const { reply } = send(newSession(), initial, plan(initial), plentiful);
  assert.deepEqual(reply.outfit_choices.groups.map(group => group.product_ids.length), [5, 5]);
  assert.equal(reply.products.length, 10);
  for (const dress of reply.outfit_choices.groups[0].product_ids) for (const shoe of reply.outfit_choices.groups[1].product_ids) {
    assert.ok(reply.products.find(row => row.product_id === dress).price_aud +
      reply.products.find(row => row.product_id === shoe).price_aud <= 400);
  }
  const forged = structuredClone(reply);
  forged.outfit_choices.groups[0].product_ids.push('SIXTH-OPTION');
  assert.equal(TurnReplySchema.safeParse(forged).success, false);
});
check('Four groups retain all twenty displayed products in conversation context', () => {
  const message = 'A formal dress, shoes, bag and necklace under 400 AUD total';
  const items = [...components, item({ category: 'Bags' }), item({ category: 'Accessories', product_type: 'Necklace' })];
  const { reply, session } = send(newSession(), message,
    plan(message, { outfit_request: { total_budget_aud: 400, items, evidence: message } }), plentiful);
  assert.deepEqual(reply.outfit_choices.groups.map(group => group.product_ids.length), [5, 5, 5, 5]);
  assert.equal(reply.products.length, 20); assert.equal(session.context.latest.length, 20);
  assert.equal(makeTurn(session, 'Keep browsing').context.latest.length, 20);
});
check('Fifth dress and fifth shoes resolve within their groups, including a pending answer', () => {
  const { session, reply } = send(newSession(), initial, plan(initial), plentiful);
  for (const [index, role] of ['dress', 'shoes'].entries()) {
    const message = `What material is the fifth ${role}?`;
    const answer = { kind: 'product', topics: ['material'], references: [{ kind: 'context' }], purpose: null, continuation: false };
    const next = send(session, message, plan(message, { action: 'none', outfit_request: null, answer }), plentiful);
    assert.equal(next.reply.status, 'answered');
    assert.deepEqual(next.reply.answer_product_ids, [reply.outfit_choices.groups[index].product_ids[4]]);
  }
  const message = 'What material is the dress?';
  const ambiguous = send(session, message, plan(message, { action: 'none', outfit_request: null,
    answer: { kind: 'product', topics: ['material'], references: [{ kind: 'context' }], purpose: null, continuation: false } }), plentiful);
  assert.ok(ambiguous.session.pending_answer);
  const turn = makeTurn(ambiguous.session, 'the fifth dress');
  const answer = finishConversationTurn(plentiful, turn, shortcutPlan(turn), vocabulary(plentiful));
  assert.equal(answer.status, 'answered');
  assert.deepEqual(answer.answer_product_ids, [reply.outfit_choices.groups[0].product_ids[4]]);
});

check('A broad two-item request shows three dresses and three shoes without the removed style questionnaire', () => {
  const { reply, session } = seed();
  assert.equal(reply.status, 'matches'); assert.equal(reply.products.length, 6);
  assert.deepEqual(reply.outfit_choices.groups.map(group => group.product_ids.length), [3, 3]);
  assert.equal(reply.optional_question, null); assert.equal(reply.pending, null);
  assert.equal(session.history.at(-1).content, reply.message.slice(0, 2000));
  for (const component of session.styling.outfit_request.items) {
    assert.equal(component.size, null); assert.equal(component.product_type, null); assert.deepEqual(component.preferred_colours, []);
  }
  assert.equal(session.scopes.item.max_price, null); assert.deepEqual(session.cart_product_ids, []);
});
check('Broad discovery includes different recorded types and colours without inventing constraints', () => {
  const { reply } = seed();
  for (const group of reply.outfit_choices.groups) {
    const products = reply.products.filter(product => group.product_ids.includes(product.product_id));
    assert.equal(new Set(products.map(product => product.product_type)).size, 3);
    assert.equal(new Set(products.map(product => product.colour)).size, 3);
  }
});
check('Every displayed dress/shoe combination meets the shared limit', () => {
  const { reply } = seed(); const [dresses, shoes] = reply.outfit_choices.groups;
  for (const dress of dresses.product_ids) for (const shoe of shoes.product_ids) {
    const total = reply.products.find(product => product.product_id === dress).price_aud + reply.products.find(product => product.product_id === shoe).price_aud;
    assert.ok(total <= 400);
  }
  assert.equal(reply.outfit_budget.total_aud, 180); assert.equal(reply.outfit_choices.maximum_total_aud, 250);
  assert.ok(!reply.products.some(product => ['DISC-OVER', 'DISC-CASUAL'].includes(product.product_id)));
});
check('A tighter budget constrains the highest priced displayed combination', () => {
  const text = 'Dress and shoes for formal events under $240 total';
  const { reply } = send(newSession(), text, plan(text, { outfit_request: { total_budget_aud: 240, items: components, evidence: text } }));
  assert.equal(reply.status, 'matches'); assert.ok(reply.outfit_choices.maximum_total_aud <= 240);
  assert.ok(reply.outfit_choices.groups.every(group => group.product_ids.length >= 1 && group.product_ids.length <= 5));
});
check('A duplicated dress colour cannot become a colour requirement for the shoes', () => {
  const { session } = seed(); const text = 'I would like blue dresses. Keep the shoes as they are and the 400 AUD total.';
  const request = structuredClone(session.styling.outfit_request); request.evidence = text; request.items[0].preferred_colours = ['Blue'];
  const { reply, session: next } = send(session, text, plan(text, { action: 'refine', outfit_request: request,
    changes: [{ scope: 'item', field: 'preferred_colours', operation: 'set', value: ['Blue'], evidence: 'blue dresses' }] }));
  assert.equal(reply.status, 'matches'); assert.deepEqual(next.scopes.item.preferred_colours, []);
  assert.equal(reply.outfit_choices.groups[1].product_ids.length, 3);
  assert.deepEqual(next.styling.outfit_request.items[0].preferred_colours, ['Blue']);
});
check('Keeping both requested item types during a budget edit does not select ambiguous SKUs', () => {
  const { session } = seed(); const text = 'My combined budget is 1 aud. Keep both items.';
  const request = structuredClone(session.styling.outfit_request); request.evidence = text; request.total_budget_aud = 1;
  const { reply, session: next } = send(session, text, plan(text, { action: 'refine', outfit_request: request,
    styling_intent: { preferences: [], outfit_changes: [{ operation: 'keep', reference: { kind: 'context' }, evidence: 'Keep both items' }],
      external_items: [], owned_categories: [], offers: null } }));
  assert.equal(reply.status, 'no_match'); assert.equal(next.styling.outfit_request.total_budget_aud, 1);
  assert.deepEqual(next.styling.outfit, []);
});
check('Sparse inventory returns actual counts rather than padding to five', () => {
  const sparse = rows.filter(product => ['DISC-MIDI', 'DISC-FLATS'].includes(product.product_id));
  const { reply } = send(newSession(), initial, plan(initial), sparse);
  assert.deepEqual(reply.outfit_choices.groups.map(group => group.product_ids.length), [1, 1]);
  assert.equal(reply.products.length, 2);
});
check('Protocol rejects a forged range, over-budget choice or product assigned to the wrong group', () => {
  const { reply } = seed();
  for (const corrupt of [copy => { copy.outfit_choices.maximum_total_aud = 1; },
    copy => { copy.products[2].price_aud = 400; },
    copy => { const groups = copy.outfit_choices.groups; [groups[0].product_ids[1], groups[1].product_ids[1]] = [groups[1].product_ids[1], groups[0].product_ids[1]]; }]) {
    const copy = structuredClone(reply); corrupt(copy); assert.equal(TurnReplySchema.safeParse(copy).success, false);
  }
});
check('Third shoes resolves within its own group, not the global card position', () => {
  const { session, reply } = seed();
  assert.equal(resolveProductReference(session.context, { kind: 'position', position: 3, subcategory: 'Shoes' }).product_id,
    reply.outfit_choices.groups[1].product_ids[2]);
});
const refine = (state, text, edit) => {
  const request = structuredClone(state.styling.outfit_request); request.evidence = text; edit(request);
  return send(state, text, plan(text, { action: 'refine', outfit_request: request }));
};
check('Three understood customer prompts and replies are carried with cumulative requirements', () => {
  let { session } = seed();
  session = refine(session, 'Make the dress blue, keeping the shoes and total.', request => { request.items[0].preferred_colours = ['Blue']; }).session;
  session = refine(session, 'Only flat shoes please; keep the blue dress and total.', request => { request.items[1].subcategory = 'Flats'; }).session;
  assert.equal(session.history.length, 6);
  assert.deepEqual(session.history.filter(row => row.role === 'user').map(row => row.content),
    [initial, 'Make the dress blue, keeping the shoes and total.', 'Only flat shoes please; keep the blue dress and total.']);
  assert.equal(session.styling.outfit_request.total_budget_aud, 400); assert.equal(session.scopes.item.occasion, 'Formal');
  assert.deepEqual(session.styling.outfit_request.items[0].preferred_colours, ['Blue']);
  assert.equal(session.styling.outfit_request.items[1].subcategory, 'Flats');
  assert.equal(session.context.previous.length, 2);
});
check('Repeated unclear intentions cannot evict the last three understood prompts or overwrite state', () => {
  let { session } = seed();
  session = refine(session, 'Make the dress blue, keeping the shoes and total.', request => { request.items[0].preferred_colours = ['Blue']; }).session;
  session = refine(session, 'Only flat shoes please; keep the blue dress and total.', request => { request.items[1].subcategory = 'Flats'; }).session;
  const before = structuredClone(session);
  for (let i = 0; i < 8; i++) {
    const text = `zibble shoes flomp ${i}`;
    const output = plan(text, { action: 'clarify', outfit_request: null, question: 'Which detail would you like to change?',
      changes: [{ scope: 'item', field: 'category', operation: 'set', value: 'Shoes', evidence: 'shoes' }] });
    const next = send(session, text, output);
    assert.equal(next.reply.intent_understood, false); assert.deepEqual(next.reply.products, []);
    assert.deepEqual(next.session.scopes, before.scopes); assert.deepEqual(next.session.styling, before.styling);
    assert.deepEqual(next.session.context, before.context); assert.deepEqual(next.session.history, before.history);
    session = next.session;
  }
  const clear = refine(session, 'Make the combined total $350, keep everything else.', request => { request.total_budget_aud = 350; });
  assert.equal(clear.reply.status, 'matches'); assert.equal(clear.reply.pending, null);
  assert.deepEqual(clear.session.styling.outfit_request.items[0].preferred_colours, ['Blue']);
  assert.equal(clear.session.styling.outfit_request.items[1].subcategory, 'Flats');
});
check('A known product from the first of three result sets remains answerable by exact name', () => {
  let { session } = seed();
  session = refine(session, 'Make the dress blue.', request => { request.items[0].preferred_colours = ['Blue']; }).session;
  session = refine(session, 'Only flat shoes please.', request => { request.items[1].subcategory = 'Flats'; }).session;
  const original = rows.find(product => product.product_id === 'DISC-WRAP');
  const text = `What material is ${original.product_name} from earlier?`;
  const output = plan(text, { action: 'none', outfit_request: null, answer: { kind: 'product', topics: ['material'],
    references: [{ kind: 'name', value: original.product_name }], purpose: null, continuation: false } });
  const { reply, session: next } = send(session, text, output);
  assert.equal(reply.status, 'answered'); assert.deepEqual(reply.answer_product_ids, ['DISC-WRAP']);
  assert.equal(reply.pending_answer, null); assert.deepEqual(next.scopes, session.scopes);
});
check('An unclear reply is not allowed to mutate committed memory at the client boundary', () => {
  const { turn, reply } = seed(); const copy = structuredClone(reply);
  copy.intent_understood = false;
  assert.throws(() => acceptReply(turn, copy), /unclear intention cannot change/);
});
check('New chat clears the history, previous product sets and saved outfit request', () => {
  const state = newSession(); assert.deepEqual(state.history, []); assert.deepEqual(state.context.latest, []);
  assert.equal(state.context.previous, undefined); assert.equal(state.styling.outfit_request, null);
});
console.log(`${passed} grouped-discovery and memory checks passed.`);
