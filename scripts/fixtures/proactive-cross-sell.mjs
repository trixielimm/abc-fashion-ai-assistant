// Isolated synthetic acceptance data; never loaded by application routes.
export const dress = { product_id: "D1", product_name: "Synthetic Blue Beach Dress", price_aud: 150,
  category: "Clothing", subcategory: "Dresses", product_type: "Wrap Dress", colour: "Blue",
  occasion: "Beach Wedding", style: "Relaxed", fit: "Regular", season: "Summer", material: "Cotton",
  gender: "Women", brand_line: null, sizes_available: ["10", "12"], stock_qty: 10, is_available: true,
  image_key: null, description: null, tags: [], cross_sell_category: null, pairing_categories: ["Bags", "Shoes"] };
export const second = { ...dress, product_id: "D2", product_name: "Synthetic Second Beach Dress", price_aud: 120, stock_qty: 8 };
export const bag = { ...dress, product_id: "B1", product_name: "Synthetic Neutral Clutch", price_aud: 45,
  category: "Bags", subcategory: "Clutches", product_type: "Clutch", colour: "Beige", material: "Leather",
  sizes_available: ["One Size"], pairing_categories: [], image_key: "test/bag.jpg" };
export const shoes = { ...bag, product_id: "S1", product_name: "Synthetic Wedding Flats", price_aud: 70,
  category: "Shoes", subcategory: "Flats", product_type: "Flats", sizes_available: ["7", "8"], image_key: null };
export const rows = [dress, second, bag, shoes];
export const vocabulary = { rows, sizes: ["10", "12", "7", "8", "One Size"], categories: [
  { category: "Clothing", subcategory: null }, { category: "Clothing", subcategory: "Dresses" },
  { category: "Bags", subcategory: null }, { category: "Bags", subcategory: "Clutches" },
  { category: "Shoes", subcategory: null }, { category: "Shoes", subcategory: "Flats" },
] };
