import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = name => JSON.parse(readFileSync(`${dir}${name}`, 'utf8'));
const ids = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'P1', 'P2', 'P3', 'P4'];
const records = Object.fromEntries(ids.map(id => [id, read(`${id}-live.json`)]));
const catalogue = read('catalogue-audit.json');
const cards = reply => [...reply.products, ...reply.alternatives,
  ...(reply.complementary_offer?.items.map(item => item.product) ?? [])];
const last = id => records[id].turns.filter(turn => turn.reply).at(-1).reply;
const checks = [];
const check = (name, verify) => { verify(); checks.push({ name, passed: true }); };
let cardOccurrences = 0;

for (const [id, record] of Object.entries(records)) {
  check(`${id}: at most six exchanges`, () => assert(record.turns.length <= 6));
  for (const [index, turn] of record.turns.entries()) {
    if (!turn.reply) continue;
    check(`${id}.${index + 1}: successful protocol acceptance`, () => {
      assert.equal(turn.http_status, 200);
      assert.equal(turn.accepted, true);
    });
    for (const card of cards(turn.reply)) {
      cardOccurrences++;
      check(`${id}.${index + 1}: ${card.product_id} catalogue facts`, () => {
        const source = catalogue.products.find(product => product.product_id === card.product_id);
        assert(source?.is_available && source.stock_qty > 0);
        for (const key of ['product_name', 'price_aud', 'category', 'subcategory', 'product_type', 'colour', 'style', 'occasion']) {
          assert.equal(card[key], source[key], key);
        }
        assert.deepEqual(card.sizes_available, source.sizes_available);
      });
    }
  }
}

check('Clear brief returns the exact blouse and navigation respects no extras', () => {
  assert.deepEqual(records.S1.turns[0].reply.products.map(product => product.product_id), ['P1259']);
  assert(last('S1').answer_sources.some(source => source.url === '/products/P1259'));
  assert(last('S1').styling.offers_paused);
  assert.equal(last('S1').styling.outfit.length, 0);
});
check('Wanted tops remain distinct from owned trousers and office explanation is useful', () => {
  const reply = records.S2.turns[2].reply;
  assert.equal(reply.applied_preferences.subcategory, 'Tops');
  assert(reply.products.every(product => product.subcategory === 'Tops' && product.price_aud <= 180));
  assert(last('S2').styling.external_items.some(item => /trousers/i.test(item.description)));
  assert.match(last('S2').message, /explicitly lists Work/);
  assert(last('S2').styling.offers_paused);
});
check('Recovered browsing shortlist obeys price and colour; answer avoids a fit guarantee', () => {
  const reply = records.S3.turns[4].reply;
  assert(reply.products.length > 0);
  assert(reply.products.every(product => product.price_aud <= 110 && product.colour !== 'Sage'));
  assert.match(last('S3').message, /can't.*guarantee fit/);
});
check('Recovered gift ends with an affordable one-size scarf and qualified policy answer', () => {
  const scarf = records.S4.turns[4].reply.products.find(product => product.product_id === 'P1264');
  assert(scarf && scarf.price_aud === 25 && scarf.sizes_available.includes('One Size'));
  assert.match(last('S4').message, /can't confirm arrival by Friday/);
  assert.match(last('S4').message, /doesn't specify.*exchanges/);
});
check('Production combined-budget reply counts the example without selecting it', () => {
  const reply = last('P1');
  assert.equal(reply.action, 'cross_sell');
  assert.equal(reply.applied_preferences.category, 'Bags');
  assert.equal(reply.purchase_budget.limit_aud, 140);
  assert.equal(reply.purchase_budget.fixed_total_aud, 100);
  assert.equal(reply.purchase_budget.remaining_aud, 40);
  assert.equal(reply.purchase_budget.maximum_total_aud, 135);
  assert.deepEqual(reply.purchase_budget.example_items, [{ product_id: 'P1210', price_aud: 100 }]);
  assert.equal(reply.styling.outfit.length, 0);
  assert.equal(reply.styling.outfit_request, null);
  assert.deepEqual(reply.styling.purchase_budget.product_ids, []);
  assert(reply.styling.rejected_ids.includes('P1209'));
  assert(cards(reply).length > 0 && cards(reply).every(product => product.category === 'Bags' && product.price_aud <= 40 && product.product_id !== 'P1209'));
});
check('No-match brief retains navy, fit, size and price; alternatives expose compromises', () => {
  const first = records.P2.turns[0].reply;
  assert.equal(first.status, 'no_match');
  assert.deepEqual(first.applied_preferences.preferred_colours, ['Navy']);
  assert.equal(first.applied_preferences.fit, 'Regular');
  assert.equal(first.applied_preferences.size, 'M');
  assert.equal(first.applied_preferences.max_price, 100);
  assert(last('P2').alternatives.length > 0);
  assert(last('P2').alternatives.every(product => product.price_aud <= 100 && product.sizes_available.includes('M') && product.differences.length > 0));
});
check('Production gift discovery enforces total, recipient colours, exclusions and unknown size', () => {
  const reply = last('P4');
  assert.equal(reply.applied_preferences.max_price, 90);
  assert.equal(reply.applied_preferences.category, null);
  assert.equal(reply.task.brief.gift_recipient, 'dad');
  assert(reply.task.brief.uncertain_recipient_size);
  assert(reply.task.brief.excluded_roles.includes('Jewellery'));
  assert(reply.products.length > 0);
  assert(reply.products.every(product => product.price_aud <= 90 && ['Blue', 'Grey'].includes(product.colour) && product.subcategory !== 'Jewellery'));
  assert.equal(reply.complementary_offer, null);
});
check('Production browser gives actual bag instructions and verified links', () => {
  const ax = readFileSync(`${dir}browser-production-navigation.txt`, 'utf8');
  assert.match(ax, /then use Add to bag/);
  assert.match(ax, /Checkout, payment and order placement are unavailable/);
  assert.match(ax, /products\/P1259/);
  assert.match(ax, /3003\/cart/);
  assert.match(ax, /help#orders/);
  assert.match(ax, /0 items/);
});

const sourceFiles = [...new Set([
  ...execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }).trim().split('\n'),
  'lib/catalogue/productWarnings.ts', 'lib/stylist/shoppingContext.ts',
  'lib/stylist/shoppingNavigation.ts', 'scripts/test-adaptive-reliability-fixes.mjs',
])].filter(Boolean);
const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file,
  createHash('sha256').update(readFileSync(`${root}${file}`)).digest('hex')]));
writeFileSync(`${dir}verification.json`, JSON.stringify({
  checked_at: new Date().toISOString(), passed: checks.length, failed: 0,
  catalogue_snapshot_sha256: catalogue.snapshot_sha256, factual_card_occurrences: cardOccurrences,
  scope: 'All recorded successful HTTP replies: protocol acceptance and catalogue facts. Behavioral assertions apply only to the named final/recovered turns, not every intermediate iteration.',
  checks, source_sha256: sourceHashes,
}, null, 2));

let transcript = '# Adaptive implementation retest transcripts\n\n';
transcript += 'These conversations span successive implementation iterations. Earlier failures are retained. A maximum of six exchanges (12 total messages) applies to each ID. Follow-ups were chosen after reading the preceding reply. P1 and P2 restart S5 and S6 after the first implementation probes failed; P3 and P4 are supplemental gift probes. A transport failure in P4 received no agent reply. Final production API probes are P1 exchange 6 and P4 exchange 2. The final browser check is saved separately.\n\n';
for (const [id, record] of Object.entries(records)) {
  transcript += `## ${id}\n\n`;
  for (const [index, turn] of record.turns.entries()) {
    transcript += `### Exchange ${index + 1} — ${turn.at}\n\n**Adaptive reason:** ${turn.adaptive_reason}\n\n**Customer:** ${turn.customer}\n\n`;
    if (!turn.reply) { transcript += `**Transport error:** ${turn.error}\n\n`; continue; }
    const reply = turn.reply;
    transcript += `**Agent (${reply.action}, ${reply.status}):**\n\n${reply.message}\n\n`;
    if (reply.optional_question) transcript += `**Optional question:** ${reply.optional_question}\n\n`;
    if (reply.suggested_replies?.length) transcript += `**Suggested replies:** ${reply.suggested_replies.join(' · ')}\n\n`;
    if (cards(reply).length) transcript += '```json\n' + JSON.stringify({ products: reply.products, alternatives: reply.alternatives, complementary_offer: reply.complementary_offer }, null, 2) + '\n```\n\n';
    transcript += '```json\n' + JSON.stringify({ applied_preferences: reply.applied_preferences, purchase_budget: reply.purchase_budget, answer_sources: reply.answer_sources, issues: reply.issues, optional_question: reply.optional_question }, null, 2) + '\n```\n\n';
  }
}
writeFileSync(`${dir}transcripts.md`, transcript);
console.log(`${checks.length} evidence checks passed; ${cardOccurrences} factual card occurrences. Intermediate semantic failures remain in the evidence.`);
