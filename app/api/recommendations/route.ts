import "server-only";

import { randomUUID } from "node:crypto";

import { extractPreferences } from "@/lib/ai/extractPreferences";
import {
  ShoppingPreferencesSchema,
  type ShoppingPreferences,
} from "@/lib/ai/preferenceSchema";

import { getCatalogueProducts } from "@/lib/recommendations/catalogue";
import {
  HardConstraintsSchema,
  filterByHardConstraints,
} from "@/lib/recommendations/hardConstraints";
import {
  SoftPreferencesSchema,
  rankProducts,
} from "@/lib/recommendations/ranking";

import {
  RecommendationRequestSchema,
  type RecommendationErrorResponse,
  type RecommendationProduct,
  type RecommendationResponse,
  type RecommendationStatus,
} from "@/lib/recommendations/apiContract";

export const runtime = "nodejs";

// These are the fields our current filtering and ranking helpers use.
const SUPPORTED_FIELDS: Array<keyof ShoppingPreferences> = [
  "size",
  "min_price",
  "max_price",
  "excluded_colours",
  "category",
  "occasion",
  "style",
  "preferred_colours",
];

const AppliedPreferencesSchema =
  HardConstraintsSchema.and(SoftPreferencesSchema);

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function POST(request: Request) {
  // Keep this first integration available only during development.
  // Review access controls and usage limits before enabling deployment.
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  const requestId = randomUUID();

  let preferences: ShoppingPreferences | null = null;
  let appliedFields: Array<keyof ShoppingPreferences> = [];

  const warnings: string[] = [
    "Single-message prototype: conversation memory is not implemented.",
    "Budgets apply to each product, not the combined cost of an outfit.",
    "Matching uses catalogue labels, not semantic similarity or size conversions.",
  ];

  function send(body: RecommendationResponse, httpStatus = 200) {
    return Response.json(body, {
      status: httpStatus,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  function fail(
    code: RecommendationErrorResponse["code"],
    error: string,
    httpStatus = 500,
    issues?: RecommendationErrorResponse["issues"]
  ) {
    return send(
      {
        success: false,
        request_id: requestId,
        code,
        error,
        issues,
      },
      httpStatus
    );
  }

  function finish(
    status: RecommendationStatus,
    message: string,
    products: RecommendationProduct[] = []
  ) {
    return send({
      success: true,
      request_id: requestId,
      status,
      message,
      preferences,
      applied_preference_fields: appliedFields,
      budget_scope: "per_product",
      products,
      warnings,
    });
  }

  // 1. Accept a JSON request body.
  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    return fail(
      "INVALID_REQUEST",
      "Send the request using Content-Type: application/json.",
      415
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail(
      "INVALID_REQUEST",
      "The request body must contain valid JSON.",
      400
    );
  }

  // 2. Apply the request contract from Step 9.
  const requestValidation = RecommendationRequestSchema.safeParse(body);

  if (!requestValidation.success) {
    return fail(
      "INVALID_REQUEST",
      "Please check the shopping message and product limit.",
      400,
      requestValidation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }))
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return fail(
      "EXTRACTION_FAILED",
      "AI extraction is not configured on the server."
    );
  }

  // This records which stage failed without exposing customer messages.
  let failureCode: RecommendationErrorResponse["code"] =
    "EXTRACTION_FAILED";

  try {
    // 3. Reuse Beatrice's extractor, then validate its returned structure.
    const extracted = ShoppingPreferencesSchema.parse(
      await extractPreferences(requestValidation.data.message)
    );

    preferences = extracted;
    failureCode = "INTERNAL_ERROR";

    // 4. Validate the fields used by our filtering and ranking helpers.
    const preferenceValidation =
      AppliedPreferencesSchema.safeParse(extracted);

    if (!preferenceValidation.success) {
      return finish(
        "needs_clarification",
        "Please clarify the size, colours or price range. " +
          preferenceValidation.error.issues
            .map((issue) => issue.message)
            .join(" ")
      );
    }

    // Keep the full extraction, including fields not yet implemented.
    // Use trimmed values from the additional validation where applicable.
    const checkedPreferences: ShoppingPreferences = {
      ...extracted,
      ...preferenceValidation.data,
    };

    preferences = checkedPreferences;

    const suppliedFields = (
      Object.keys(checkedPreferences) as Array<keyof ShoppingPreferences>
    ).filter((field) => {
      const value = checkedPreferences[field];

      return (
        value !== null &&
        (!Array.isArray(value) || value.length > 0)
      );
    });

    if (suppliedFields.length === 0) {
      return finish(
        "needs_clarification",
        "What fashion products are you looking for? You can describe a category, colour, occasion or budget."
      );
    }

    // Do not silently discard requirements our helpers cannot apply yet.
    const unsupportedFields = suppliedFields.filter(
      (field) => !SUPPORTED_FIELDS.includes(field)
    );

    if (unsupportedFields.length > 0) {
      warnings.push(
        `Extracted fields not yet implemented: ${unsupportedFields.join(", ")}.`
      );

      return finish(
        "needs_clarification",
        "This prototype cannot apply all of those preferences yet. No products were returned because those requirements would otherwise be ignored."
      );
    }

    // A colour cannot be preferred and excluded at the same time.
    const excludedColours =
      checkedPreferences.excluded_colours.map(normalise);

    const conflictingColours =
      checkedPreferences.preferred_colours.filter((colour) =>
        excludedColours.includes(normalise(colour))
      );

    if (conflictingColours.length > 0) {
      return finish(
        "needs_clarification",
        `These colours were both preferred and excluded: ${conflictingColours.join(", ")}. Please clarify which colours to include.`
      );
    }

    // 5. Retrieve the real Supabase catalogue.
    failureCode = "CATALOGUE_UNAVAILABLE";
    const catalogue = await getCatalogueProducts();

    if (catalogue.length === 0) {
      return fail(
        "CATALOGUE_UNAVAILABLE",
        "No catalogue records were available to search. Check the catalogue connection and access settings.",
        503
      );
    }

    failureCode = "INTERNAL_ERROR";

    // 6. Apply the hard filters before scoring.
    const eligible = filterByHardConstraints(
      catalogue,
      checkedPreferences
    );

    appliedFields = suppliedFields;

    if (eligible.length === 0) {
      return finish(
        "no_match",
        "No available products meet the supplied hard constraints. Your size, budget and colour exclusions were not relaxed."
      );
    }

    // 7. Rank only the eligible products.
    const ranked = rankProducts(eligible, checkedPreferences);

    const exactMatches = ranked.filter(
      (item) => item.unmatched_preferences.length === 0
    );

    const candidates =
      exactMatches.length > 0
        ? exactMatches
        : ranked.filter((item) => item.score > 0);

    if (candidates.length === 0) {
      return finish(
        "no_soft_match",
        "Available products meet the hard filters, but none matches the supplied soft preferences using exact catalogue labels."
      );
    }

    // 8. Build the final response using catalogue facts.
    const products: RecommendationProduct[] = candidates
      .slice(0, requestValidation.data.limit)
      .map((item) => {
        const product = item.product;

        let explanation = "Available and in stock.";

        if (item.matched_preferences.length > 0) {
          explanation +=
            ` Matches ${item.matched_preferences.join("; ")}.`;
        } else {
          explanation += " Meets the supplied hard filters.";
        }

        if (item.unmatched_preferences.length > 0) {
          explanation +=
            ` Does not match ${item.unmatched_preferences.join("; ")}.`;
        }

        return {
          product_id: product.product_id,
          product_name: product.product_name,
          category: product.category,
          subcategory: product.subcategory,
          product_type: product.product_type,
          colour: product.colour,
          occasion: product.occasion,
          style: product.style,
          price_aud: product.price_aud,
          sizes_available: product.sizes_available,
          stock_qty: product.stock_qty,
          is_available: product.is_available,
          image_key: product.image_key,

          score: item.score,
          possible_score: item.possible_score,
          matched_preferences: item.matched_preferences,
          unmatched_preferences: item.unmatched_preferences,
          explanation,
        };
      });

    return finish(
      exactMatches.length > 0 ? "recommendations" : "alternatives",
      exactMatches.length > 0
        ? "These products meet the applied filters and supplied soft preferences."
        : "No exact match was found. These alternatives keep the hard constraints; their unmatched preferences are listed.",
      products
    );
  } catch (error) {
    // Do not log API keys, customer messages or raw provider responses.
    console.error({
      request_id: requestId,
      stage: failureCode,
      error_type: error instanceof Error ? error.name : "UnknownError",
    });

    const message =
      failureCode === "EXTRACTION_FAILED"
        ? "Shopping preferences could not be extracted. Please try again."
        : failureCode === "CATALOGUE_UNAVAILABLE"
          ? "The product catalogue could not be loaded. Please try again."
          : "Recommendations could not be completed. Please try again.";

    return fail(
      failureCode,
      message,
      failureCode === "INTERNAL_ERROR" ? 500 : 502
    );
  }
}