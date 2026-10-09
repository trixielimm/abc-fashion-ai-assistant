import "server-only";

import { loadPreferenceValues } from "@/lib/catalogue/preferenceValues";
import { getCatalogueProducts } from "@/lib/recommendations/catalogue";

import {
  CrossSellRequestSchema,
  retrieveCrossSell,
} from "@/lib/search/crossSell";

export const runtime = "nodejs";

const headers = { "Cache-Control": "no-store" };

// Read-only local diagnostic for finding real cross-sell examples.
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  try {
    const catalogue = await getCatalogueProducts();

    const examples = catalogue
      .filter(
        (product) =>
          product.is_available === true &&
          typeof product.stock_qty === "number" &&
          product.stock_qty > 0 &&
          product.cross_sell_category?.trim()
      )
      .slice(0, 3);

    return Response.json(
      {
        total_products: catalogue.length,

        sample_rules: examples.map((product) => ({
          primary_product_id: product.product_id,
          primary_product_name: product.product_name,
          target_category: product.cross_sell_category,

          target_size_labels: [
            ...new Set(
              catalogue
                .filter(
                  (candidate) =>
                    (
                      candidate.category === product.cross_sell_category ||
                      candidate.subcategory === product.cross_sell_category
                    ) &&
                    candidate.is_available === true &&
                    (candidate.stock_qty ?? 0) > 0
                )
                .flatMap(
                  (candidate) => candidate.sizes_available ?? []
                )
                .filter(
                  (size) =>
                    typeof size === "string" &&
                    size.trim().length > 0
                )
            ),
          ],
        })),
      },
      { headers }
    );
  } catch {
    return Response.json(
      { error: "Could not inspect the catalogue." },
      { status: 503, headers }
    );
  }
}

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

  const parsed = CrossSellRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid cross-sell request.",
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
      retrieveCrossSell(catalogue, parsed.data, vocabulary),
      { headers }
    );
  } catch (error) {
    console.error(
      "Cross-sell retrieval failed:",
      error instanceof Error ? error.name : "UnknownError"
    );

    return Response.json(
      { error: "Cross-sell retrieval is unavailable. Please retry." },
      { status: 503, headers }
    );
  }
}