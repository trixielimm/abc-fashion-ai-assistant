/**
 * Cart storage helpers.
 * Stores product ID, size, and quantity in localStorage.
 * Components subscribe to refresh after a cart change in this or another tab.
 */

// Notifies other components when the cart changes so they can update.
const CART_UPDATED_EVENT = "cart-updated";
const CART_KEY = "abc-fashion-cart";
const CART_EXPIRY_KEY = "abc-fashion-cart-expires-at";
const CART_DURATION_MS = 20 * 60 * 1000;

export function getCartExpiresAt(): number | null {
  if (typeof window === "undefined") return null;

  const value = localStorage.getItem(CART_EXPIRY_KEY);
  if (value === null) return null;

  const expiresAt = Number(value);

  return Number.isFinite(expiresAt) && expiresAt > 0
    ? expiresAt
    : null;
}

// Defines the product details stored in the cart in localStorage.
export type StoredCartItem = {
  productId: string;
  size: string;
  quantity: number;
  sizeStock?: number | null;
  productStock?: number | null;
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

  const intervalId = window.setInterval(onChange, 1000);

  return () => {
    window.removeEventListener(CART_UPDATED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    window.clearInterval(intervalId);
  };
}

// Read saved items and discard entries with an invalid shape.
export function readCart(): StoredCartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const expiresAt = getCartExpiresAt();

    if (expiresAt !== null && Date.now() >= expiresAt) {
      return [];
    }

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

function validateCartStock(items: StoredCartItem[]) {
  const productTotals = new Map<string, number>();
  const productLimits = new Map<string, number>();
  const variants = new Set<string>();

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Quantity must be a positive whole number.");
    }

    const variantKey = JSON.stringify([item.productId, item.size]);

    if (variants.has(variantKey)) {
      throw new Error("Duplicate product and size in cart.");
    }

    variants.add(variantKey);

    for (const stock of [item.sizeStock, item.productStock]) {
      if (
        stock != null &&
        (!Number.isInteger(stock) || stock < 0)
      ) {
        throw new Error("Invalid stock quantity.");
      }
    }

    if (
      item.sizeStock != null &&
      item.quantity > item.sizeStock
    ) {
      throw new Error(
        `Only ${item.sizeStock} available in size ${item.size}.`,
      );
    }

    productTotals.set(
      item.productId,
      (productTotals.get(item.productId) ?? 0) + item.quantity,
    );

    if (item.productStock != null) {
      const previousLimit = productLimits.get(item.productId);

      productLimits.set(
        item.productId,
        previousLimit === undefined
          ? item.productStock
          : Math.min(previousLimit, item.productStock),
      );
    }
  }

  for (const [productId, total] of productTotals) {
    const limit = productLimits.get(productId);

    if (limit !== undefined && total > limit) {
      throw new Error(
        `Only ${limit} available for this product across all sizes.`,
      );
    }
  }
}

// Save valid cart items and notify components.
export function writeCart(items: StoredCartItem[]) {
  if (typeof window === "undefined") return;

  validateCartStock(items);

  const previousItems = readCart();
  const previousExpiry = getCartExpiresAt();

  if (items.length === 0) {
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(CART_EXPIRY_KEY);
  } else {
    const keepExistingExpiry =
      previousItems.length > 0 &&
      previousExpiry !== null &&
      previousExpiry > Date.now();

    const expiresAt = keepExistingExpiry
      ? previousExpiry
      : Date.now() + CART_DURATION_MS;

    localStorage.setItem(
      CART_EXPIRY_KEY,
      String(expiresAt),
    );
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }

  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

// Add a product and size, or increase its existing quantity.
export function addToCart(item: StoredCartItem) {
  if (typeof window === "undefined") return;

  if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
    throw new Error("Quantity must be a positive whole number.");
  }

  const current = readCart();

  const index = current.findIndex(
    (row) =>
      row.productId === item.productId &&
      row.size === item.size,
  );

  if (index === -1) {
    current.push({ ...item });
  } else {
    const existing = current[index];

    current[index] = {
      ...existing,
      ...item,
      sizeStock:
        item.sizeStock ?? existing.sizeStock,
      productStock:
        item.productStock ?? existing.productStock,
      quantity: existing.quantity + item.quantity,
    };
  }

  writeCart(current);
}
