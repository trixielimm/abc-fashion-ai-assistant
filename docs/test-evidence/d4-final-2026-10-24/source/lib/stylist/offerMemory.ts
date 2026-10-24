import type { Session } from "./conversationProtocol";
import { emptyTaskState } from "./taskState";
import { emptyStylingState } from "./commerceSchema";

const key = "abc-stylist-offers-v1";
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
export function browserOfferStorage() {
  try { return typeof window === "undefined" ? undefined : window.sessionStorage; } catch { return undefined; }
}

// Only offer preferences are retained in this tab, never messages or product IDs.
export function restoreOfferMemory(session: Session, storage?: Storage): Session {
  try {
    const data = JSON.parse(storage?.getItem(key) ?? "null");
    if (!data || typeof data.shown !== "boolean" || typeof data.dismissed !== "boolean" ||
        typeof data.paused !== "boolean" || !Number.isSafeInteger(data.generation) || data.generation < 0) return session;
    return { ...session, task: { ...(session.task ?? emptyTaskState()), generation: data.generation,
      complementary_shown: data.shown, complementary_dismissed: data.dismissed },
      styling: { ...(session.styling ?? emptyStylingState()), offers_paused: data.paused } };
  } catch { return session; }
}

export function saveOfferMemory(session: Session, storage?: Storage) {
  try { storage?.setItem(key, JSON.stringify({ generation: session.task?.generation ?? 0,
    shown: session.task?.complementary_shown ?? false, dismissed: session.task?.complementary_dismissed ?? false,
    paused: session.styling?.offers_paused ?? false })); } catch { /* Storage is optional. */ }
}

export function clearOfferMemory(storage?: Storage) {
  try { storage?.removeItem(key); } catch { /* Storage is optional. */ }
}

export function dismissComplementaryOffer(session: Session, pause: boolean): Session {
  return { ...session, task: { ...(session.task ?? emptyTaskState()), complementary_dismissed: true },
    styling: { ...(session.styling ?? emptyStylingState()), ...(pause ? { offers_paused: true } : {}) } };
}
