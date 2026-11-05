import assert from 'node:assert/strict';
import { getProductSpecification, specificationIdentity } from '../../lib/stylist/productSpecifications.ts';

// Version 2 makes the cheaper-reference products rank first via fixed stock.
export function product(id, category, price, options = {}, features = {}) {
  const row = {
    product_id: id, product_name: `${id} ${category === 'Clothing' ? 'Dress' : category === 'Shoes' ? 'Shoes' : category === 'Accessories' ? 'Necklace' : 'Bag'}`,
    category, subcategory: { Clothing: 'Dresses', Bags: 'Clutches', Shoes: 'Heels', Accessories: 'Jewellery' }[category],
    product_type: { Clothing: 'Midi Dress', Bags: 'Clutch', Shoes: 'Block Heels', Accessories: 'Necklace' }[category],
    gender: category === 'Clothing' ? 'Women' : null, brand_line: null, colour: 'Black', style: 'Relaxed', occasion: 'Beach Wedding', season: 'Summer',
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
export const catalogue = [
  product('D-BLACK-120', 'Clothing', 120, { stock_qty: 40 }), product('D-BLACK-90', 'Clothing', 90),
  product('D-BLUE-140', 'Clothing', 140, { colour: 'Blue', style: 'Formal' }),
  product('D-BLUE-80', 'Clothing', 80, { colour: 'Blue', material: 'Cotton' }),
  product('D-WORK-110', 'Clothing', 110, { occasion: 'Work' }), product('D-WORK-70', 'Clothing', 70, { occasion: 'Work' }),
  product('D-CASUAL-85', 'Clothing', 85, { colour: 'Navy', occasion: 'Casual' }),
  product('B-ZIP-60', 'Bags', 60, {}, { zip_closure: true, closure: 'zip' }),
  product('B-OPEN-45', 'Bags', 45, { colour: 'Beige' }),
  product('SH-WORK-110', 'Shoes', 110, { occasion: 'Work', stock_qty: 40 }), product('SH-WORK-75', 'Shoes', 75, { occasion: 'Work' }),
  product('SH-WEDDING-90', 'Shoes', 90, { colour: 'Beige', occasion: 'Wedding Guest' }),
  product('N-SILVER-65', 'Accessories', 65, { colour: 'Silver' }), product('N-SILVER-40', 'Accessories', 40, { colour: 'Silver' }),
];
export const discoveryCatalogue = [
  product('DISC-MIDI', 'Clothing', 100, { occasion: 'Formal', product_type: 'Midi Dress', colour: 'Black' }),
  product('DISC-MAXI', 'Clothing', 120, { occasion: 'Formal', product_type: 'Maxi Dress', colour: 'Blue' }),
  product('DISC-WRAP', 'Clothing', 150, { occasion: 'Formal', product_type: 'Wrap Dress', colour: 'Red' }),
  product('DISC-HEELS', 'Shoes', 80, { occasion: 'Formal', product_type: 'Block Heels', colour: 'Black' }),
  product('DISC-FLATS', 'Shoes', 90, { occasion: 'Formal', subcategory: 'Flats', product_type: 'Ballet Flats', colour: 'Silver' }),
  product('DISC-SANDALS', 'Shoes', 100, { occasion: 'Formal', subcategory: 'Sandals', product_type: 'Strappy Sandals', colour: 'Beige' }),
  product('DISC-OVER', 'Clothing', 395, { occasion: 'Formal', product_type: 'Gown', colour: 'Gold' }),
  product('DISC-CASUAL', 'Clothing', 1, { occasion: 'Casual' }),
];
export const fixtures = {
  'B5': discoveryCatalogue,
  'B1': [product('BUDGET-DRESS', 'Clothing', 250, { occasion: 'Formal' }),
    product('BUDGET-SHOES', 'Shoes', 150, { occasion: 'Formal', colour: 'Silver' }),
    product('CASUAL-DRESS', 'Clothing', 1, { occasion: 'Casual' }),
    product('UNAVAILABLE-SHOES', 'Shoes', 1, { occasion: 'Formal', is_available: false })],
  'B2': [product('OVER-DRESS', 'Clothing', 300, { occasion: 'Formal' }), product('OVER-SHOES', 'Shoes', 200, { occasion: 'Formal' })],
  'B3': [product('COLOUR-DRESS', 'Clothing', 250, { occasion: 'Formal' }),
    product('COLOUR-SHOES', 'Shoes', 150, { occasion: 'Formal', colour: 'Silver' }),
    product('WRONG-SHOES', 'Shoes', 1, { occasion: 'Formal', colour: 'Black' })],
  'B4': [product('THREE-DRESS', 'Clothing', 200, { occasion: 'Formal' }),
    product('THREE-SHOES', 'Shoes', 100, { occasion: 'Formal' }), product('THREE-BAG', 'Bags', 50, { occasion: 'Formal' })],
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
