import type { StyleMemoryInput } from "./schema";

const KEY = "abc-fashion-pending-save";

export type PendingSave =
  | { type: "product"; product_id: string }
  | { type: "memory"; memory: StyleMemoryInput }
  | { type: "size"; item_type: "dress" | "shoes"; size_system: string; size_label: string };

export function queuePendingSave(action: PendingSave) {
  sessionStorage.setItem(KEY, JSON.stringify(action));
}

export function readPendingSave(): PendingSave | null {
  try {
    const data: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (!data || typeof data !== "object" || !("type" in data)) return null;
    if (data.type === "product" && "product_id" in data && typeof data.product_id === "string") return data as PendingSave;
    if (data.type === "memory" && "memory" in data) return data as PendingSave;
    if (data.type === "size" && "item_type" in data && "size_system" in data && "size_label" in data) return data as PendingSave;
  } catch { /* Ignore invalid session data. */ }
  return null;
}

export function clearPendingSave() {
  sessionStorage.removeItem(KEY);
}

export function signInForSave(action: PendingSave) {
  queuePendingSave(action);
  const next = window.location.pathname + window.location.search;
  window.location.assign(new URL(`/sign-in?next=${encodeURIComponent(next)}`, window.location.origin).toString());
}
