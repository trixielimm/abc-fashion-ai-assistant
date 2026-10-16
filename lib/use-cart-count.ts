"use client";

import { useSyncExternalStore } from "react";
import { CART_UPDATED_EVENT, readCart } from "@/lib/cart";

function subscribe(onChange: () => void) {
  window.addEventListener(CART_UPDATED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CART_UPDATED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getCount() {
  return readCart().reduce((count, item) => count + item.quantity, 0);
}

export function useCartCount() {
  return useSyncExternalStore(subscribe, getCount, () => 0);
}
