import "server-only";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { interpretConversation } from "@/lib/ai/interpretConversation";
import { getCatalogueProducts } from "@/lib/recommendations/catalogue";
import { loadPreferenceValues } from "@/lib/catalogue/preferenceValues";
import { checkConversationPlan, PlanEvidenceError } from "@/lib/stylist/conversationPlan";
import { EnvelopeSchema, TurnSchema } from "@/lib/stylist/conversationProtocol";
import { ConversationStore, RequestConflictError, RetryExpiredError } from "@/lib/stylist/conversationStore";
import { cancellationReply, finishConversationTurn, interpreterInput, shortcutPlan } from "@/lib/stylist/conversationTurn";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const store = new ConversationStore();

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
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
  const turn = TurnSchema.parse(parsed.data.turn);
  const cancelled = cancellationReply(turn);
  if (cancelled) return Response.json(cancelled, { headers });

  let stage = "interpretation";
  try {
    const result = await store.run(
      request_id, turn, retry,
      async () => {
        const input = interpreterInput(turn);
        const plan = shortcutPlan(turn) ?? await interpretConversation(input, request.signal);
        checkConversationPlan(input, plan);
        return plan;
      },
      async plan => {
        const decision = checkConversationPlan(interpreterInput(turn), plan);
        if (decision.status !== "ready_for_validation") {
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
    );
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