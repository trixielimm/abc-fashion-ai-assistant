import "server-only";

import { interpretConversation } from "@/lib/ai/interpretConversation";
import { getCatalogueProducts } from "@/lib/recommendations/catalogue";
import { loadPreferenceValues } from "@/lib/catalogue/preferenceValues";

import {
  checkConversationPlan,
  ConversationPlanRequestSchema,
} from "@/lib/stylist/conversationPlan";

import { executeConversationSearch } from "@/lib/stylist/conversationSearch";

export const runtime = "nodejs";

const headers = {
  "Cache-Control": "no-store",
};

export async function POST(request: Request) {
  // Keep this integration local while it is being tested.
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  const type = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();

  if (type !== "application/json") {
    return Response.json(
      { error: "Send JSON." },
      { status: 415, headers }
    );
  }

  let body: unknown;

  try {
    const text = await request.text();

    if (new TextEncoder().encode(text).byteLength > 64_000) {
      return Response.json(
        { error: "Request is too long." },
        { status: 413, headers }
      );
    }

    body = JSON.parse(text);
  } catch {
    return Response.json(
      { error: "Invalid JSON." },
      { status: 400, headers }
    );
  }

  const parsed = ConversationPlanRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid conversation context." },
      { status: 400, headers }
    );
  }

  let stage:
    | "interpretation"
    | "catalogue"
    | "execution" = "interpretation";

  try {
    // One interpreter call. Do not call the old extractor as well.
    const plan = await interpretConversation(
      parsed.data,
      request.signal
    );

    const decision = checkConversationPlan(
      parsed.data,
      plan
    );

    if (decision.status !== "ready_for_validation") {
      // The executor returns before catalogue validation
      // for clarification and no-action decisions.
      return Response.json(
        executeConversationSearch(
          [],
          parsed.data,
          plan,
          {
            rows: [],
            sizes: [],
            categories: [],
          }
        ),
        { headers }
      );
    }

    stage = "catalogue";

    const [catalogue, vocabulary] = await Promise.all([
      getCatalogueProducts(),
      loadPreferenceValues(),
    ]);

    if (catalogue.length === 0) {
      throw new Error("No visible catalogue.");
    }

    if (request.signal.aborted) {
      return new Response(null, {
        status: 408,
        headers,
      });
    }

    stage = "execution";

    return Response.json(
      executeConversationSearch(
        catalogue,
        parsed.data,
        plan,
        vocabulary
      ),
      { headers }
    );
  } catch (error) {
    console.error("Conversation search failed [diagnostic]:", {
  stage,
  type: error instanceof Error ? error.name : "UnknownError",
  message:
    error instanceof Error
      ? error.message
          .replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]")
          .slice(0, 1500)
      : "Unknown error",
  status:
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : null,
});

    return Response.json(
      {
        code:
          stage === "catalogue"
            ? "CATALOGUE_UNAVAILABLE"
            : "CONVERSATION_FAILED",
        error:
          "The request could not be completed safely. No cart changes were made.",
      },
      {
        status: stage === "catalogue" ? 503 : 502,
        headers,
      }
    );
  }
}