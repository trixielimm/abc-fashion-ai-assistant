import "server-only";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { interpretConversation } from "@/lib/ai/interpretConversation";
import { getCatalogueProductsByIds, getCatalogueProducts } from "@/lib/recommendations/catalogue";
import { loadPreferenceValues } from "@/lib/catalogue/preferenceValues";
import { checkConversationPlan, ConversationPlanSchema, PlanEvidenceError } from "@/lib/stylist/conversationPlan";
import { resolveAnswerProducts } from "@/lib/stylist/conversationAnswers";
import { EnvelopeSchema, TurnReplySchema, TurnSchema } from "@/lib/stylist/conversationProtocol";
import { ConversationStore, RequestConflictError, RetryExpiredError } from "@/lib/stylist/conversationStore";
import { cancellationReply, finishConversationTurn, interpreterInput, resumesAnswerSearch, shortcutPlan } from "@/lib/stylist/conversationTurn";
import { prepareConversationTask } from "@/lib/stylist/taskState";
import { conversationDiagnostic, withConversationDiagnostics } from "@/lib/stylist/conversationDiagnostics";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const store = new ConversationStore();

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.get("host")) throw new Error("Origin mismatch.");
    } catch {
      return Response.json({ error: "Origin not allowed." }, { status: 403, headers });
    }
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return Response.json({ error: "Send JSON." }, { status: 415, headers });
  }

  let body: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing body.");
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = "";
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 64_000) {
        await reader.cancel();
        return Response.json({ error: "Request is too long." }, { status: 413, headers });
      }
      text += decoder.decode(part.value, { stream: true });
    }
    body = JSON.parse(text + decoder.decode());
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers });
  }

  // Continue accepting earlier PowerShell requests as well as the new UI envelope.
  const wrapped = typeof body === "object" && body !== null && "turn" in body;
  const parsed = EnvelopeSchema.safeParse(wrapped ? body : {
    request_id: randomUUID(), retry: false, turn: body,
  });
  if (!parsed.success) {
    return Response.json({ error: "Invalid conversation request." }, { status: 400, headers });
  }
  const { request_id, retry } = parsed.data;
  let turn;
  try { turn = prepareConversationTask(TurnSchema.parse(parsed.data.turn)); }
  catch { return Response.json({ error: "That recovery choice is no longer current. Reply to the latest question.", code: "STALE_RECOVERY" }, { status: 409, headers }); }
  const cancelled = cancellationReply(turn);
  if (cancelled) return Response.json(cancelled, { headers });

  let stage = "interpretation";
  try {
    const began = Date.now();
    const result = await withConversationDiagnostics(request_id, () => store.run(
      request_id, turn, retry,
      async () => {
        const input = interpreterInput(turn);
        const plan = shortcutPlan(turn) ?? await interpretConversation(input, request.signal);
        checkConversationPlan(input, plan);
        return plan;
      },
      async plan => {
        const parsedPlan = ConversationPlanSchema.parse(plan);
        if (process.env.STYLIST_COMMERCE_ENABLED === "false" && ["cross_sell", "upsell"].includes(parsedPlan.action)) {
          return TurnReplySchema.parse({ status: "no_action", action: "none", products: [],
            message: "New outfit and value comparisons are temporarily unavailable. Your outfit choices, budget and cart are unchanged.",
            proposed_scopes: turn.scopes, applied_preferences: null, pending: turn.pending ?? null,
            pending_answer: turn.pending_answer ?? null, styling: turn.styling });
        }
        if (parsedPlan.answer) {
          const resolution = resolveAnswerProducts(interpreterInput(turn), parsedPlan.answer);
          if ((parsedPlan.action === "none" && !resumesAnswerSearch(turn, plan)) || resolution.question) {
            stage = "catalogue";
            // Policy questions and ambiguous references need no catalogue query.
            const known = [turn.context.focused, turn.context.comparison, ...turn.context.latest, ...(turn.context.complementary ?? []), ...(turn.context.previous?.flat() ?? []), ...(turn.context.selected ?? [])];
            const related = resolution.ids.flatMap(id => {
              const context = known.find(product => product?.product_id === id)?.recommendation_context;
              return [...(context?.anchor_ids ?? []), ...(context?.primary_product_id ? [context.primary_product_id] : [])];
            });
            const ids = [...new Set([...resolution.ids, ...related, ...(resolution.ids.length ? turn.styling?.outfit.map(piece => piece.product_id) ?? [] : [])])].slice(0, 24);
            const products = await getCatalogueProductsByIds(ids);
            if (request.signal.aborted) throw new Error("Request cancelled.");
            return finishConversationTurn(products, turn, plan, { rows: [], sizes: [], categories: [] });
          }
        }
        const decision = checkConversationPlan(interpreterInput(turn), plan);
        conversationDiagnostic("validation", { status: decision.status, action: decision.action,
          fields: decision.issues.map(value => `${value.scope}.${value.field}`), generation: turn.task?.generation ?? 0 });
        if (decision.status !== "ready_for_validation" && !resumesAnswerSearch(turn, plan)) {
          return finishConversationTurn([], turn, plan, { rows: [], sizes: [], categories: [] });
        }
        stage = "catalogue";
        const [catalogue, vocabulary] = await Promise.all([
          getCatalogueProducts(), loadPreferenceValues(),
        ]);
        if (!catalogue.length) throw new Error("Catalogue unavailable.");
        if (request.signal.aborted) throw new Error("Request cancelled.");
        stage = "execution";
        return finishConversationTurn(catalogue, turn, plan, vocabulary);
      }
    ));
    const reply = TurnReplySchema.parse(result);
    conversationDiagnostic("response", { request_id, elapsed_ms: Date.now() - began, status: reply.status,
      issue_codes: reply.issues.map(value => value.code), issue_fields: reply.issues.map(value => `${value.scope}.${value.field}`),
      products: reply.products.length + reply.alternatives.length, generation: turn.task?.generation ?? 0 });
    return Response.json(result, { headers });
  } catch (error) {
    console.error("Conversation request failed:", {
      stage,
      type: error instanceof Error ? error.name : "UnknownError",
      evidence_field: error instanceof PlanEvidenceError ? error.field : undefined,
      provider_status: error instanceof OpenAI.APIError ? error.status : undefined,
      provider_code: error instanceof OpenAI.APIError ? error.code : undefined,
      provider_param: error instanceof OpenAI.APIError ? error.param : undefined,
    });
    const expired = error instanceof RetryExpiredError;
    const conflict = error instanceof RequestConflictError;
    return Response.json({
      code: expired ? "RETRY_EXPIRED" : conflict ? "REQUEST_CONFLICT" : stage === "catalogue" ? "CATALOGUE_UNAVAILABLE" : "CONVERSATION_FAILED",
      error: expired || conflict
        ? "This retry cannot be reused. Send the message as a new request."
        : "The request could not be completed safely. No cart changes were made.",
    }, { status: expired || conflict ? 409 : stage === "catalogue" ? 503 : 502, headers });
  }
}
