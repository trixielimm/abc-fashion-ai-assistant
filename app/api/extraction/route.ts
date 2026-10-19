import {
  FollowUpKindSchema,
  resolveFollowUp,
} from "@/lib/ai/resolveFollowUp";
import { extractPreferences } from "@/lib/ai/extractPreferences";
import { validatePreferences } from "@/lib/ai/validatePreferences";
import { loadPreferenceValues } from "@/lib/catalogue/preferenceValues";
import { ShoppingPreferencesSchema } from "@/lib/ai/preferenceSchema";
import { z } from "zod";

const RequestSchema = z.strictObject({
  message: z.string().trim().min(1).max(2000),
  current_preferences: ShoppingPreferencesSchema.optional(),
  pending_follow_up: FollowUpKindSchema.optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const result = RequestSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: "message must be between 1 and 2000 characters." },
      { status: 400 },
    );
  }

  try {
    const catalogue = await loadPreferenceValues();

const followUp = resolveFollowUp(
  result.data.message,
  result.data.current_preferences,
  catalogue,
  result.data.pending_follow_up
);

// Recognised guided follow-ups do not need another extraction call.
// Other messages continue through the existing extractor.
const preferences = followUp
  ? followUp.preferences
  : await extractPreferences(
      result.data.message,
      result.data.current_preferences
    );

const validation = validatePreferences(preferences, catalogue);
const question = followUp?.question ?? null;

return Response.json(
  {
    ...validation,
    follow_up_question: question,
    needs_clarification:
      validation.needs_clarification || question !== null,
  },
  {
    headers: { "Cache-Control": "no-store" },
  }
);
  } catch {
    // Never return provider errors: they may contain sensitive request details.
    return Response.json(
      { error: "Unable to extract or validate shopping preferences. Please try again." },
      { status: 500 },
    );
  }
}
