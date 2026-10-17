import assert from 'node:assert/strict';
import { catalogue, fixtures } from './fixtures/customer-scenarios.mjs';
import { checkConversationPlan } from '../lib/stylist/conversationPlan.ts';
import { newSession, makeTurn, snapshot, acceptReply } from '../lib/stylist/conversationProtocol.ts';
import { finishConversationTurn, shortcutPlan } from '../lib/stylist/conversationTurn.ts';
import { decodeModelPlan } from '../lib/ai/conversationModelPlan.ts';
import { resolveProductReference } from '../lib/stylist/productReference.ts';

const vocabulary = rows => ({ rows, sizes: [...new Set(rows.flatMap(row => row.sizes_available))],
  categories: [...new Map(rows.flatMap(row => [{ category: row.category, subcategory: null },
    { category: row.category, subcategory: row.subcategory }]).map(row => [JSON.stringify(row), row])).values()] });
const change = (field, value, evidence) => ({ scope: 'item', field, value, evidence, operation: 'set' });
const intent = extra => ({ preferences: [], outfit_changes: [], external_items: [], owned_categories: [], offers: null, ...extra });
const plan = (message, extra) => ({ action: 'none', intent_evidence: message.slice(0, 250), changes: [], reference: null,
  question: null, continuation: false, ...extra });
const visible = reply => [...reply.products, ...reply.alternatives];
const send = (state, message, output, rows = catalogue, focus = null) => {
  const turn = makeTurn(state, message, focus);
  const reply = finishConversationTurn(rows, turn, output, vocabulary(rows));
  return acceptReply(turn, reply);
};
const dress = catalogue.find(row => row.product_id === 'D-BLACK-120');
const bag = catalogue.find(row => row.product_id === 'B-ZIP-60');
const seed = () => {
  const state = newSession(); state.context.latest = [snapshot(dress), snapshot(bag)]; return state;
};
const beachRequest = "I need a dress for a beach wedding under $150, but I don't know which colour or style.";
let passed = 0;
async function check(name, run) { await run(); passed++; console.log(`PASS: ${name}`); }

await check('An explicit occasion survives even if the model omits it from an otherwise clear broad brief', () => {
  const { reply, session } = send(newSession(), beachRequest, plan(beachRequest, { action: 'new_search', changes: [
    change('category', 'Clothing', 'dress'), change('max_price', 150, 'under $150'),
  ] }));
  assert.equal(reply.status, 'matches'); assert.equal(session.scopes.item.occasion, 'Beach Wedding');
  const nextText = "Let's try blue. I don't know my size yet; can I browse first?";
  const next = send(session, nextText, plan(nextText, { action: 'refine', changes: [] }));
  assert.equal(next.session.scopes.item.occasion, 'Beach Wedding');
});
await check('Any colour can browse without a preference, while an unrelated edit cannot erase saved colours', () => {
  const text = "Let's start with dresses. Any colour, and I haven't set a budget.";
  const output = plan(text, { action: 'new_search', changes: [change('category', 'Clothing', 'dresses'),
    { scope: 'item', field: 'preferred_colours', operation: 'set', value: [], evidence: 'Any colour' }] });
  assert.ok(send(newSession(), text, output).reply.products.length);
  const blue = newSession(); Object.assign(blue.scopes.item, { category: 'Clothing', subcategory: 'Dresses', preferred_colours: ['Blue'] });
  const unclear = 'Show me other dresses.';
  assert.throws(() => send(blue, unclear, plan(unclear, { action: 'refine', changes: [
    { scope: 'item', field: 'preferred_colours', operation: 'set', value: [], evidence: 'other dresses' }] })), /explicit permission/);
  assert.deepEqual(blue.scopes.item.preferred_colours, ['Blue']);
  assert.deepEqual(send(blue, text, output).session.scopes.item.preferred_colours, []);
});
await check('A pairing explanation targets the named ordinal product, not a second anchor comparison', () => {
  const state = newSession(); state.context.latest = [snapshot(bag)]; state.context.previous = [[snapshot(dress)]];
  state.styling.outfit = [{ ...snapshot(dress), ownership: 'owned' }];
  const text = 'Why does the first bag go with my dress?';
  const { reply } = send(state, text, plan(text, { answer: { kind: 'product', topics: ['recommendation'],
    references: [{ kind: 'id', value: bag.product_id }, { kind: 'id', value: dress.product_id }], purpose: null, continuation: false } }));
  assert.equal(reply.status, 'answered'); assert.deepEqual(reply.answer_product_ids, [bag.product_id]);
  assert.equal(reply.pending_answer, null); assert.match(reply.message, /styling|pairing|colour|occasion/);
});
await check('A complete supported other-options request does not invent an unresolved other requirement', () => {
  const state = newSession(); Object.assign(state.scopes.item, { category: 'Accessories', subcategory: 'Jewellery', product_type: 'Necklace', preferred_colours: ['Silver'], max_price: 80 });
  const text = 'Show me other necklaces, still silver and under $80.';
  const direct = shortcutPlan(makeTurn(state, text)); assert.ok(direct);
  const { reply } = send(state, text, direct);
  assert.equal(reply.status, 'matches'); assert.ok(reply.products.length); assert.deepEqual(reply.proposed_scopes.unresolved_item, []);
  assert.ok(reply.products.every(product => product.colour === 'Silver' && product.price_aud <= 80));
  assert.equal(shortcutPlan(makeTurn(state, text.replace('.', ', with a waterproof clasp.'))), null);
});

await check('An omitted or misfiled explicit black constraint cannot return a beige bag', () => {
  const message = 'Actually, forget dresses. I want a black bag under $80.';
  for (const changes of [[], [change('style', 'black', 'black')]]) {
    const { reply, session } = send(seed(), message, plan(message, { action: 'new_search', changes }));
    assert.ok(visible(reply).length); assert.ok(visible(reply).every(row => row.colour === 'Black'));
    assert.deepEqual(session.scopes.item.preferred_colours, ['Black']);
    assert.equal(session.scopes.item.max_price, 80);
  }
});
await check('A shortlist budget refinement never requires selecting one of its products', () => {
  const state = seed(); state.context.latest = catalogue.filter(p => p.category === 'Clothing').slice(0, 4).map(snapshot);
  Object.assign(state.scopes.item, { category: 'Clothing', subcategory: 'Dresses', size: '10', max_price: 150 });
  const message = 'My maximum is now $100.';
  const { reply, session } = send(state, message, plan(message, { action: 'refine', reference: { kind: 'context' } }));
  assert.ok(visible(reply).length); assert.equal(reply.pending, null);
  assert.equal(session.scopes.item.size, '10'); assert.ok(visible(reply).every(row => row.price_aud <= 100));
});
await check('A factual question cannot create a colour or budget filter', () => {
  const message = 'Why is the black bag good for work under $80?';
  const state = seed(); const before = structuredClone(state.scopes);
  const { session } = send(state, message, plan(message, { answer: { kind: 'product', topics: ['recommendation'],
    references: [{ kind: 'id', value: bag.product_id }], purpose: 'work', continuation: false } }));
  assert.deepEqual(session.scopes, before);
});
await check('Broad bag, shoe and necklace ordinals resolve actual catalogue roles', () => {
  for (const [category, role] of [['Bags', 'Bags'], ['Shoes', 'Shoes'], ['Accessories', 'Necklaces']]) {
    const rows = catalogue.filter(p => p.category === category);
    const result = resolveProductReference({ focused: null, latest: rows.slice(0, 4).map(snapshot) },
      { kind: 'position', position: 1, subcategory: role });
    assert.equal(result.status, 'resolved'); assert.equal(result.product_id, rows[0].product_id);
  }
});
await check('An exact known name in an ID slot resolves safely; partial names still clarify', () => {
  const context = { focused: null, latest: [snapshot(dress), snapshot(bag)] };
  assert.equal(resolveProductReference(context, { kind: 'id', value: dress.product_name }).product_id, dress.product_id);
  assert.equal(resolveProductReference(context, { kind: 'id', value: 'Dress' }).status, 'needs_clarification');
});
await check('Liking a dress does not authorize a keep operation or cart mutation', () => {
  const state = seed(); const message = 'I like the first dress. Show me similar options under $100.';
  const { session } = send(state, message, plan(message, { action: 'refine', styling_intent: intent({
    outfit_changes: [{ operation: 'keep', reference: { kind: 'position', position: 1, subcategory: 'Dresses' }, evidence: 'I like the first dress' }],
  }) }));
  assert.deepEqual(session.styling.outfit, []); assert.deepEqual(session.cart_product_ids ?? [], []);
});
await check('Own followed by keep preserves one owned record', () => {
  const message = 'I already own the first dress. Keep it as an owned piece in my outfit.';
  const reference = { kind: 'position', position: 1, subcategory: 'Dresses' };
  const { session } = send(seed(), message, plan(message, { styling_intent: intent({ outfit_changes: [
    { operation: 'own', reference, evidence: 'I already own the first dress' },
    { operation: 'keep', reference, evidence: 'Keep it as an owned piece in my outfit' },
  ] }) }));
  assert.equal(session.styling.outfit.length, 1); assert.equal(session.styling.outfit[0].ownership, 'owned');
});
await check('Interest cannot be promoted to ownership by a model annotation', () => {
  const message = 'I like the first dress.';
  const { session } = send(seed(), message, plan(message, { styling_intent: intent({ outfit_changes: [
    { operation: 'own', reference: { kind: 'position', position: 1, subcategory: 'Dresses' }, evidence: 'I like the first dress' },
  ] }) }));
  assert.deepEqual(session.styling.outfit, []);
});
await check('Shoe pairing includes both owned anchors even after newer bag results', () => {
  const state = seed(); state.context.latest = catalogue.filter(p => p.category === 'Bags').map(snapshot);
  state.styling.outfit = [dress, bag].map(row => ({ ...snapshot(row), ownership: 'owned' }));
  const message = 'Find shoes to go with both my owned dress and bag, under $120.';
  const { reply, session } = send(state, message, plan(message, { action: 'cross_sell', reference: { kind: 'context' },
    changes: [change('category', 'Shoes', 'shoes')] }));
  assert.ok(visible(reply).length);
  for (const product of visible(reply)) assert.deepEqual(new Set(product.pairing_evidence.anchor_ids), new Set([dress.product_id, bag.product_id]));
  assert.equal(session.styling.outfit.length, 2);
});
await check('Described owned garments persist as descriptions and rank qualified suggestions', () => {
  const message = 'I already own a plain navy midi dress from another shop. I want shoes to match it for a wedding, under $100.';
  const first = send(newSession(), message, plan(message, { action: 'cross_sell', changes: [change('category', 'Shoes', 'shoes'),
    change('occasion', 'Wedding Guest', 'wedding')], styling_intent: intent({ external_items: [{ operation: 'add',
      description: 'plain navy midi dress', category: 'Clothing', product_type: 'midi dress', colour: 'navy', occasion: null }] }) }));
  assert.ok(visible(first.reply).length); assert.match(first.reply.message, /description/);
  const garment = first.session.styling.external_items[0]; assert.equal(garment.colour, 'navy');
  assert.equal('product_id' in garment, false);
  for (const product of visible(first.reply)) assert.deepEqual(product.pairing_evidence.external_anchor_ids, [garment.external_id]);
  const nextMessage = "I don't have a product link or photo. Please work from that description.";
  const next = send(first.session, nextMessage, plan(nextMessage, {}));
  assert.ok(visible(next.reply).length); assert.equal(next.session.scopes.item.max_price, 100);
  assert.deepEqual(next.session.styling.external_items, first.session.styling.external_items);
  const remove = `Remove the owned item I described as "${garment.description}".`;
  const turn = makeTurn(next.session, remove);
  const reply = finishConversationTurn(catalogue, turn, shortcutPlan(turn), vocabulary(catalogue));
  assert.deepEqual(reply.styling.external_items, []);
});
await check('An external garment cannot acquire an unquoted material-like colour', () => {
  const message = 'I own a navy dress from elsewhere.';
  assert.throws(() => checkConversationPlan(makeTurn(newSession(), message), plan(message, { styling_intent: intent({
    external_items: [{ operation: 'add', description: 'navy dress', category: 'Clothing', product_type: 'dress', colour: 'silk', occasion: null }],
  }) })), /External colour must be stated/);
});
await check('Closure equality is explained without selling an identical expensive bag', () => {
  const message = 'A secure zip closure matters most. Does spending more improve that?';
  const state = newSession(); state.context.focused = snapshot(fixtures['S5-C'][0]);
  const { reply } = send(state, message, plan(message, { action: 'upsell', reference: { kind: 'context' },
    styling_intent: intent({ preferences: [{ kind: 'priority', operation: 'add', value: 'closure', evidence: 'zip closure' }] }) }), fixtures['S5-C']);
  assert.equal(reply.status, 'no_upsell'); assert.deepEqual(visible(reply), []);
  assert.match(reply.message, /same recorded zip closure/); assert.doesNotMatch(reply.message, /What would you value/);
});
await check('Transport decoding rejects wrong slots and preserves typed domain validation', () => {
  const message = 'Show me bags under $80';
  const base = { ...plan(message, {}), action: 'new_search', answer: null, styling_intent: null, outfit_request: null };
  const price = { scope: 'item', field: 'max_price', operation: 'set', number_value: 80, text_value: null, list_values: [], evidence: 'under $80' };
  assert.equal(decodeModelPlan({ ...base, changes: [price] }).changes[0].value, 80);
  assert.throws(() => decodeModelPlan({ ...base, changes: [{ ...price, text_value: '80' }] }), /matching value slot/);
});
await check('An explicit replacement must-have establishes the corresponding comparison priority', () => {
  const rows = fixtures['S5-B']; const state = newSession();
  state.context.latest = rows.slice(0, 2).map(snapshot);
  Object.assign(state.scopes.item, { category: 'Clothing', subcategory: 'Dresses', occasion: 'Beach Wedding', preferred_colours: ['Blue'], size: '10', max_price: 150 });
  const message = 'Compare a replacement for VB-ORIGINAL Dress with pockets.';
  const { reply } = send(state, message, plan(message, { action: 'upsell', reference: { kind: 'id', value: 'VB-ORIGINAL' },
    styling_intent: intent({ preferences: [{ kind: 'requirement', operation: 'add', value: 'pockets', evidence: 'with pockets' }] }) }), rows);
  assert.deepEqual(visible(reply).map(p => p.product_id), ['VB-ELIGIBLE']);
});
await check('Value questions resolve the original, all alternatives, and the uniquely cheaper alternative', () => {
  const rows = fixtures['S5-D']; const state = newSession();
  state.context.comparison = snapshot(rows[0]); state.context.latest = rows.slice(1, 3).map(snapshot);
  for (const [message, expected] of [
    ['Which options improve adjustability without costing more?', ['VD-ORIGINAL', 'VD-EQUAL', 'VD-CHEAPER']],
    ['Explain the price difference for the cheaper one.', ['VD-ORIGINAL', 'VD-CHEAPER']],
  ]) {
    const turn = makeTurn(state, message); const result = shortcutPlan(turn);
    const reply = finishConversationTurn(rows, turn, result, vocabulary(rows));
    assert.equal(reply.status, 'answered'); assert.equal(reply.pending_answer, null);
    assert.deepEqual(new Set(reply.answer_product_ids), new Set(expected)); assert.match(reply.message, /15|80/);
  }
  state.context.latest = [snapshot(rows[2])];
  const turn = makeTurn(state, 'What does the extra cost give me?');
  const reply = finishConversationTurn(rows, turn, shortcutPlan(turn), vocabulary(rows));
  assert.equal(reply.pending_answer, null); assert.match(reply.message, /Adjustable/);
});
await check('A limit confirmation acknowledges that no restrictions were relaxed', () => {
  const state = newSession(); Object.assign(state.scopes.item, { category: 'Clothing', subcategory: 'Dresses', preferred_colours: ['Black'], size: '10', max_price: 1 });
  const message = "Keep the $1 limit. Don't show other colours or sizes.";
  const { reply } = send(state, message, plan(message, { styling_intent: intent({}) }));
  assert.deepEqual(visible(reply), []); assert.match(reply.message, /No restrictions have been relaxed/);
  assert.equal(reply.proposed_scopes.item.max_price, 1);
});
await check('Supported typed features do not also remain unresolved; unknown qualifiers still block', () => {
  for (const [requirement, expected] of [['zip closure', 'matches'], ['waterproof zip closure', 'needs_clarification']]) {
    const message = `Show me bags with a ${requirement} under $100.`;
    const { reply } = send(newSession(), message, plan(message, { action: 'new_search',
      changes: [{ scope: 'item', field: 'unresolved', operation: 'add', value: [requirement], evidence: requirement }],
      styling_intent: intent({ preferences: [{ kind: 'requirement', operation: 'add', value: 'zip_closure', evidence: 'zip closure' }] }),
    }));
    assert.equal(reply.status, expected);
    if (expected === 'matches') assert.ok(visible(reply).every(p => p.product_id === 'B-ZIP-60'));
    else assert.deepEqual(visible(reply), []);
  }
});
console.log(`\n${passed} customer-scenario regression checks passed.`);
