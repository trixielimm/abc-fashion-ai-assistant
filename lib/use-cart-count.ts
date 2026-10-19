"use client";

import { useSyncExternalStore } from "react";
import { readCart, subscribeToCart } from "@/lib/cart";

function getCount() {
  return readCart().reduce((count, item) => count + item.quantity, 0);
}

export function useCartCount() {
  return useSyncExternalStore(subscribeToCart, getCount, () => 0);
}
