import "server-only";

import { interpretConversation } from "@/lib/ai/interpretConversation";

import {
  checkConversationPlan,
  ConversationPlanRequestSchema,
} from "@/lib/stylist/conversationPlan";

export const runtime = "nodejs";

const headers = {
  "Cache-Control": "no-store",
};

export async function POST(request: Request) {
  // Diagnostic integration only.
  // Do not expose this unprotected route publicly.
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

    if (text.length > 64_000) {
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

  const input = ConversationPlanRequestSchema.safeParse(body);

  if (!input.success) {
    return Response.json(
      { error: "Invalid conversation context." },
      { status: 400, headers }
    );
  }

  try {
    const plan = await interpretConversation(
      input.data,
      request.signal
    );

    return Response.json(
      checkConversationPlan(input.data, plan),
      { headers }
    );
  } catch (error) {
    console.error(
      "Conversation interpretation failed:",
      error instanceof Error ? error.name : "UnknownError"
    );

    return Response.json(
      {
        error:
          "The shopping request could not be interpreted safely. No search or cart action was performed.",
      },
      { status: 502, headers }
    );
  }
}