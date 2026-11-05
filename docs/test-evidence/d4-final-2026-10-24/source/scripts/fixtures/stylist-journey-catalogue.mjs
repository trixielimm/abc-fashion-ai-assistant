// Isolated acceptance data only. Never loaded by application routes or written
// to the shared catalogue. Every specification is explicitly synthetic.
import { product } from './customer-scenarios.mjs';

const dress = (id, price, colour, occasion) => product(id, 'Clothing', price, {
  product_name: `Fixture ${id} ${colour} Midi Dress`, gender: 'Women', colour, occasion,
  sizes_available: ['10', '12', 'M'], cross_sell_category: 'Shoes',
});
export const journeyCatalogue = [
  dress('D-FORMAL-BLACK', 120, 'Black', 'Formal'), dress('D-FORMAL-BLACK-LOW', 85, 'Black', 'Formal'),
  dress('D-FORMAL-BLUE', 100, 'Blue', 'Formal'), dress('D-WORK-BLACK', 100, 'Black', 'Work'),
  dress('D-WORK-BLUE', 80, 'Blue', 'Work'), dress('D-BEACH-BLACK', 110, 'Black', 'Beach Wedding'),
  dress('D-BEACH-BLUE', 90, 'Blue', 'Beach Wedding'), dress('D-WEDDING-BLUE', 95, 'Blue', 'Wedding Guest'),
  ...[['S-FORMAL-BLACK', 'Black', 'Formal', 70], ['S-FORMAL-SILVER', 'Silver', 'Formal', 65],
    ['S-WEDDING-BLACK', 'Black', 'Wedding Guest', 60]].map(([id, colour, occasion, price]) =>
    product(id, 'Shoes', price, { gender: 'Women', colour, occasion, sizes_available: ['7', '8', '9'] })),
  ...[['B-FORMAL', 'Formal', 60], ['B-FORMAL-LOW', 'Formal', 45], ['B-WEDDING', 'Wedding Guest', 50]].map(([id, occasion, price]) =>
    product(id, 'Bags', price, { gender: 'Women', occasion }, { zip_closure: true, closure: 'zip' })),
  product('N-SILVER', 'Accessories', 70, { gender: 'Women', colour: 'Silver' }),
  ...[140, 135, 130, 125, 120].map(price => product(`SKIRT-WORK-${price}`, 'Clothing', price, { gender: 'Women', subcategory: 'Bottoms', product_type: 'Midi Skirt', occasion: 'Work', stock_qty: 40 })),
  product('SKIRT-WORK-LOW', 'Clothing', 90, { gender: 'Women', subcategory: 'Bottoms', product_type: 'Midi Skirt', occasion: 'Work' }),
  product('SHIRT-MEN', 'Clothing', 80, { product_name: 'Fixture Mens Work Shirt', gender: 'Men', subcategory: 'Tops', product_type: 'Shirt', occasion: 'Work', sizes_available: ['S', 'M', 'L'] }),
  product('TROUSERS-MEN', 'Clothing', 100, { gender: 'Men', subcategory: 'Bottoms', product_type: 'Trousers', occasion: 'Work', sizes_available: ['M', 'L'] }),
  product('SHIRT-TRAVEL', 'Clothing', 75, { gender: 'Women', subcategory: 'Tops', product_type: 'Shirt', occasion: 'Travel' }),
  product('JACKET-TRAVEL', 'Clothing', 100, { gender: 'Women', subcategory: 'Outerwear', product_type: 'Jacket', occasion: 'Travel' }),
];
export const journeyVocabulary = { rows: journeyCatalogue,
  sizes: [...new Set(journeyCatalogue.flatMap(product => product.sizes_available))],
  categories: [...['Clothing', 'Shoes', 'Bags', 'Accessories'].map(category => ({ category, subcategory: null })),
    ...journeyCatalogue.map(product => ({ category: product.category, subcategory: product.subcategory }))],
};
