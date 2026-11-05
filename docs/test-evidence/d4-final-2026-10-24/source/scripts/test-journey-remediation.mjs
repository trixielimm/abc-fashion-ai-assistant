import assert from 'node:assert/strict';
import { product } from './fixtures/customer-scenarios.mjs';
import { emptyShoppingPreferences } from '../lib/stylist/preferenceScope.ts';
import { newSession, makeTurn, acceptReply, snapshot } from '../lib/stylist/conversationProtocol.ts';
import { checkConversationPlan } from '../lib/stylist/conversationPlan.ts';
import { finishConversationTurn, shortcutPlan } from '../lib/stylist/conversationTurn.ts';
import { statedCombinedBudget } from '../lib/stylist/combinedShoppingRequest.ts';
import { issue } from '../lib/stylist/conversationIssues.ts';
import { shoppingRequestSummary } from '../lib/stylist/requestPresentation.ts';
import { searchCheaper } from '../lib/search/cheaperSearch.ts';

const dress = product('FIX-DRESS', 'Clothing', 120, { product_name: 'Test Black Midi Dress', gender: 'Women', occasion: 'Formal', cross_sell_category: 'Shoes' });
const blue = product('FIX-BLUE', 'Clothing', 90, { product_name: 'Test Blue Wrap Dress', colour: 'Blue', material: 'Cotton', occasion: 'Formal' });
const shoe = product('FIX-SHOE', 'Shoes', 60, { gender: 'Women', sizes_available: ['7'], occasion: 'Formal' });
const bag = product('FIX-BAG', 'Bags', 40, { gender: 'Women', occasion: 'Formal' });
const shirt = product('FIX-SHIRT', 'Clothing', 80, { product_type: 'Shirt', subcategory: 'Tops', occasion: 'Travel' });
const jacket = product('FIX-JACKET', 'Clothing', 100, { product_type: 'Jacket', subcategory: 'Outerwear', occasion: 'Travel' });
const rows = [dress, blue, shoe, bag, shirt, jacket];
const vocabulary = { rows, sizes: ['10', '12', '7'], categories: [...['Clothing', 'Shoes', 'Bags'].map(category => ({ category, subcategory: null })), ...rows.map(row => ({ category: row.category, subcategory: row.subcategory }))] };
const prefs = overrides => ({ ...emptyShoppingPreferences(), ...overrides });
const change = (field, value, evidence, scope = 'item') => ({ scope, field, value, operation: 'set', evidence });
const plan = (message, extra = {}) => ({ action: 'refine', intent_evidence: message, reference: null, changes: [], question: null, continuation: false, ...extra });
function send(session, message, output, catalogue = rows) {
  const turn = makeTurn(session, message);
  return acceptReply(turn, finishConversationTurn(catalogue, turn, output ?? shortcutPlan(turn) ?? plan(message), vocabulary));
}
function session() { const s = newSession(); s.collection.choice = 'Women'; return s; }
let passed = 0;
function check(name, run) { run(); passed++; console.log(`PASS: ${name}`); }

check('Combined totals support natural word order without mistaking each, negated totals or product prices for the budget', () => {
  for (const text of ['A$300 for all new pieces together', '300 AUD combined', 'A$300 is the total for the dress and new shoes together', 'combined budget is A$300', 'A$300 total']) assert.equal(statedCombinedBudget(text), 300, text);
  for (const text of ['A$300 each', 'A$300 per item', 'Not A$300 total', 'This dress costs A$300', 'Size 10 and size 7']) assert.equal(statedCombinedBudget(text), null, text);
  assert.equal(statedCombinedBudget('The dress costs A$120. My total budget is A$400.'), 400);
});
check('Cheaper cannot clear the saved cap, but explicit removal is supported', () => {
  const s = session(); s.scopes.item = prefs({ category: 'Clothing', subcategory: 'Bottoms', product_type: 'Skirt', occasion: 'Work', max_price: 200 });
  const m = 'Show cheaper skirts, keeping work.';
  assert.throws(() => checkConversationPlan(makeTurn(s, m), plan(m, { action: 'cheaper', changes: [change('max_price', null, 'cheaper')] })), /explicit permission/);
  const remove = 'Remove the budget cap.';
  assert.equal(checkConversationPlan(makeTurn(s, remove), plan(remove, { changes: [change('max_price', null, 'Remove the budget cap')] })).proposed_scopes.item.max_price, null);
  assert.throws(() => checkConversationPlan(makeTurn(s, "Don't remove the budget cap."), plan("Don't remove the budget cap.", { changes: [change('max_price', null, 'budget cap')] })), /explicit permission/);
});
check('Travel guidance and a together budget survive without a bare-travel certification blocker', () => {
  const m = "I need women's travel clothes for warm afternoons and cool evenings, A$300 for all new pieces together.";
  const first = send(session(), m, plan(m, { action: 'discover', discovery_intent: 'everyday', changes: [{ scope: 'item', field: 'unresolved', operation: 'add', value: ['travel'], evidence: 'travel' }] }));
  assert.equal(first.session.task.brief.total_budget_aud, 300);
  assert.equal(first.session.task.brief.goal, 'travel_layers');
  assert.ok(!first.reply.issues.some(value => value.value === 'travel'));
  const second = send(first.session, "Let's find a women's shirt and jacket, A$300 combined for those two pieces.");
  assert.equal(second.reply.outfit_budget.limit_aud, 300); assert.equal(second.reply.outfit_choices.groups.length, 2);
});
check('A pending new-search size blocker accepts a correction instead of rejecting its continuation action', () => {
  const s = session(); s.scopes.item = prefs({ gender: 'Women', category: 'Shoes', preferred_colours: ['Black'], size: '999', max_price: 150 });
  s.task.issues = [issue('invalid_preference', 'size', 'item', '999')];
  s.pending = { action: 'new_search', reference: null, goal: 'Find shoes.', question: 'Change the invalid size.', before_scopes: structuredClone(s.scopes) };
  const m = 'Change the shoe size to 7. Keep black and A$150.';
  const result = send(s, m, plan(m, { action: 'new_search', continuation: true, changes: [change('size', '7', 'size to 7')] }));
  assert.equal(result.session.scopes.item.size, '7'); assert.equal(result.session.scopes.item.max_price, 150);
  assert.deepEqual(result.session.scopes.item.preferred_colours, ['Black']); assert.equal(result.reply.status, 'matches'); assert.equal(result.session.pending, null);
});
check('New blue results are compared after searching, without asking which old shortlist is meant', () => {
  const s = session(); s.context.latest = [snapshot(dress), snapshot(blue)]; s.scopes.item = prefs({ gender: 'Women', category: 'Clothing', subcategory: 'Dresses', max_price: 200 });
  const m = 'Show me blue dresses under A$150 and explain how they differ from Test Black Midi Dress.';
  const r = send(s, m, plan(m, { changes: [], answer: { kind: 'compare', topics: ['price', 'material', 'general'], references: [{ kind: 'name', value: dress.product_name }, { kind: 'context' }], purpose: null, continuation: false } }));
  assert.equal(r.session.scopes.item.max_price, 150); assert.deepEqual(r.session.scopes.item.preferred_colours, ['Blue']);
  assert.deepEqual(r.reply.products.map(row => row.product_id), ['FIX-BLUE']); assert.equal(r.reply.pending_answer, null);
  assert.deepEqual(new Set(r.reply.answer_product_ids), new Set(['FIX-DRESS', 'FIX-BLUE'])); assert.match(r.reply.message, /costs A\$30\.00 less/);
});
check('A genuinely ambiguous comparison anchor still pauses and resumes the saved search after clarification', () => {
  const duplicate = product('FIX-DUPLICATE', 'Clothing', 140, { ...dress, product_id: 'FIX-DUPLICATE' });
  const catalogue = [...rows, duplicate];
  const s = session(); s.context.latest = [snapshot(dress), snapshot(duplicate)]; s.scopes.item = prefs({ gender: 'Women', category: 'Clothing', subcategory: 'Dresses', max_price: 200 });
  const m = 'Show blue dresses under A$150 and explain how they differ from Test Black Midi Dress.';
  const first = send(s, m, plan(m, { answer: { kind: 'compare', topics: ['price'], references: [{ kind: 'name', value: dress.product_name }], purpose: null, continuation: false, compare_new_results: true } }), catalogue);
  assert.ok(first.reply.pending_answer); assert.equal(first.reply.products.length, 0);
  const second = send(first.session, 'The first dress.', undefined, catalogue);
  assert.equal(second.reply.pending_answer, null); assert.ok(second.reply.products.length); assert.deepEqual(new Set(second.reply.answer_product_ids), new Set(['FIX-DRESS', 'FIX-BLUE']));
});
check('Selected dress plus new shoes consumes the total once and clears the old dress cap', () => {
  const s = session(); s.context.latest = [snapshot(dress)]; s.styling.outfit = [{ ...snapshot(dress), ownership: 'selected' }];
  s.scopes.item = prefs({ gender: 'Women', category: 'Clothing', subcategory: 'Dresses', max_price: 200 });
  const m = "Find women's shoes to match my kept dress. A$400 is the total for the dress and new shoes together.";
  const r = send(s, m, plan(m, { action: 'cross_sell', outfit_request: { total_budget_aud: 400, evidence: m, items: [prefs({ category: 'Clothing', subcategory: 'Dresses' }), prefs({ category: 'Shoes' })] } }));
  assert.equal(r.reply.action, 'cross_sell'); assert.equal(r.reply.styling.outfit_request, null);
  assert.equal(r.reply.purchase_budget.fixed_total_aud, 120); assert.equal(r.reply.purchase_budget.remaining_aud, 280);
  assert.ok(r.reply.products.length, r.reply.message);
  assert.ok(r.reply.products.every(product => product.category === 'Shoes' && product.price_aud <= 280));
});
check('An external owned anchor and ambiguous cap produce a typed yes/no confirmation that Yes can complete', () => {
  const m = "I own a navy midi dress from another shop. Find women's shoes and a bag for formal events, under A$200.";
  const description = 'a navy midi dress from another shop';
  const first = send(session(), m, plan(m, { action: 'cross_sell', outfit_request: { total_budget_aud: 200, evidence: m, items: [prefs({ category: 'Shoes' }), prefs({ category: 'Bags' })] },
    styling_intent: { preferences: [], outfit_changes: [], owned_categories: [], offers: null, external_items: [{ description, category: 'Clothing', product_type: 'midi dress', colour: 'navy', occasion: null, operation: 'add' }] } }));
  assert.equal(first.reply.status, 'needs_clarification'); assert.equal(first.reply.products.length, 0); assert.match(first.reply.message, /combined total/);
  assert.equal(first.session.pending.budget_confirmation.total_budget_aud, 200); assert.equal(first.session.styling.external_items.length, 1);
  const second = send(first.session, 'Yes.');
  assert.equal(second.session.pending, null); assert.ok(second.reply.outfit_choices, JSON.stringify({ status: second.reply.status, message: second.reply.message, preferences: second.reply.applied_preferences })); assert.equal(second.reply.outfit_choices.groups.length, 2); assert.equal(second.reply.outfit_budget.limit_aud, 200);
  assert.equal(second.session.styling.external_items.length, 1);
  const each = send(first.session, 'No, A$200 per item.');
  assert.equal(each.reply.outfit_budget.limit_aud, 400);
  assert.ok(each.session.styling.outfit_request.items.every(item => item.max_price === 200));
  assert.equal(each.session.styling.external_items.length, 1);
});
check('Named delivery and returns policy questions resolve the product without rewriting the saved search', () => {
  for (const [topic, text, expected] of [['delivery', 'Can Test Black Midi Dress arrive by Friday?', /can.t confirm arrival by Friday/], ['returns', 'Can I return Test Black Midi Dress? Is return postage free?', /can.t confirm/]]) {
    const s = session(); s.context.latest = [snapshot(dress)]; s.scopes.item = prefs({ category: 'Clothing', max_price: 200 });
    const r = send(s, text, plan(text, { action: 'none', reference: { kind: 'name', value: dress.product_name }, answer: { kind: 'policy', topics: [topic], references: [{ kind: 'name', value: dress.product_name }], purpose: null, continuation: false } }));
    assert.equal(r.reply.status, 'answered'); assert.deepEqual(r.reply.answer_product_ids, ['FIX-DRESS']); assert.match(r.reply.message, expected); assert.deepEqual(r.session.scopes, s.scopes);
  }
});
check('Global Black survives all openings, conflicts with Blue, and can be explicitly released', () => {
  const openings = ["Only recommend black items for all searches. Show me women's dresses under A$200.", "For every recommendation, black only. Find women's dresses under A$200.", "Set black as a rule for all items, then show women's dresses under A$200."];
  for (const m of openings) {
    const first = send(session(), m, plan(m, { action: 'new_search' }));
    assert.deepEqual(first.session.scopes.shared.preferred_colours, ['Black']); assert.equal(first.session.scopes.shared.max_price, null);
    const conflict = 'Show me a blue dress instead, but keep the shared black-only rule.';
    const second = send(first.session, conflict, plan(conflict, { action: 'clarify', question: 'Which rule should change?' })); assert.equal(second.reply.status, 'needs_clarification'); assert.ok(second.reply.issues.some(value => value.code === 'shared_conflict'));
    const remove = 'Remove the shared black-only colour rule. Show blue dresses under A$200.';
    const third = send(second.session, remove, plan(remove, { changes: [change('preferred_colours', [], 'Remove the shared black-only colour rule', 'shared')] }));
    assert.deepEqual(third.session.scopes.shared.preferred_colours, []); assert.deepEqual(third.session.scopes.item.preferred_colours, ['Blue']); assert.equal(third.reply.status, 'matches');
  }
});
check('The UI summary distinguishes global restrictions, per-item limits and combined totals', () => {
  const s = session(); s.scopes.item = prefs({ category: 'Shoes', size: '7', max_price: 150 }); s.scopes.shared.preferred_colours = ['Black'];
  s.styling.purchase_budget = { limit_aud: 400, product_ids: ['FIX-DRESS'] };
  const summary = shoppingRequestSummary(s); assert.ok(summary.shared.includes('Black only'));
  assert.ok(summary.item.includes('Up to A$150.00 per item')); assert.ok(summary.item.includes('A$400.00 combined budget')); assert.ok(summary.item.includes('Size 7'));
});
check('A trailing max cap is grounded even when the model omits it', () => {
  for (const [m, cap] of [["Women's dresses, A$200 max please.", 200], ["Women's black dresses, 150 AUD maximum.", 150]]) {
    const r = send(session(), m, plan(m, { action: 'new_search' }));
    assert.equal(r.session.scopes.item.max_price, cap);
  }
});
check('Cheaper accepts all five displayed references and searches below the lowest price', () => {
  const references = [150, 145, 140, 135, 130].map((price, index) => product(`REF-${index}`, 'Clothing', price, { occasion: 'Formal' }));
  const candidate = product('CHEAPER-FIVE', 'Clothing', 90, { occasion: 'Formal' });
  const result = searchCheaper([...references, candidate], prefs({ gender: 'Women', category: 'Clothing', subcategory: 'Dresses', max_price: 200 }),
    references.map(p => ({ product_id: p.product_id, displayed_price_aud: p.price_aud })), vocabulary);
  assert.equal(result.status, 'matches'); assert.deepEqual(result.products.map(p => p.product_id), ['CHEAPER-FIVE']);
});
check('A beach-wedding brief is retained through optional browsing wording and Work skirts retain their occasion', () => {
  for (const m of ["Help me find a women's beach wedding dress, under 200 AUD. Size and colour undecided.", "Women's beach-wedding dress, A$200 max; can I browse before choosing size or colour?"]) {
    const r = send(session(), m, plan(m, { action: 'new_search', changes: [change('gender', 'Women', "women's".replace('w', m.startsWith('Women') ? 'W' : 'w')), change('occasion', 'Wedding Guest', m.includes('beach-wedding') ? 'beach-wedding' : 'beach wedding')] }));
    assert.equal(r.session.scopes.item.occasion, 'Beach Wedding'); assert.equal(r.session.scopes.item.subcategory, 'Dresses'); assert.equal(r.session.scopes.item.max_price, 200);
  }
  const m = 'Work skirts, A$200 maximum.';
  const r = checkConversationPlan(makeTurn(session(), m), plan(m, { action: 'new_search' }));
  assert.equal(r.proposed_scopes.item.occasion, 'Work');
});
check('Reaffirming firm limits after no-match reruns the exact saved brief instead of becoming unrecognised input', () => {
  const s = session(); s.scopes.item = prefs({ gender: 'Women', category: 'Clothing', subcategory: 'Dresses', preferred_colours: ['Blue'], size: '10', max_price: 1 });
  const m = 'Keep blue, size 10 and A$1 as firm limits. Do not substitute anything.';
  const r = send(s, m, plan(m, { action: 'none' }));
  assert.equal(r.reply.status, 'no_match'); assert.equal(r.reply.intent_understood, true); assert.deepEqual(r.session.scopes, s.scopes);
});
check('Provisional consent cannot delete a saved unknown requirement', () => {
  const s = session(); s.scopes.item = prefs({ gender: 'Women', category: 'Shoes', preferred_colours: ['Black'], max_price: 150 }); s.scopes.unresolved_item = ['verified waterproof'];
  const m = 'Browse provisional options with waterproofing unverified. Keep black and A$150.';
  const r = send(s, m, plan(m, { changes: [{ scope: 'item', field: 'unresolved', operation: 'remove', value: ['verified waterproof'], evidence: 'waterproofing unverified' }] }));
  assert.deepEqual(r.session.scopes.unresolved_item, ['verified waterproof']);
  assert.deepEqual(r.reply.unverified_requirements, ['verified waterproof']);
  assert.ok(r.reply.alternatives.length); assert.ok(r.reply.alternatives.every(product => product.unverified_requirements.includes('verified waterproof')));
});
console.log(`${passed} journey-remediation checks passed.`);
