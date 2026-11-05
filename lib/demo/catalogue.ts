import rows from "./catalogue.json";
import type { CatalogueProduct } from "../recommendations/catalogue";
import type { ChatProduct } from "../stylist/conversationProtocol";

// Isolated stage data, not live stock. Photos retain their original colours.
export const demoCatalogue: CatalogueProduct[] = rows;

export function getDemoProduct(id: string) {
  return demoCatalogue.find(product => product.product_id === id) ?? null;
}

export function demoChatProduct(id: string): ChatProduct {
  const product = getDemoProduct(id);
  if (!product?.product_id || !product.product_name || product.price_aud === null) {
    throw new Error(`Missing presentation product: ${id}`);
  }
  return {
    product_id: product.product_id, product_name: product.product_name,
    price_aud: product.price_aud, category: product.category as ChatProduct["category"],
    subcategory: product.subcategory, product_type: product.product_type,
    brand_line: product.brand_line, colour: product.colour, occasion: product.occasion,
    style: product.style, sizes_available: product.sizes_available ?? [],
    image_src: product.image_key, unverified_requirements: [], extra_target: product.category === "Clothing" ? "Bags" : null,
  };
}
