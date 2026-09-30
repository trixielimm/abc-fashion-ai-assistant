import { extractPreferences } from "@/lib/ai/extractPreferences";
import { validatePreferences } from "@/lib/ai/validatePreferences";
import { loadPreferenceValues } from "@/lib/catalogue/preferenceValues";
import { ShoppingPreferencesSchema } from "@/lib/ai/preferenceSchema";
import { z } from "zod";

const RequestSchema = z.strictObject({
  message: z.string().trim().min(1).max(2000),
  current_preferences: ShoppingPreferencesSchema.optional(),
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
    const preferences = await extractPreferences(
      result.data.message,
      result.data.current_preferences,
    );
    const catalogue = await loadPreferenceValues();
    return Response.json(validatePreferences(preferences, catalogue));
  } catch {
    // Never return provider errors: they may contain sensitive request details.
    return Response.json(
      { error: "Unable to extract or validate shopping preferences. Please try again." },
      { status: 500 },
    );
  }
}
