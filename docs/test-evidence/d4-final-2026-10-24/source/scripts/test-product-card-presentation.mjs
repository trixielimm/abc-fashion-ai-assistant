import assert from 'node:assert/strict';
import { preferredCardSize, productCardReason } from '../lib/stylist/productCardPresentation.ts';
import { emptyShoppingPreferences } from '../lib/stylist/preferenceScope.ts';
import { outfitProductNote } from '../lib/stylist/outfitPresentation.ts';

const product = { product_id: 'CARD-1', product_name: 'Test Dress', price_aud: 120, category: 'Clothing',
  subcategory: 'Dresses', product_type: 'Midi Dress', colour: 'Blue', brand_line: 'ABC Occasion',
  sizes_available: ['8', '10', '12'], occasion: 'Formal' };
const prefs = values => ({ ...emptyShoppingPreferences(), ...values });
let passed = 0;
function check(name, test) { test(); passed++; console.log(`PASS: ${name}`); }

check('A lone clothing size still requires an explicit choice', () => {
  assert.equal(preferredCardSize({ ...product, sizes_available: ['10'] }, null), '');
  assert.equal(preferredCardSize(product, prefs({ category: 'Clothing', size: '10' })), '10');
});
check('Sizes are never transferred between clothing and shoes', () => {
  assert.equal(preferredCardSize(product, prefs({ category: 'Shoes', size: '10' })), '');
  assert.equal(productCardReason(product, prefs({ category: 'Shoes', size: '10' })), null);
});
check('Unavailable saved sizes do not become a purchase choice or an availability claim', () => {
  const preferences = prefs({ category: 'Clothing', size: '14' });
  assert.equal(preferredCardSize(product, preferences), '');
  assert.equal(productCardReason(product, preferences), null);
});
check('One-size goods retain their catalogue spelling and automatic size', () => {
  const bag = { ...product, category: 'Bags', sizes_available: ['One Size'] };
  assert.equal(preferredCardSize(bag, null), 'One Size');
  assert.equal(productCardReason(bag, null), null);
});
check('A size label matches without guessing size conversions', () => {
  const top = { ...product, sizes_available: ['XS', 'M', 'XL'] };
  assert.equal(preferredCardSize(top, prefs({ category: 'Clothing', size: ' m ' })), 'M');
  assert.equal(preferredCardSize(top, prefs({ category: 'Clothing', size: '10' })), '');
});
check('Reasons use supported catalogue occasion rather than asserting styling compatibility', () => {
  assert.equal(productCardReason(product, prefs({ occasion: ' formal ' })), 'Listed for formal occasions.');
  assert.equal(productCardReason(product, prefs({ occasion: 'Wedding' })), null);
});
check('Price reasons respect a zero cap and the inclusive boundary', () => {
  assert.equal(productCardReason(product, prefs({ max_price: 120 })), 'Within your A$120.00 limit.');
  assert.equal(productCardReason(product, prefs({ max_price: 119 })), null);
  assert.equal(productCardReason(product, prefs({ max_price: 0 })), null);
  assert.equal(productCardReason({ ...product, price_aud: 0 }, prefs({ max_price: 0 })), 'Within your A$0.00 limit.');
});
check('Short supplied explanations remain intact, including their caveat', () => {
  const explanation = 'Recorded neutral colour; check the shades together.';
  assert.equal(productCardReason({ ...product, explanation }, null), explanation);
});
check('Long explanations are not cut mid-claim; unknown context produces no invented reason', () => {
  const long = { ...product, explanation: 'Recorded attributes provide a starting point. '.repeat(5) };
  assert.equal(productCardReason(long, null), null);
  assert.equal(productCardReason(long, prefs({ category: 'Clothing', size: '10' })), 'Size 10 is listed.');
});
check('Important dress-code cautions stay visible without repeating the occasion reason', () => {
  assert.equal(outfitProductNote(product), null);
  assert.match(outfitProductNote({ ...product, product_type: 'Mini Dress' }), /check the invitation/);
  assert.match(outfitProductNote({ ...product, category: 'Shoes', product_type: 'Loafers' }), /dressier footwear/);
});
console.log(`${passed} product card presentation checks passed.`);
