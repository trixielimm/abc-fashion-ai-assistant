import assert from 'node:assert/strict';
import { product } from './fixtures/customer-scenarios.mjs';
import { emptyStylingState } from '../lib/stylist/commerceSchema.ts';
import { emptyShoppingPreferences } from '../lib/stylist/preferenceScope.ts';
import { newSession, makeTurn, acceptReply, snapshot } from '../lib/stylist/conversationProtocol.ts';
import { finishConversationTurn, shortcutPlan } from '../lib/stylist/conversationTurn.ts';
import { dressCodeMessage, dressCodeFromMessage } from '../lib/stylist/dressCode.ts';
import { outfitTotals, suggestedOutfit } from '../lib/stylist/outfitPresentation.ts';

let passed = 0;
function check(name, test) { test(); passed++; console.log(`PASS: ${name}`); }
const preferences = values => ({ ...emptyShoppingPreferences(), ...values });
const dress = preferences({ category: 'Clothing', subcategory: 'Dresses', size: '10' });
const shoes = preferences({ category: 'Shoes', size: '38' });
const message = 'I want a dress and shoes for formal events, my budget for both of them is 400 aud';
const request = { total_budget_aud: 400, items: [dress, shoes], evidence: message };
const state = () => ({ ...emptyStylingState(), outfit_request: request });
const piece = (id, price, ownership = 'selected') => ({ product_id: id, product_name: id, category: 'Clothing', subcategory: 'Dresses', product_type: 'Maxi Dress', price_aud: price, ownership });
const catalogue = [
  product('MAXI', 'Clothing', 240, { occasion: 'Formal', product_type: 'Maxi Dress', colour: 'Lavender' }),
  product('MIDI', 'Clothing', 135, { occasion: 'Formal', colour: 'Sage' }),
  product('MINI', 'Clothing', 160, { occasion: 'Formal', product_type: 'Mini Dress', colour: 'Pink' }),
  product('CREAM', 'Clothing', 75, { occasion: 'Formal', product_type: 'Maxi Dress', colour: 'Cream' }),
  product('HEELS', 'Shoes', 145, { occasion: 'Formal', product_type: 'Strappy Heels', colour: 'Blue' }),
  product('RED', 'Shoes', 60, { occasion: 'Formal', product_type: 'Block Heels', colour: 'Red' }),
  product('LOAFERS', 'Shoes', 90, { occasion: 'Formal', product_type: 'Loafers', subcategory: 'Loafers' }),
];
const vocabulary = rows => ({ rows, sizes: ['10', '12', '38', '39'], categories: rows.flatMap(row => [
  { category: row.category, subcategory: null }, { category: row.category, subcategory: row.subcategory },
]) });
function finish(turn, plan, rows = catalogue) {
  return acceptReply(turn, finishConversationTurn(rows, turn, plan, vocabulary(rows)));
}
const initialTurn = makeTurn(newSession(), message);
const first = finish(initialTurn, { action: 'new_search', intent_evidence: message, reference: null, changes: [], question: null, outfit_request: request });

check('Selected prices total exactly and leave A$15; owned items cost zero', () => {
  const styling = state(); styling.outfit = [piece('D', 240), piece('S', 145), piece('OWNED', 90, 'owned')];
  const totals = outfitTotals(styling);
  assert.equal(totals.total, 385); assert.equal(totals.remaining, 15); assert.equal(totals.selectedCount, 2);
});
check('Cent arithmetic, exact budget and over-budget amounts stay accurate', () => {
  const styling = state(); styling.outfit = [piece('D', 249.99), piece('S', 150.01)];
  assert.equal(outfitTotals(styling).remaining, 0);
  styling.outfit[1].price_aud = 150.02;
  assert.equal(outfitTotals(styling).remaining, -0.01);
});
check('Missing prices cannot masquerade as a verified total or remaining budget', () => {
  const styling = state(); styling.outfit = [piece('UNKNOWN', undefined)];
  assert.equal(outfitTotals(styling).completePrices, false); assert.equal(outfitTotals(styling).remaining, null);
});
check('Empty and fully owned outfits leave the whole new-purchase budget', () => {
  assert.equal(outfitTotals(state()).remaining, 400);
  const styling = state(); styling.outfit = [piece('OWNED', 240, 'owned')];
  assert.equal(outfitTotals(styling).total, 0); assert.equal(outfitTotals(styling).remaining, 400);
});
check('The suggested pairing is complete, affordable and favours a long silhouette with heels', () => {
  const suggestion = suggestedOutfit(first.reply.products, first.reply.outfit_choices, 400);
  assert.ok(suggestion); assert.equal(suggestion.products.length, 2); assert.ok(suggestion.total <= 400);
  assert.equal(suggestion.products[0].product_type, 'Maxi Dress'); assert.match(suggestion.products[1].product_type, /Heels/);
  assert.ok(suggestion.reasons.length); assert.equal(new Set(suggestion.products.map(row => row.product_id)).size, 2);
});
check('Suggestions cannot exceed the limit or omit a requested group', () => {
  assert.equal(suggestedOutfit(first.reply.products, first.reply.outfit_choices, 1), null);
  assert.equal(suggestedOutfit([], first.reply.outfit_choices, 400), null);
});
check('Catalogue occasion is included on cards without fabrication', () => {
  assert.ok(first.reply.products.every(row => row.occasion === catalogue.find(item => item.product_id === row.product_id).occasion));
});
check('Black tie refinement keeps both roles, sizes and shared total, excluding minis and loafers', () => {
  const turn = makeTurn(first.session, dressCodeMessage('black_tie'));
  const next = finish(turn, shortcutPlan(turn));
  assert.equal(next.reply.status, 'matches'); assert.equal(next.session.styling.dress_code, 'black_tie');
  assert.deepEqual(next.session.styling.outfit_request.items, request.items);
  assert.equal(next.reply.outfit_budget.limit_aud, 400);
  assert.ok(next.reply.products.every(row => !/Mini|Loafers/.test(row.product_type)));
  assert.ok(next.reply.products.filter(row => row.category === 'Clothing').every(row => row.product_type === 'Maxi Dress'));
});
check('Wedding guest excludes cream dresses and loafers while dinner permits loafers', () => {
  const weddingTurn = makeTurn(first.session, dressCodeMessage('wedding_guest'));
  const wedding = finish(weddingTurn, shortcutPlan(weddingTurn));
  assert.ok(wedding.reply.products.length);
  assert.ok(wedding.reply.products.every(row => row.product_id !== 'CREAM' && row.product_id !== 'LOAFERS' && row.product_id !== 'MINI'));
  const dinnerTurn = makeTurn(first.session, dressCodeMessage('formal_dinner'));
  const dinner = finish(dinnerTurn, shortcutPlan(dinnerTurn));
  assert.ok(dinner.reply.products.some(row => row.product_id === 'LOAFERS'));
});
check('A dress code without eligible stock returns no match without relaxing the budget', () => {
  const turn = makeTurn(first.session, dressCodeMessage('black_tie'));
  const next = finish(turn, shortcutPlan(turn), catalogue.filter(row => row.product_id === 'MINI' || row.category === 'Shoes'));
  assert.equal(next.reply.status, 'no_match'); assert.deepEqual(next.reply.products, []);
  assert.equal(next.session.styling.outfit_request.total_budget_aud, 400);
  assert.equal(next.session.styling.dress_code, 'black_tie');
});
check('Switching back to any formal event restores the wider shortlist', () => {
  const blackTurn = makeTurn(first.session, dressCodeMessage('black_tie'));
  const black = finish(blackTurn, shortcutPlan(blackTurn));
  const anyTurn = makeTurn(black.session, dressCodeMessage('any_formal'));
  const any = finish(anyTurn, shortcutPlan(anyTurn));
  assert.ok(any.reply.products.some(row => row.product_id === 'MINI'));
  assert.equal(any.session.styling.outfit_request.total_budget_aud, 400);
});
check('Structured dress-code shortcut cannot swallow trailing constraints', () => {
  assert.equal(dressCodeFromMessage(`${dressCodeMessage('black_tie')} And no silk.`), null);
  assert.equal(shortcutPlan(makeTurn(first.session, `${dressCodeMessage('black_tie')} And no silk.`)), null);
});
check('Dress-code refinement preserves independent colours and sizes on every component', () => {
  const saved = structuredClone(first.session);
  saved.styling.outfit_request.items[0].preferred_colours = ['Lavender'];
  saved.styling.outfit_request.items[1].preferred_colours = ['Blue'];
  const turn = makeTurn(saved, dressCodeMessage('black_tie'));
  const next = finish(turn, shortcutPlan(turn));
  assert.equal(next.reply.status, 'matches');
  assert.deepEqual(next.session.styling.outfit_request.items, saved.styling.outfit_request.items);
  assert.deepEqual(next.reply.products.map(row => row.product_id).sort(), ['HEELS', 'MAXI']);
});
check('A new unrelated search clears the outfit dress code and combined request', () => {
  const turn = makeTurn(first.session, dressCodeMessage('black_tie'));
  const black = finish(turn, shortcutPlan(turn));
  const text = 'Find bags under $80.';
  const nextTurn = makeTurn(black.session, text);
  const next = finish(nextTurn, { action: 'new_search', intent_evidence: text, reference: null, question: null, changes: [
    { scope: 'item', field: 'category', operation: 'set', value: 'Bags', evidence: 'bags' },
    { scope: 'item', field: 'max_price', operation: 'set', value: 80, evidence: 'under $80' },
  ] }, [product('BAG', 'Bags', 50)]);
  assert.equal(next.session.styling.dress_code, null);
  assert.equal(next.session.styling.outfit_request, null);
  assert.equal(next.reply.status, 'matches');
});
check('Selection and same-role replacement keep accurate prices without double counting', () => {
  const firstProduct = first.reply.products.find(row => row.product_id === 'MAXI');
  const keepTurn = makeTurn(first.session, `Keep ${firstProduct.product_name} for my outfit.`, snapshot(firstProduct), { kind: 'keep', product_id: firstProduct.product_id });
  const kept = finish(keepTurn, shortcutPlan(keepTurn));
  assert.equal(kept.session.styling.outfit[0].price_aud, 240);
  const other = first.reply.products.find(row => row.product_id === 'MIDI');
  const replaceTurn = makeTurn(kept.session, `Keep ${other.product_name} for my outfit.`, snapshot(other), { kind: 'keep', product_id: other.product_id });
  const replaced = finish(replaceTurn, shortcutPlan(replaceTurn));
  assert.equal(replaced.session.styling.outfit.length, 1); assert.equal(outfitTotals(replaced.session.styling).total, 135);
});
console.log(`${passed} outfit interface checks passed.`);
