import "server-only";

import { loadPreferenceValues } from "@/lib/catalogue/preferenceValues";
import { getCatalogueProducts } from "@/lib/recommendations/catalogue";

import {
  retrieveUpsell,
  UpsellRequestSchema,
} from "@/lib/search/upsell";

export const runtime = "nodejs";

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  // Keep this first implementation local while testing.
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    return Response.json(
      { error: "Send JSON." },
      { status: 415, headers }
    );
  }

  let body: unknown;

  try {
    const text = await request.text();

    if (text.length > 8192) {
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

  const parsed = UpsellRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid upsell request.",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400, headers }
    );
  }

  try {
    const [catalogue, vocabulary] = await Promise.all([
      getCatalogueProducts(),
      loadPreferenceValues(),
    ]);

    if (catalogue.length === 0) {
      return Response.json(
        { error: "Catalogue unavailable." },
        { status: 503, headers }
      );
    }

    return Response.json(
      retrieveUpsell(
        catalogue,
        parsed.data,
        vocabulary
      ),
      { headers }
    );
  } catch (error) {
    console.error(
      "Upsell retrieval failed:",
      error instanceof Error
        ? error.name
        : "UnknownError"
    );

    return Response.json(
      { error: "Replacement options could not be loaded. Please retry." },
      { status: 503, headers }
    );
  }
}