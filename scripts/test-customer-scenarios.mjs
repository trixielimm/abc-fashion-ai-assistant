// Customer scenario acceptance probes. Real model, real domain pipeline, isolated
// synthetic catalogue. Does not test HTTP, rendering, storage, or visual taste.
// node --env-file=.env.local --conditions=react-server --import tsx scripts/test-customer-scenarios.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { interpretConversation } from '../lib/ai/interpretConversation.ts';
import { newSession, makeTurn, snapshot, acceptReply } from '../lib/stylist/conversationProtocol.ts';
import { interpreterInput, shortcutPlan, finishConversationTurn } from '../lib/stylist/conversationTurn.ts';
import { getProductSpecification, specificationIdentity } from '../lib/stylist/productSpecifications.ts';

const started = new Date().toISOString();
const output = new URL(`../docs/test-evidence/customer-scenarios-${started.replace(/[:.]/g, '-')}/`, import.meta.url);
mkdirSync(output, { recursive: true });
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const all = reply => [...reply.products, ...reply.alternatives];
function product(id, category, price, options = {}, features = {}) {
  const row = {
    product_id: id, product_name: `${id} ${category === 'Clothing' ? 'Dress' : category === 'Shoes' ? 'Shoes' : category === 'Accessories' ? 'Necklace' : 'Bag'}`,
    category, subcategory: { Clothing: 'Dresses', Bags: 'Clutches', Shoes: 'Heels', Accessories: 'Jewellery' }[category],
    product_type: { Clothing: 'Midi Dress', Bags: 'Clutch', Shoes: 'Block Heels', Accessories: 'Necklace' }[category],
    gender: null, brand_line: null, colour: 'Black', style: 'Relaxed', occasion: 'Beach Wedding', season: 'Summer',
    material: category === 'Accessories' ? 'Silver-tone Metal' : 'Polyester', fit: 'Regular',
    price_aud: price, sizes_available: category === 'Clothing' ? ['10', '12'] : category === 'Shoes' ? ['38', '39'] : ['One Size'],
    stock_qty: 20, is_available: true, description: null, tags: [], image_key: null,
    cross_sell_category: category === 'Clothing' ? 'Bags' : null, feature_data_status: 'available', verified_features: [],
    ...options,
  };
  const spec = {
    product_id: id, description: `Synthetic test specification for ${row.product_name}; recorded for controlled prototype testing only.`,
    construction_details: ['Seamed construction', 'Finished edges'], care_instructions: 'Wipe or gently hand clean; follow the care label.',
    lining: true, pockets: false, adjustable_strap: false, zip_closure: false, machine_washable: false,
    capacity_litres: category === 'Bags' ? 1 : null, use_cases: [row.occasion], closure: category === 'Accessories' ? 'clasp' : 'slip_on',
    garment_length_cm: category === 'Clothing' ? 110 : null, heel_height_cm: category === 'Shoes' ? 4 : null,
    sole_material: category === 'Shoes' ? 'Rubber' : null, dimensions_cm: category === 'Bags' ? { width: 25, height: 20, depth: 5 } : null,
    strap_drop_cm: category === 'Bags' ? 25 : null, compartments: category === 'Bags' ? 2 : null,
    hardware_finish: category === 'Accessories' ? 'Silver-tone' : null, ...features,
  };
  row.synthetic_specification = { product_id: id, source_kind: 'synthetic', dataset_version: 'prototype-specs-v1',
    generator_model: 'hand-authored-acceptance-fixture-v1', generated_at: '2026-10-17T00:00:00Z',
    identity_snapshot: specificationIdentity(row), specification: spec };
  assert.ok(getProductSpecification(row), `Invalid fixture ${id}`);
  return row;
}
const catalogue = [
  product('D-BLACK-120', 'Clothing', 120), product('D-BLACK-90', 'Clothing', 90),
  product('D-BLUE-140', 'Clothing', 140, { colour: 'Blue', style: 'Formal' }),
  product('D-BLUE-80', 'Clothing', 80, { colour: 'Blue', material: 'Cotton' }),
  product('D-WORK-110', 'Clothing', 110, { occasion: 'Work' }), product('D-WORK-70', 'Clothing', 70, { occasion: 'Work' }),
  product('D-CASUAL-85', 'Clothing', 85, { colour: 'Navy', occasion: 'Casual' }),
  product('B-ZIP-60', 'Bags', 60, {}, { zip_closure: true, closure: 'zip' }),
  product('B-OPEN-45', 'Bags', 45, { colour: 'Beige' }),
  product('SH-WORK-110', 'Shoes', 110, { occasion: 'Work' }), product('SH-WORK-75', 'Shoes', 75, { occasion: 'Work' }),
  product('SH-WEDDING-90', 'Shoes', 90, { colour: 'Beige', occasion: 'Wedding Guest' }),
  product('N-SILVER-65', 'Accessories', 65, { colour: 'Silver' }), product('N-SILVER-40', 'Accessories', 40, { colour: 'Silver' }),
];
const fixtures = {
  'S5-A': [product('VA-ORIGINAL', 'Clothing', 95), product('VA-POCKETS', 'Clothing', 120, {}, { pockets: true })],
  'S5-B': [product('VB-ORIGINAL', 'Clothing', 95, { colour: 'Blue' }), product('VB-ELIGIBLE', 'Clothing', 140, { colour: 'Blue' }, { pockets: true }),
    product('VB-WORK', 'Clothing', 110, { colour: 'Blue', occasion: 'Work' }, { pockets: true }),
    product('VB-BLACK', 'Clothing', 110, {}, { pockets: true }), product('VB-SIZE12', 'Clothing', 110, { colour: 'Blue', sizes_available: ['12'] }, { pockets: true }),
    product('VB-OVER', 'Clothing', 160, { colour: 'Blue' }, { pockets: true })],
  'S5-C': [product('VC-ORIGINAL', 'Bags', 60, {}, { zip_closure: true, closure: 'zip' }), product('VC-SAME', 'Bags', 90, {}, { zip_closure: true, closure: 'zip' })],
  'S5-D': [product('VD-ORIGINAL', 'Bags', 80), product('VD-EQUAL', 'Bags', 80, {}, { adjustable_strap: true }),
    product('VD-CHEAPER', 'Bags', 65, {}, { adjustable_strap: true }), product('VD-OVER', 'Bags', 95, {}, { adjustable_strap: true })],
  'S5-E': [product('VE-ORIGINAL', 'Clothing', 95), product('VE-TRADEOFF', 'Clothing', 120, {}, { pockets: true, lining: false })],
  'S5-F': [product('VF-UNKNOWN', 'Clothing', 95, {}, { lining: null }), product('VF-LINED', 'Clothing', 120)],
};
const cases = [];
function scenario(id, name, prompts, verify, options = {}) { cases.push({ id, name, prompts, verify, ...options }); }
const eq = (a, b, text) => assert.deepEqual(a, b, text);
const label = value => typeof value === 'string' ? value.trim().toLowerCase() : value;
const eqLabel = (a, b, text) => eq(Array.isArray(a) ? a.map(label) : label(a), Array.isArray(b) ? b.map(label) : label(b), text);
const has = (list, item, text) => assert.ok(list.includes(item), text ?? `Missing ${item}`);
const none = reply => eq(all(reply), [], 'No product cards expected');
const browse = reply => assert.ok(all(reply).length, `Expected eligible results, got ${reply.status}: ${reply.message}`);
const checkBrief = (reply, { category, subcategory, colour, size, max }) => {
  const prefs = reply.applied_preferences ?? reply.proposed_scopes.item;
  if (category) eqLabel(prefs.category, category, 'Category retained');
  if (subcategory) eqLabel(prefs.subcategory, subcategory, 'Subcategory retained');
  if (colour) eqLabel(prefs.preferred_colours, [colour], 'Colour retained');
  if (size) eq(prefs.size, size, 'Size retained');
  if (max !== undefined) eq(prefs.max_price, max, 'Budget retained');
};
const factual = (reply, before, id) => {
  eq(reply.status, 'answered', 'Factual question should be answered'); none(reply);
  eq(reply.proposed_scopes, before.scopes, 'Question must not change requirements');
  eq(reply.answer_product_ids, [id], 'Answer must reference the intended product');
};
scenario('S1-A', 'Complete brief, cheaper, material', [
  'Show me black dresses in size 10 under $150. I only need a dress, no other items.',
  'Show me cheaper options than the first dress, keeping my other requirements.',
  'What material is the first dress in the new results?',
], (n, r, s, b, run) => {
  if (n < 3) { if (n === 1 || all(r).length) browse(r); else eq(r.status, 'no_match'); checkBrief(r, { category: 'Clothing', subcategory: 'Dresses', colour: 'Black', size: '10', max: 150 }); }
  if (n === 1) { run.first = all(r)[0]; eq(s.styling.offers_paused, true, 'No extras must pause offers'); }
  if (n === 2) assert.ok(all(r).every(p => p.price_aud < run.first.price_aud), 'Strictly cheaper than original first dress');
  if (n === 3) { factual(r, b, b.context.latest[0].product_id); assert.match(r.message, /Polyester/); }
});
scenario('S1-B', 'Change colour and price only', ['Show me black dresses in size 10 under $150.', 'Actually, blue instead of black. Keep everything else.', 'My maximum is now $100.'], (n, r) => {
  browse(r); checkBrief(r, { category: 'Clothing', subcategory: 'Dresses', colour: n === 1 ? 'Black' : 'Blue', size: '10', max: n === 3 ? 100 : 150 });
});
scenario('S1-C', 'Deliberate no match', ['Show me black dresses in size 10 under $1.', "Keep the $1 limit. Don't show other colours or sizes."], (_n, r) => {
  none(r); checkBrief(r, { colour: 'Black', size: '10', max: 1 }); assert.match(r.message, /no|couldn't|cannot|can't/i);
});
scenario('S2-A', 'Guided beach wedding shopping', [
  "I need a dress for a beach wedding under $150, but I don't know which colour or style.",
  "Let's try blue. I don't know my size yet; can I browse first?", 'Compare the first and second dresses and explain the differences.',
  "I'd prefer something more relaxed. Keep blue and the same budget.",
], (n, r, s, b) => {
  if (n === 3) { eq(r.status, 'answered'); eq(new Set(r.answer_product_ids), new Set(b.context.latest.slice(0, 2).map(p => p.product_id))); none(r); }
  else { browse(r); checkBrief(r, { max: 150, ...(n > 1 ? { colour: 'Blue' } : {}) }); eq(r.proposed_scopes.item.size, null, 'Do not invent size'); }
  eqLabel(s.scopes.item.occasion, 'Beach Wedding', 'Occasion retained');
});
scenario('S2-B', 'Reject a dress across searches', ['Show me dresses for work under $120.', "I don't like the first dress. Don't show it again.", 'Show me other options, still for work under $120.'], (n, r, s, b, run) => {
  if (n === 1) { browse(r); run.rejected = all(r)[0].product_id; }
  if (n === 2) has(s.styling.rejected_ids, run.rejected);
  if (n === 3) { browse(r); assert.ok(all(r).every(p => p.product_id !== run.rejected)); checkBrief(r, { max: 120 }); eqLabel(s.scopes.item.occasion, 'Work'); }
});
scenario('S2-C', 'Zip question becomes explicit must-have', ['Show me bags under $100.', 'Does the first bag have a zip closure?', 'I only want bags with a zip closure. Keep the $100 limit.'], (n, r, s, b, run) => {
  if (n === 1) browse(r);
  if (n === 2) { factual(r, b, b.context.latest[0].product_id); eq(s.styling.required_features, [], 'Question is not a requirement'); assert.match(r.message, /Zip closure: (Yes|No)/); }
  if (n === 3) { browse(r); has(s.styling.required_features, 'zip_closure'); checkBrief(r, { category: 'Bags', max: 100 }); assert.ok(all(r).every(p => getProductSpecification(run.catalogue.find(x => x.product_id === p.product_id)).zip_closure === true)); }
});
scenario('S3-A', 'Uncertain customer to similar dresses', [
  'I feel like buying something new, but I have no idea what I want.', "Something for everyday wear. Maybe a dress, but I'm open to ideas.",
  "Let's start with dresses. Any colour, and I haven't set a budget.", 'I like the first dress. Show me similar options under $100.',
], (n, r, s) => {
  if (n === 1) { eq(s.scopes.item.category, null); eq(s.scopes.item.gender, null); eq(s.scopes.item.max_price, null); assert.match(r.message, /everyday|occasion|what|which|start|browse/i); assert.doesNotMatch(r.message, /Could you rephrase|provide more details/i); }
  if (n <= 3) { eq(s.scopes.item.size, null); eq(s.scopes.item.max_price, null); }
  if (n === 3) { browse(r); checkBrief(r, { category: 'Clothing', subcategory: 'Dresses', max: null }); }
  if (n === 4) { browse(r); checkBrief(r, { category: 'Clothing', subcategory: 'Dresses', max: 100 }); eq(s.styling.outfit, [], 'Liking is not selecting'); }
});
scenario('S3-B', 'Browse without preferences', ["I'd like to browse dresses for inspiration.", "I'm not sure about colour, size or budget. Just show me some options."], (_n, r, s) => {
  browse(r); checkBrief(r, { category: 'Clothing', subcategory: 'Dresses', max: null }); eq(s.scopes.item.size, null);
});
scenario('S3-C', 'Switch from dresses to bags', ['Show me blue dresses in size 10 under $150.', 'Actually, forget dresses. I want a black bag under $80.'], (n, r, s) => {
  browse(r); if (n === 2) { checkBrief(r, { category: 'Bags', colour: 'Black', max: 80 }); eq(s.scopes.item.size, null); eq(s.styling.outfit, []); }
});
const ownedSetup = ['Show me dresses under $150.', 'I already own the first dress. Keep it as an owned piece in my outfit.'];
scenario('S4-A', 'Pair a bag with an owned catalogue dress', [...ownedSetup, "Find a bag to go with my owned dress, under $80. I don't need another dress.", 'Why does the first bag go with my dress?'], (n, r, s, b, run) => {
  if (n === 1) { browse(r); run.anchor = all(r)[0].product_id; }
  if (n >= 2) assert.ok(s.styling.outfit.some(p => p.product_id === run.anchor && p.ownership === 'owned'), 'Retain exact owned dress');
  if (n === 3) { browse(r); checkBrief(r, { category: 'Bags', max: 80 }); assert.ok(all(r).every(p => p.pairing_evidence?.anchor_ids.includes(run.anchor))); }
  if (n === 4) { factual(r, b, b.context.latest[0].product_id); assert.match(r.message, /styling|pairing|occasion|colour|style/i); }
});
scenario('S4-B', 'Style an external owned garment', ['I already own a plain navy midi dress from another shop. I want shoes to match it for a wedding, under $100.', "I don't have a product link or photo. Please work from that description."], (_n, r, s) => {
  assert.ok(s.styling.outfit.every(p => catalogue.some(x => x.product_id === p.product_id)), 'Do not invent external product ID');
  assert.ok(!/matches perfectly|verified match|perfect match/i.test(r.message));
}, { feature_gap: 'No structured external-garment record: navy, midi and plain cannot persist as an owned matching anchor.' });
scenario('S4-C', 'Pair shoes with two owned pieces', [...ownedSetup, 'Show me bags.', 'I already own the first bag too. Keep it as an owned piece in my outfit.', 'Find shoes to go with both my owned dress and bag, under $120.', 'No extra recommendations after the shoes.'], (n, r, s, b, run) => {
  if (n === 1) run.dress = all(r)[0]?.product_id;
  if (n === 3) { browse(r); run.bag = all(r)[0].product_id; }
  if (n >= 4) for (const id of [run.dress, run.bag]) assert.ok(s.styling.outfit.some(p => p.product_id === id && p.ownership === 'owned'), `Retain owned ${id}`);
  if (n === 5) { browse(r); checkBrief(r, { category: 'Shoes', max: 120 }); for (const p of all(r)) for (const id of [run.dress, run.bag]) has(p.pairing_evidence?.anchor_ids ?? [], id); }
  if (n === 6) { eq(s.styling.offers_paused, true); none(r); }
});
scenario('S5-A', 'Pockets justify A$25 more', ['Does this dress have pockets?', 'Compare a replacement with pockets under $150.', 'What does the extra cost give me?', 'Pockets would be useful.'], (n, r, s, b) => {
  if (n === 1) { factual(r, b, 'VA-ORIGINAL'); assert.match(r.message, /Pockets: No/); eq(s.styling.required_features, []); }
  if ([2, 4].includes(n)) { eq(all(r).map(p => p.product_id), ['VA-POCKETS']); eq(all(r)[0].value_comparison.extra_cost_aud, 25); eq(s.context.comparison.product_id, 'VA-ORIGINAL'); checkBrief(r, { max: 150 }); }
  if (n === 3) { eq(r.status, 'answered'); assert.match(r.message, /pockets/i); assert.match(r.message, /25/); }
});
scenario('S5-B', 'Replacement preserves all hard requirements', ['I need a blue dress for a beach wedding in size 10, under $150.', 'Compare a replacement for VB-ORIGINAL Dress with pockets. Keep the beach wedding occasion, blue, size 10 and the $150 maximum as requirements.', 'Would this still meet my beach wedding requirements?'], (n, r, s, b) => {
  if (n === 1) { browse(r); has(all(r).map(p => p.product_id), 'VB-ORIGINAL'); }
  if (n === 2) { eq(all(r).map(p => p.product_id), ['VB-ELIGIBLE']); checkBrief(r, { colour: 'Blue', size: '10', max: 150 }); eqLabel(s.scopes.item.occasion, 'Beach Wedding'); }
  if (n === 3) { factual(r, b, 'VB-ELIGIBLE'); assert.match(r.message, /Beach Wedding/i); }
});
scenario('S5-C', 'No demonstrated improvement', ['Can you find a better replacement for this bag under $100?', 'A secure zip closure matters most. Does spending more improve that?', "If there is no useful improvement, I'll keep this one."], (n, r) => {
  none(r); if (n === 2) { assert.ok(['answered', 'no_upsell'].includes(r.status), 'A supported closure priority must not block as unsupported'); assert.match(r.message, /no|same|cannot|can't|not/i); assert.match(r.message, /zip|closure/i, 'Explain the actual closure comparison rather than asking for a different priority'); }
  assert.ok(!/better quality|higher quality/i.test(r.message) || /not|doesn't|cannot|can't/i.test(r.message));
});
scenario('S5-D', 'Same-price and cheaper adjustable alternatives', ['Find a replacement for this bag with an adjustable strap, at or below $80.', 'Which options improve adjustability without costing more?', 'Explain the price difference for the cheaper one.'], (n, r) => {
  if (n === 1) { eq(new Set(all(r).map(p => p.product_id)), new Set(['VD-EQUAL', 'VD-CHEAPER'])); for (const p of all(r)) { eq(p.value_comparison.extra_cost_aud, p.product_id === 'VD-EQUAL' ? 0 : -15); eq(p.value_comparison.kind, 'alternative'); } }
  if (n === 2) { eq(r.status, 'answered'); assert.match(r.message, /adjust/i); }
  if (n === 3) { eq(r.status, 'answered'); assert.match(r.message, /15/); assert.match(r.message, /VD-CHEAPER/); assert.ok(!r.pending_answer, 'Resolve cheaper one without asking for two products'); }
});
scenario('S5-E', 'Lining trade-off then both required', ['Find a replacement with pockets under $150.', 'What would I gain and what would I lose with that replacement?', 'I need lining too. Keep both lining and pockets as must-haves, still under $150.'], (n, r, s) => {
  if (n === 1) { eq(all(r).map(p => p.product_id), ['VE-TRADEOFF']); assert.ok(all(r)[0].value_comparison.tradeoffs.some(t => /lining/i.test(t))); }
  if (n === 2) { eq(r.status, 'answered'); assert.match(r.message, /pockets/i); assert.match(r.message, /lining/i); assert.match(r.message, /25/); }
  if (n === 3) { none(r); has(s.styling.required_features, 'lining'); has(s.styling.required_features, 'pockets'); checkBrief(r, { max: 150 }); }
});
scenario('S5-F', 'Unknown lining cannot prove improvement', ['Is this dress lined?', 'Find a replacement under $150 that adds lining compared with this dress.', 'Can you confirm that the original has no lining?'], (n, r, s, b) => {
  none(r); if (n === 1 || n === 3) { factual(r, b, 'VF-UNKNOWN'); assert.match(r.message, /not specified|not recorded|unknown|can't|cannot|don't/i); assert.doesNotMatch(r.message, /Lining: No/); }
});
scenario('S6-A', 'Shoe size and construction details', ['Show me black shoes for work in size 38 under $120. I only need shoes.', 'What are the heel height and sole material of the first pair?', 'Show me a cheaper option than the first pair, keeping black, work, size 38 and the same maximum.'], (n, r, s, b, run) => {
  if (n !== 2) { if (n === 1 || all(r).length) browse(r); else eq(r.status, 'no_match'); checkBrief(r, { category: 'Shoes', colour: 'Black', size: '38', max: 120 }); eqLabel(s.scopes.item.occasion, 'Work'); }
  if (n === 1) { run.first = all(r)[0]; assert.ok(all(r).every(p => p.category === 'Shoes'), 'No unrelated additions'); }
  if (n === 2) { factual(r, b, run.first.product_id); assert.match(r.message, /Heel height: 4 cm/); assert.match(r.message, /Sole: Rubber/); }
  if (n === 3) assert.ok(all(r).every(p => p.price_aud < run.first.price_aud));
});
scenario('S6-B', 'Silver necklaces and fastening facts', ['Show me silver necklaces under $80. I only need a necklace.', 'What material and fastening does the first necklace have?', 'Show me other necklaces, still silver and under $80.'], (n, r, s, b) => {
  if (n !== 2) { browse(r); checkBrief(r, { category: 'Accessories', colour: 'Silver', max: 80 }); eq(s.scopes.item.size, null); assert.ok(all(r).every(p => p.product_type === 'Necklace')); }
  if (n === 1) assert.ok(all(r).every(p => p.category === 'Accessories'), 'No unrelated clothing recommendations');
  if (n === 2) { factual(r, b, b.context.latest[0].product_id); assert.match(r.message, /Silver-tone Metal/); assert.match(r.message, /Fastening: clasp/); assert.doesNotMatch(r.message, /sterling silver/i); }
});

const fixtureFile = { version: 'customer-scenarios-v1', provenance: 'Hand-authored synthetic fixtures; never supplier verification.', catalogue, fixtures,
  expected: { 'S5-A': ['VA-POCKETS'], 'S5-B': ['VB-ELIGIBLE'], 'S5-C': [], 'S5-D': ['VD-EQUAL', 'VD-CHEAPER'], 'S5-E': ['VE-TRADEOFF'], 'S5-F': [], 'S6-A': ['SH-WORK-110', 'SH-WORK-75'], 'S6-B': ['N-SILVER-65', 'N-SILVER-40'] } };
writeFileSync(new URL('fixtures.json', output), JSON.stringify(fixtureFile, null, 2));
const summary = { started, commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), node: process.version,
  model: process.env.OPENAI_CONVERSATION_MODEL?.trim() || 'gpt-5.6-luna', reasoning: 'low', fixture_sha256: sha(fixtureFile),
  scope: 'Real model + shortcutPlan + finishConversationTurn + acceptReply; in-process with isolated synthetic fixtures. Not HTTP/browser acceptance.',
  human_review: 'Pairing taste, aesthetic variety and end-user usefulness require human assessment.', runs: [] };
if (process.env.SCENARIO_REPLAY) summary.reassessed_from = process.env.SCENARIO_REPLAY;
const repeats = Number(process.env.SCENARIO_REPEATS ?? 3);
const selected = cases.filter(c => !process.env.SCENARIO_FILTER || new RegExp(process.env.SCENARIO_FILTER).test(c.id));
const jobs = selected.flatMap(c => Array.from({ length: repeats }, (_, i) => [c, i + 1]));
async function runCase(c, repeat) {
  const rows = fixtures[c.id] ?? catalogue;
  const vocabulary = { rows, sizes: [...new Set(rows.flatMap(p => p.sizes_available))], categories: rows.flatMap(p => [{ category: p.category, subcategory: null }, { category: p.category, subcategory: p.subcategory }]) };
  const run = { id: c.id, name: c.name, repeat, catalogue: rows, turns: [], started: new Date().toISOString(), result: 'Pass', issues: [] };
  const cached = process.env.SCENARIO_REPLAY ? JSON.parse(readFileSync(`${process.env.SCENARIO_REPLAY}/${c.id}-run-${repeat}.json`, 'utf8')) : null;
  let state = newSession();
  // Product page focus is part of the specification setup for these cases.
  const focus = fixtures[c.id] && c.id !== 'S5-B' ? snapshot(rows[0]) : null;
  for (let i = 0; i < c.prompts.length; i++) {
    const message = c.prompts[i];
    const before = structuredClone(cached && i > 0 ? cached.turns[i - 1]?.state ?? state : state);
    const turn = cached?.turns[i]?.input ?? makeTurn(state, message, i === 0 ? focus : null);
    const record = { number: i + 1, message, input: turn, began: new Date().toISOString() };
    run.turns.push(record);
    const n = i + 1;
    const needsLatest = (c.id === 'S1-A' && n >= 2) || (c.id === 'S2-B' && n === 2) || (c.id === 'S2-C' && n === 2) ||
      (c.id === 'S3-A' && n === 4) || (c.id === 'S4-A' && [2, 4].includes(n)) || (c.id === 'S4-C' && [2, 4].includes(n)) ||
      (c.id === 'S5-B' && n === 3) || (c.id === 'S5-A' && n === 3) || (c.id === 'S5-D' && n >= 2) || (c.id === 'S5-E' && n === 2) ||
      (c.id === 'S6-A' && n >= 2) || (c.id === 'S6-B' && n === 2);
    const missingPair = c.id === 'S2-A' && n === 3 && state.context.latest.length < 2;
    const missingOriginal = c.id === 'S5-B' && n === 2 && !state.context.latest.some(p => p.product_id === 'VB-ORIGINAL');
    if ((needsLatest && !state.context.latest.length) || missingPair || missingOriginal) {
      record.checks = 'Blocked'; record.failure = 'Dependent product reference was not displayed; excluded from acceptance assessment.';
      if (run.result === 'Pass') run.result = 'Blocked';
      run.issues.push({ turn: n, message: record.failure });
      // Retain exploratory pilot evidence, but do not count its dependent turns.
      if (cached?.turns[i]) { record.excluded_pilot_turn = cached.turns[i]; state = cached.turns[i].state ?? state; }
      continue;
    }
    try {
      const began = Date.now();
      const short = shortcutPlan(turn);
      if (cached && !cached.turns[i]?.plan) throw new Error('Replay has no executed model plan for this turn.');
      const plan = cached ? cached.turns[i].plan : short ?? await interpretConversation(interpreterInput(turn));
      record.plan_source = cached ? cached.turns[i].plan_source : short ? 'production shortcut' : 'live model'; record.plan = plan;
      const reply = cached?.turns[i]?.reply ?? finishConversationTurn(rows, turn, plan, vocabulary);
      record.reply = reply; record.elapsed_ms = cached ? cached.turns[i].elapsed_ms : Date.now() - began;
      const accepted = acceptReply(turn, reply); state = accepted.session; record.state = state;
      try {
        c.verify(i + 1, reply, state, before, run);
        eq(state.cart_product_ids ?? [], before.cart_product_ids ?? [], 'No automatic cart mutation');
        for (const p of all(reply)) { const source = rows.find(row => row.product_id === p.product_id); assert.ok(source, 'No invented product'); eq(p.price_aud, source.price_aud, 'Recorded price only'); }
        record.checks = 'Pass';
      } catch (error) { record.checks = 'Fail'; record.failure = error.message; run.issues.push({ turn: i + 1, message: error.message }); run.result = 'Fail'; }
    } catch (error) {
      record.checks = 'Error'; record.failure = error.message;
      run.issues.push({ turn: i + 1, message: error.message });
      // Provider or fixture infrastructure failures are blocked; domain/schema
      // failures are failures. Subsequent dependent turns cannot be fabricated.
      run.result = /Connection|401|403|429|quota|timed out|fetch failed/i.test(error.message) ? 'Blocked' : 'Fail';
      record.error_type = error.name; record.error_status = error.status;
      run.unexecuted_turns = c.prompts.length - i - 1; break;
    }
  }
  if (c.feature_gap && run.result === 'Pass') run.result = 'Feature gap';
  if (c.feature_gap) run.feature_gap = c.feature_gap;
  run.finished = new Date().toISOString();
  // Fixture is already saved once; avoid repeating it in every transcript.
  delete run.catalogue;
  writeFileSync(new URL(`${c.id}-run-${repeat}.json`, output), JSON.stringify(run, null, 2));
  summary.runs.push(run);
  writeFileSync(new URL('summary.json', output), JSON.stringify({ ...summary, runs: summary.runs.map(({ turns, ...rest }) => ({ ...rest, turns_recorded: turns.length })) }, null, 2));
  console.log(`${run.result}: ${c.id} run ${repeat} (${run.turns.filter(t => t.checks === 'Pass').length}/${run.turns.length} turns) ${run.issues.map(issue => `T${issue.turn}: ${issue.message.split('\n')[0]}`).join('; ')}`);
}
let cursor = 0;
await Promise.all(Array.from({ length: 3 }, async () => { while (cursor < jobs.length) { const [c, repeat] = jobs[cursor++]; await runCase(c, repeat); } }));
summary.finished = new Date().toISOString();
summary.counts = Object.fromEntries(['Pass', 'Fail', 'Blocked', 'Feature gap'].map(k => [k, summary.runs.filter(r => r.result === k).length]));
writeFileSync(new URL('summary.json', output), JSON.stringify({ ...summary, runs: summary.runs.map(({ turns, ...rest }) => ({ ...rest, turns_recorded: turns.length })) }, null, 2));
console.log(JSON.stringify({ counts: summary.counts, evidence: output.pathname }));
if (summary.counts.Fail || summary.counts.Blocked) process.exitCode = 1;
