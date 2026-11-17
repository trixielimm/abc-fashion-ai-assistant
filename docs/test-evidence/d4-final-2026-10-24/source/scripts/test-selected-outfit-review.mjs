import assert from 'node:assert/strict';
import { product } from './fixtures/customer-scenarios.mjs';
import { newSession, makeTurn, acceptReply, snapshot, TurnReplySchema } from '../lib/stylist/conversationProtocol.ts';
import { finishConversationTurn, shortcutPlan } from '../lib/stylist/conversationTurn.ts';
import { checkConversationPlan } from '../lib/stylist/conversationPlan.ts';
import { resolveAnswerProducts } from '../lib/stylist/conversationAnswers.ts';
import { emptyShoppingPreferences } from '../lib/stylist/preferenceScope.ts';
import { isOutfitReviewQuestion, outfitReviewSections } from '../lib/stylist/outfitReview.ts';

const dress = product('D', 'Clothing', 240, { product_name: 'Lavender Maxi Dress', product_type: 'Maxi Dress', colour: 'Lavender', style: 'Formal', occasion: 'Formal' });
const heels = product('S', 'Shoes', 145, { product_name: 'Blue Strappy Heels', product_type: 'Strappy Heels', colour: 'Blue', style: 'Formal', occasion: 'Formal' });
const other = product('OTHER', 'Clothing', 80, { product_name: 'Unselected Red Mini Dress', colour: 'Red', occasion: 'Casual', product_type: 'Mini Dress' });
const rows = [dress, heels, other];
const question = 'Is my current outfit a good combination?';
const outfitPiece = (row, ownership = 'selected') => ({ ...snapshot(row), ownership });
function seed() {
  const state = newSession();
  state.styling.outfit = [outfitPiece(dress), outfitPiece(heels)];
  state.styling.outfit_request = { total_budget_aud: 400, evidence: 'Dress and shoes under $400 total', items: [
    { ...emptyShoppingPreferences(), category: 'Clothing', subcategory: 'Dresses' },
    { ...emptyShoppingPreferences(), category: 'Shoes' },
  ] };
  state.scopes.item.occasion = 'Formal';
  state.context.latest = [snapshot(other)]; state.context.focused = snapshot(other);
  state.cart_product_ids = ['OTHER'];
  return state;
}
function run(state = seed(), catalogue = rows, message = question, suppliedPlan) {
  const turn = makeTurn(state, message);
  const plan = suppliedPlan ?? shortcutPlan(turn);
  assert.ok(plan);
  const reply = finishConversationTurn(catalogue, turn, plan, { rows: [], sizes: [], categories: [] });
  return { turn, reply, session: acceptReply(turn, reply).session, plan };
}
let passed = 0;
function check(name, test) { test(); passed++; console.log(`PASS: ${name}`); }

check('Common current-outfit opinions, including the supplied wording, use the review intent', () => {
  for (const message of [question, 'is my (current) outfits a good combination)', 'What do you think of my outfit?',
    'Do my selected items go well together?', 'Does this outfit look good?', 'Can you review my outfit?', 'Review my current outfit']) {
    assert.equal(isOutfitReviewQuestion(message), true, message);
    assert.equal(shortcutPlan(makeTurn(seed(), message)).answer.kind, 'outfit_review');
  }
});
check('Compound requests and product comparisons are not swallowed by the shortcut', () => {
  for (const message of ['Review my outfit and find cheaper shoes', 'Is my outfit good for a beach wedding?',
    'Compare the first and second dress', 'Does this dress have pockets?']) {
    assert.equal(isOutfitReviewQuestion(message), false, message);
  }
});
check('The review covers selected pieces instead of the newer shortlist or focused product', () => {
  const { turn, reply, plan } = run();
  assert.deepEqual(resolveAnswerProducts(turn, plan.answer).ids, ['D', 'S']);
  assert.equal(reply.status, 'answered'); assert.equal(reply.action, 'none');
  assert.deepEqual(reply.answer_product_ids, ['D', 'S']);
  assert.deepEqual(reply.products, []); assert.deepEqual(reply.alternatives, []);
  assert.match(reply.message, /Lavender Maxi Dress/); assert.match(reply.message, /Blue Strappy Heels/);
  assert.doesNotMatch(reply.message, /Unselected Red/);
});
check('The answer has exactly three structured sections and an accurate combined budget', () => {
  const { reply } = run();
  assert.deepEqual(Object.keys(reply.outfit_review), ['works', 'considerations', 'limitations']);
  for (const section of outfitReviewSections) assert.ok(reply.message.includes(section.title));
  assert.match(reply.outfit_review.works, /A\$385.00.*A\$15.00.*A\$400.00/);
  assert.match(reply.outfit_review.works, /related palette|dressier direction/);
  assert.match(reply.outfit_review.considerations, /standing or walking/);
  assert.match(reply.outfit_review.limitations, /weather.*fit.*comfort.*shades/s);
});
check('An opinion changes no selection, filters, pending search, cart or shortlist', () => {
  const original = seed(); original.pending = { action: 'refine', reference: null, goal: 'Find a size', question: 'Which size?', before_scopes: original.scopes };
  const before = structuredClone(original);
  const { turn, reply, session } = run(original);
  assert.deepEqual(session.styling, before.styling); assert.deepEqual(session.scopes, before.scopes);
  assert.deepEqual(session.pending, before.pending); assert.deepEqual(session.cart_product_ids, before.cart_product_ids);
  assert.deepEqual(session.context.latest, before.context.latest); assert.deepEqual(reply.pending, turn.pending);
  assert.deepEqual(original, before);
});
check('With no selected pieces the assistant asks for selections, never substitutes displayed cards', () => {
  const state = seed(); state.styling.outfit = [];
  const { reply } = run(state);
  assert.equal(reply.outfit_review, null); assert.deepEqual(reply.answer_product_ids, []);
  assert.match(reply.message, /Select the pieces/); assert.doesNotMatch(reply.message, /Unselected Red/);
});
check('Only one selected piece is explicitly insufficient to judge a combination', () => {
  const state = seed(); state.styling.outfit = [outfitPiece(dress)];
  const { reply } = run(state);
  assert.match(reply.outfit_review.works, /Only one specific piece/);
  assert.match(reply.outfit_review.considerations, /at least one more/);
});
check('Already-owned pieces contribute to styling without being charged again', () => {
  const state = seed(); state.styling.outfit[0].ownership = 'owned';
  const { reply } = run(state);
  assert.match(reply.outfit_review.works, /A\$145.00.*A\$255.00/);
});
check('Customer-described owned pieces can be reviewed with clear evidence limits', () => {
  const state = seed(); state.styling.outfit = [outfitPiece(heels)];
  state.styling.external_items = [{ external_id: 'external-1', source: 'customer_description', description: 'my lavender maxi dress',
    category: 'Clothing', product_type: 'Maxi Dress', colour: 'Lavender', occasion: 'Formal' }];
  const { reply } = run(state);
  assert.match(reply.outfit_review.works, /my lavender maxi dress/);
  assert.match(reply.outfit_review.limitations, /relying on your description/);
  assert.deepEqual(reply.answer_product_ids, ['S']);
});
check('A review based entirely on owned descriptions does not invent catalogue IDs', () => {
  const state = seed(); state.styling.outfit = [];
  state.styling.external_items = [{ external_id: 'external-1', source: 'customer_description', description: 'my navy midi dress',
    category: 'Clothing', product_type: 'Midi Dress', colour: 'Navy', occasion: null },
  { external_id: 'external-2', source: 'customer_description', description: 'my silver heels', category: 'Shoes', product_type: 'Heels', colour: 'Silver', occasion: null }];
  const { reply } = run(state, []);
  assert.ok(reply.outfit_review); assert.deepEqual(reply.answer_product_ids, []); assert.deepEqual(reply.answer_sources, []);
  assert.match(reply.outfit_review.works, /neutral/);
});
check('Missing or identity-changed catalogue records are disclosed instead of hallucinated', () => {
  for (const catalogue of [[heels], [{ ...dress, product_name: 'Changed Product' }, heels]]) {
    const { reply } = run(seed(), catalogue);
    assert.match(reply.outfit_review.considerations, /couldn’t verify.*Lavender Maxi Dress/);
    assert.match(reply.outfit_review.limitations, /incomplete/);
    assert.equal(reply.answer_sources.length, 1);
    assert.doesNotMatch(reply.outfit_review.works, /long dress silhouette/);
  }
});
check('Current prices, availability and exceeding the budget appear as considerations', () => {
  const { reply } = run(seed(), [{ ...dress, price_aud: 300, is_available: false }, heels]);
  assert.match(reply.outfit_review.considerations, /unavailable/);
  assert.match(reply.outfit_review.considerations, /prices have changed/);
  assert.match(reply.outfit_review.considerations, /A\$445.00.*A\$45.00 over/);
});
check('Conflicting dress codes are identified without changing the selected pieces', () => {
  const state = seed(); state.styling.dress_code = 'black_tie'; state.styling.outfit = [outfitPiece(other), outfitPiece(heels)];
  const { reply, session } = run(state);
  assert.match(reply.outfit_review.considerations, /outside the current Black tie filter/);
  assert.deepEqual(session.styling.outfit, state.styling.outfit);
});
check('The review immediately reflects replacements and removals in the selected outfit', () => {
  const state = seed(); state.context.latest = rows.map(snapshot);
  const keep = makeTurn(state, 'Keep Unselected Red Mini Dress for my outfit.', snapshot(other), { kind: 'keep', product_id: 'OTHER' });
  const changed = acceptReply(keep, finishConversationTurn(rows, keep, shortcutPlan(keep), { rows: [], sizes: [], categories: [] })).session;
  const { reply } = run(changed);
  assert.deepEqual(reply.answer_product_ids, ['S', 'OTHER']); assert.doesNotMatch(reply.message, /Lavender Maxi Dress/);
});
check('Eight selected catalogue pieces are all reviewed and cited', () => {
  const catalogue = Array.from({ length: 8 }, (_, index) => ({ ...dress, product_id: `P${index}`, product_name: `Piece ${index}` }));
  const state = seed(); state.styling.outfit = catalogue.map(row => outfitPiece(row));
  const { reply } = run(state, catalogue);
  assert.equal(reply.answer_product_ids.length, 8); assert.equal(reply.answer_sources.length, 8);
});
check('An explicit event is review context only and does not become a saved filter', () => {
  const message = 'Would my selected outfit work together for a wedding?';
  const state = seed(); const turn = makeTurn(state, message);
  const plan = { action: 'none', intent_evidence: message, reference: null, changes: [], question: null, continuation: false,
    answer: { kind: 'outfit_review', topics: ['recommendation'], references: [], purpose: 'wedding', continuation: false } };
  const { reply, session } = run(state, rows, message, plan);
  assert.match(reply.outfit_review.considerations, /not recorded for wedding/);
  assert.deepEqual(session.scopes, turn.scopes);
});
check('Outfit opinions cannot silently select pieces or search for replacements', () => {
  const { turn, plan } = run();
  assert.throws(() => checkConversationPlan(turn, { ...plan, action: 'new_search' }), /outfit review/);
  assert.throws(() => checkConversationPlan(turn, { ...plan, styling_intent: { preferences: [], outfit_changes: [], owned_categories: [], offers: null } }), /outfit review/);
});
check('The reply contract rejects shopping results and reviews of unselected IDs', () => {
  const { turn, reply } = run();
  assert.equal(TurnReplySchema.safeParse({ ...reply, status: 'no_action' }).success, false);
  assert.throws(() => acceptReply(turn, { ...reply, answer_product_ids: ['OTHER'] }), /current selected pieces/);
  const modified = structuredClone(reply); modified.styling.outfit.pop();
  assert.throws(() => acceptReply(turn, modified), /without changing/);
});
console.log(`${passed} selected outfit review checks passed.`);
