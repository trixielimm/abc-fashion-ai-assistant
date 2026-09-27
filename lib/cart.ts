/**
 * Cart storage helpers.
 * Stores product ID, size, and quantity in localStorage.
 * Components can listen for CART_UPDATED_EVENT to refresh after a cart change.
 */

// Notifies other components when the cart changes so they can update.
export const CART_UPDATED_EVENT = "cart-updated";
const CART_KEY = "abc-fashion-cart";

// Defines the product details stored in the cart in localStorage.
export type StoredCartItem = {
  productId: string;
  size: string;
  quantity: number;
};

// Defines a cart item with product details needed for display.
export type CartRow = StoredCartItem & {
  name: string;
  price: number;
  image: string;
  href: string;
};

// Read saved items and discard entries with an invalid shape.
export function readCart(): StoredCartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(CART_KEY) ?? "[]",
    );

    if (!Array.isArray(value)) return [];

    return value.filter(
      (item): item is StoredCartItem =>
        !!item &&
        typeof item === "object" &&
        typeof item.productId === "string" &&
        typeof item.size === "string" &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0,
    );
  } catch {
    return [];
  }
}

// Save cart items and notify components.
export function writeCart(items: StoredCartItem[]) {
  if (typeof window === "undefined") return;

  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

// Add a new product and size, or increase the quantity.
export function addToCart(item: StoredCartItem) {
  const current = readCart();
  const index = current.findIndex(
    (row) =>
      row.productId === item.productId && row.size === item.size,
  );

  if (index === -1) {
    current.push(item);
  } else {
    current[index] = {
      ...current[index],
      quantity: current[index].quantity + item.quantity,
    };
  }

  writeCart(current);
}