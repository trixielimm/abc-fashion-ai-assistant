import { getCatalogueProducts } from "@/lib/recommendations/catalogue";

import {
  HardConstraintsSchema,
  filterByHardConstraints,
} from "@/lib/recommendations/hardConstraints";

import {
  SoftPreferencesSchema,
  rankProducts,
} from "@/lib/recommendations/ranking";

export const runtime = "nodejs";

// Validate both groups of preferences.
// This diagnostic route needs at least one soft preference to test ranking.
const CheckSchema = HardConstraintsSchema.and(SoftPreferencesSchema).refine(
  (preferences) =>
    preferences.category !== null ||
    preferences.occasion !== null ||
    preferences.style !== null ||
    preferences.preferred_colours.length > 0,
  {
    message:
      "For this ranking test, provide at least one soft preference.",
  }
);

function readPrice(value: string | null): number | null {
  if (value === null) return null;
  if (value.trim() === "") return Number.NaN;
  return Number(value);
}

export async function GET(request: Request) {
  // Keep this diagnostic route available only during development.
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  const params = new URL(request.url).searchParams;

  const validation = CheckSchema.safeParse({
    size: params.get("size"),
    min_price: readPrice(params.get("min_price")),
    max_price: readPrice(params.get("max_price")),
    excluded_colours: params.getAll("exclude_colour"),

    category: params.get("category"),
    occasion: params.get("occasion"),
    style: params.get("style"),
    preferred_colours: params.getAll("preferred_colour"),
  });

  if (!validation.success) {
    return Response.json(
      {
        success: false,
        error: "Invalid test preferences.",
        issues: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  try {
    // Step 6: Retrieve the catalogue.
    const products = await getCatalogueProducts();

    // Step 7: Apply hard constraints.
    const eligible = filterByHardConstraints(
      products,
      validation.data
    );

    // Step 8: Rank only the products that passed.
    const ranked = rankProducts(eligible, validation.data);

    const exactMatches = ranked.filter(
      (item) => item.unmatched_preferences.length === 0
    );

    // Use exact matches when available.
    // Otherwise, consider products matching at least one soft preference.
    const candidates =
      exactMatches.length > 0
        ? exactMatches
        : ranked.filter((item) => item.score > 0);

    // Return up to six products after filtering and ranking.
    const shortlist = candidates.slice(0, 6);

    let status: string;

    if (eligible.length === 0) {
      status = "no_match";
    } else if (exactMatches.length > 0) {
      status = "recommendations";
    } else if (shortlist.length > 0) {
      status = "alternatives";
    } else {
      status = "no_soft_match";
    }

    return Response.json(
      {
        success: true,
        status,
        preferences: validation.data,
        budget_scope: "per_product",

        total_before_filtering: products.length,
        total_after_filtering: eligible.length,
        exact_match_count: exactMatches.length,

        products: shortlist.map((item) => ({
          product_id: item.product.product_id,
          product_name: item.product.product_name,
          category: item.product.category,
          colour: item.product.colour,
          occasion: item.product.occasion,
          style: item.product.style,
          price_aud: item.product.price_aud,
          sizes_available: item.product.sizes_available,
          stock_qty: item.product.stock_qty,
          is_available: item.product.is_available,

          score: item.score,
          possible_score: item.possible_score,
          matched_preferences: item.matched_preferences,
          unmatched_preferences: item.unmatched_preferences,
        })),
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch {
    console.error(
      "Ranking check failed. Check the catalogue and filtering helpers."
    );

    return Response.json(
      {
        success: false,
        error: "Could not rank products. Check the VS Code terminal.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}