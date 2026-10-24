/**
 * Cart storage helpers.
 * Stores product ID, size, and quantity in localStorage.
 * Components subscribe to refresh after a cart change in this or another tab.
 */

// Notifies other components when the cart changes so they can update.
const CART_UPDATED_EVENT = "cart-updated";
const CART_KEY = "abc-fashion-cart";

// Defines the product details stored in the cart in localStorage.
export type StoredCartItem = {
  productId: string;
  size: string;
  quantity: number;
  name?: string;
  price?: number;
  image?: string | null;
  category?: string | null;
};

// Defines a cart item with product details needed for display.
export type CartRow = StoredCartItem & {
  name: string;
  price: number;
  image: string | null;
  href: string;
};

export function subscribeToCart(onChange: () => void) {
  window.addEventListener(CART_UPDATED_EVENT, onChange);
  window.addEventListener("storage", onChange);

  return () => {
    window.removeEventListener(CART_UPDATED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

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
        item.quantity > 0 &&
        (item.name === undefined || typeof item.name === "string") &&
        (item.price === undefined ||
          (typeof item.price === "number" && Number.isFinite(item.price) && item.price >= 0)) &&
        (item.image === undefined || item.image === null || typeof item.image === "string") &&
        (item.category === undefined || item.category === null || typeof item.category === "string"),
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
      ...item,
      quantity: current[index].quantity + item.quantity,
    };
  }

  writeCart(current);
}
