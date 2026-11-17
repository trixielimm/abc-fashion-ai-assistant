import assert from 'node:assert/strict';
import { product } from './fixtures/customer-scenarios.mjs';
import { emptyShoppingPreferences } from '../lib/stylist/preferenceScope.ts';
import { checkConversationPlan } from '../lib/stylist/conversationPlan.ts';
import { finishConversationTurn } from '../lib/stylist/conversationTurn.ts';
import { newSession, makeTurn, acceptReply, TurnReplySchema } from '../lib/stylist/conversationProtocol.ts';

const message = 'I want a dress and shoes for formal events, my budget for both of them is 400 aud';
const item = values => ({ ...emptyShoppingPreferences(), ...values });
const dress = item({ category: 'Clothing', subcategory: 'Dresses' });
const shoes = item({ category: 'Shoes' });
const bag = item({ category: 'Bags' });
const outfit = (evidence = message, total = 400, items = [dress, shoes]) => ({ total_budget_aud: total, items, evidence });
const plan = (text = message, request = outfit(text), changes = []) => ({ action: 'new_search',
  intent_evidence: text, reference: null, changes, question: null, outfit_request: request });
const change = (field, value, evidence) => ({ scope: 'item', field, value, evidence, operation: 'set' });
const formal = (id, category, price, options = {}) => product(id, category, price, { occasion: 'Formal', ...options });
const rows = [formal('D250', 'Clothing', 250), formal('S150', 'Shoes', 150), formal('D350', 'Clothing', 350),
  formal('S200', 'Shoes', 200), formal('B50', 'Bags', 50), formal('CASUAL', 'Clothing', 1, { occasion: 'Casual' }),
  formal('UNAVAILABLE', 'Shoes', 1, { is_available: false }), formal('EMPTY', 'Shoes', 1, { stock_qty: 0 })];
const vocabulary = catalogue => ({ rows: catalogue, sizes: [...new Set(catalogue.flatMap(row => row.sizes_available))],
  categories: catalogue.flatMap(row => [{ category: row.category, subcategory: null }, { category: row.category, subcategory: row.subcategory }]) });
const run = (output = plan(), catalogue = rows, state = newSession(), text = message) => {
  const turn = makeTurn(state, text);
  const reply = finishConversationTurn(catalogue, turn, output, vocabulary(catalogue));
  return acceptReply(turn, reply);
};
let passed = 0;
function check(name, test) { test(); passed++; console.log(`PASS: ${name}`); }

check('Exact customer request returns a complete formal set at the inclusive A$400 boundary', () => {
  const { reply, session } = run(plan(message, outfit(), [change('occasion', 'Formal', 'formal')]));
  assert.equal(reply.status, 'matches');
  assert.deepEqual(reply.products.map(row => row.product_id), ['D250', 'S150']);
  assert.equal(reply.outfit_budget.total_aud, 400); assert.equal(reply.outfit_budget.remaining_aud, 0);
  assert.equal(session.styling.outfit_request.total_budget_aud, 400);
  assert.equal(session.scopes.item.max_price, null); assert.equal(session.scopes.item.category, null);
  assert.match(reply.message, /Choose one item from each group/i); assert.match(reply.message, /A\$400.00 combined budget/);
  assert.deepEqual(session.styling.outfit, []); assert.deepEqual(session.cart_product_ids, []);
});
check('Individually affordable items whose sum exceeds the total are not recommended', () => {
  const { reply } = run(plan(), [formal('D300', 'Clothing', 300), formal('S200', 'Shoes', 200)]);
  assert.equal(reply.status, 'no_match'); assert.deepEqual(reply.products, []);
  assert.match(reply.message, /A\$400.00 combined budget/); assert.equal(reply.outfit_budget, null);
});
check('A feasible cheap candidate beyond the ordinary top four is still considered', () => {
  const catalogue = [...Array.from({ length: 6 }, (_, i) => formal(`EXP${i}`, 'Clothing', 395 + i, { stock_qty: 100 })),
    formal('CHEAP', 'Clothing', 200, { stock_qty: 1 }), formal('SHOE', 'Shoes', 150)];
  assert.deepEqual(run(plan(), catalogue).reply.products.map(row => row.product_id), ['CHEAP', 'SHOE']);
});
check('Three requested components must all fit the same total', () => {
  const text = 'Find a dress, shoes and a bag under $450 total.';
  const { reply } = run(plan(text, outfit(text, 450, [dress, shoes, bag])), rows.filter(row => row.occasion === 'Formal'), newSession(), text);
  assert.equal(reply.products.length, 3); assert.equal(reply.outfit_budget.total_aud, 450);
});
check('Missing shoe stock cannot be presented as a complete outfit', () => {
  const { reply } = run(plan(), rows.map(row => row.category === 'Shoes' ? { ...row, is_available: false } : row));
  assert.equal(reply.status, 'no_match'); assert.deepEqual(reply.products, []); assert.match(reply.message, /Shoes/);
});
check('Each component retains its own colour and size', () => {
  const text = 'Find a black dress in size 10 and silver shoes in size 38 under $400 total.';
  const request = outfit(text, 400, [item({ ...dress, preferred_colours: ['Black'], size: '10' }),
    item({ ...shoes, preferred_colours: ['Silver'], size: '38' })]);
  const catalogue = [formal('D', 'Clothing', 220), formal('S', 'Shoes', 120, { colour: 'Silver' }),
    formal('WRONG', 'Shoes', 1, { colour: 'Black' })];
  const { reply } = run(plan(text, request), catalogue, newSession(), text);
  assert.deepEqual(reply.products.map(row => row.product_id), ['D', 'S']);
  assert.deepEqual(reply.outfit_budget.items.map(row => row.preferences.size), ['10', '38']);
});
check('Budget refinement keeps both roles and the formal occasion', () => {
  const first = run(plan(message, outfit(), [change('occasion', 'Formal', 'formal')]));
  const text = 'Make the combined budget $350 instead. Keep everything else.';
  const nextPlan = { ...plan(text, outfit(text, 350)), action: 'refine' };
  const next = run(nextPlan, rows, first.session, text);
  assert.equal(next.reply.status, 'no_match'); assert.equal(next.session.styling.outfit_request.items.length, 2);
  assert.equal(next.session.scopes.item.occasion, 'Formal'); assert.equal(next.session.styling.outfit_request.total_budget_aud, 350);
});
check('A new single-item search clears the combined request', () => {
  const first = run(); const text = 'Forget the outfit. Show me bags under $80.';
  const next = run(plan(text, null, [change('category', 'Bags', 'bags'), change('max_price', 80, 'under $80')]), rows, first.session, text);
  assert.equal(next.session.styling.outfit_request, null); assert.equal(next.reply.outfit_budget, null);
  assert.ok(next.reply.products.every(row => row.category === 'Bags'));
});
check('Restoring the budget after no match is a refinement, not a pending continuation', () => {
  const first = run();
  const lower = 'Make the combined budget $1.';
  const noMatch = run({ ...plan(lower, outfit(lower, 1)), action: 'refine' }, rows, first.session, lower);
  const restore = 'Make the combined budget 400 aud again, keeping everything else.';
  const next = run({ ...plan(restore, outfit(restore, 400)), action: 'refine', continuation: true }, rows, noMatch.session, restore);
  assert.equal(next.reply.status, 'matches'); assert.equal(next.reply.outfit_budget.total_aud, 400);
  assert.equal(next.reply.pending, null);
});
check('Context for the requested outfit does not become a global restriction', () => {
  const output = plan(message, outfit(), [{ ...change('occasion', 'Formal', 'formal'), scope: 'shared' }]);
  const first = run(output);
  assert.equal(first.session.scopes.shared.occasion, null); assert.equal(first.session.scopes.item.occasion, 'Formal');
  const text = 'Forget the outfit. Show me a bag for casual use under $80.';
  const next = run(plan(text, null, [change('category', 'Bags', 'bag'), change('occasion', 'Casual', 'casual'),
    change('max_price', 80, 'under $80')]), rows, first.session, text);
  assert.equal(next.session.scopes.item.occasion, 'Casual'); assert.equal(next.session.scopes.shared.occasion, null);
});
check('Currency arithmetic is exact at the cent boundary', () => {
  const text = 'Dress and shoes under $400 total';
  const catalogue = [formal('D', 'Clothing', 249.99), formal('S', 'Shoes', 150.01)];
  assert.equal(run(plan(text, outfit(text)), catalogue, newSession(), text).reply.outfit_budget.total_aud, 400);
  catalogue[1].price_aud = 150.02;
  assert.equal(run(plan(text, outfit(text)), catalogue, newSession(), text).reply.status, 'no_match');
});
check('Cart and rejected items remain excluded from the complete set', () => {
  const state = newSession(); state.cart_product_ids = ['D250']; state.styling.rejected_ids = ['S150'];
  assert.equal(run(plan(), rows, state).reply.status, 'no_match');
});
check('A schema-valid single-item plan cannot silently swallow the combined request', () => {
  assert.throws(() => checkConversationPlan({ message }, plan(message, null, [change('category', 'Clothing', 'dress')])), /Use outfit_request/);
});
check('Missing requested roles and invented total amounts are rejected', () => {
  assert.throws(() => checkConversationPlan({ message }, plan(message, outfit(message, 400, [dress, bag]))), /every explicitly requested/);
  assert.throws(() => checkConversationPlan({ message }, plan(message, outfit(message, 500))), /combined budget must be stated/);
});
check('The protocol rejects a forged total, incomplete set or over-budget prices', () => {
  const { reply } = run();
  for (const corrupt of [value => { value.outfit_budget.total_aud = 300; }, value => { value.products.pop(); },
    value => { value.products[0].price_aud = 400; }, value => { value.outfit_budget.items.reverse(); value.outfit_budget.items[0].product_id = value.outfit_budget.items[1].product_id; }]) {
    const copy = structuredClone(reply); corrupt(copy); assert.equal(TurnReplySchema.safeParse(copy).success, false);
  }
});
check('Unknown requirements still block retrieval rather than being dropped for an outfit', () => {
  const text = `${message}, but no leather`;
  const output = plan(text, outfit(text), [{ scope: 'item', field: 'unresolved', operation: 'add', value: ['no leather'], evidence: 'no leather' }]);
  const { reply } = run(output, rows, newSession(), text);
  assert.equal(reply.status, 'needs_clarification'); assert.deepEqual(reply.products, []);
});
check('A factual question resolves the unique dress within a mixed-item set', () => {
  const first = run(); const text = 'What material is the dress in this set?';
  const output = { ...plan(text, null), action: 'none', answer: { kind: 'product', topics: ['material'],
    references: [{ kind: 'context' }], purpose: null, continuation: false } };
  const { reply } = run(output, rows, first.session, text);
  assert.equal(reply.status, 'answered'); assert.deepEqual(reply.answer_product_ids, ['D250']);
  assert.equal(reply.pending_answer, null); assert.match(reply.message, /Polyester/);
});
console.log(`${passed} outfit-budget checks passed.`);
