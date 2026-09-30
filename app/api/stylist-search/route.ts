import { ShoppingPreferencesSchema } from "@/lib/ai/preferenceSchema";
import { generateRecommendation } from "@/lib/ai/generateRecommendation";
import { getCatalogueProducts } from "@/lib/recommendations/catalogue";
import { searchByPreferences } from "@/lib/search/preferenceSearch";
import { z } from "zod";

export const runtime = "nodejs";

const RequestSchema = z.strictObject({ preferences: ShoppingPreferencesSchema });
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") {
    return Response.json({ error: "Send JSON preferences." }, { status: 415, headers });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 8_192) {
      return Response.json({ error: "Preferences are too long." }, { status: 413, headers });
    }
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400, headers });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid shopping preferences." }, { status: 400, headers });
  }

  try {
    // Ask for a more specific request before querying Supabase when the
    // extracted message has no useful product or occasion information.
    const preflight = searchByPreferences([], parsed.data.preferences);
    if (preflight.status === "needs_more_detail") {
      return Response.json(preflight, { headers });
    }

    // Chat already extracted these preferences. Retrieve real products before
    // asking OpenAI to choose grounded explanation points from the shortlist.
    const catalogue = await getCatalogueProducts();
    if (catalogue.length === 0) {
      return Response.json(
        { error: "The product catalogue is unavailable. Please try again." },
        { status: 503, headers },
      );
    }
    const result = searchByPreferences(catalogue, parsed.data.preferences);
    if (result.products.length === 0) return Response.json(result, { headers });

    try {
      const message = await generateRecommendation(parsed.data.preferences, result.products);
      return Response.json({ ...result, message }, { headers });
    } catch (error) {
      // Recommendation wording must never hide valid catalogue results.
      console.error("Recommendation wording failed:", error instanceof Error ? error.name : "UnknownError");
      return Response.json(result, { headers });
    }
  } catch (error) {
    console.error("Stylist catalogue search failed:", error instanceof Error ? error.name : "UnknownError");
    return Response.json(
      { error: "The product catalogue is unavailable. Please try again." },
      { status: 503, headers },
    );
  }
}
