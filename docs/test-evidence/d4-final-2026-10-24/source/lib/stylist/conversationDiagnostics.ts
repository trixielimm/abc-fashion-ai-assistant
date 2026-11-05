import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
const context = new AsyncLocalStorage<{ request_id: string; started: number }>();
export function withConversationDiagnostics<T>(requestId: string, work: () => Promise<T>) {
  return context.run({ request_id: requestId, started: Date.now() }, work);
}
export function conversationDiagnostic(stage: string, detail: Record<string, string | number | boolean | null | string[]>) {
  if (process.env.STYLIST_DIAGNOSTICS_ENABLED !== "true") return;
  try {
    const current = context.getStore();
    console.info("Stylist diagnostic", { request_id: current?.request_id ?? "local-diagnosis", stage,
      elapsed_ms: current ? Date.now() - current.started : null, ...detail });
  } catch { /* Observability must never block shopping. */ }
}
