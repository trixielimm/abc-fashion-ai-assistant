import { z } from "zod";

import type { ShoppingPreferences } from "@/lib/ai/preferenceSchema";
import type { CatalogueProduct } from "./catalogue";

// The JSON body accepted by the future recommendation endpoint.
export const RecommendationRequestSchema = z.strictObject({
  message: z
    .string()
    .trim()
    .min(1, "Please enter a shopping request.")
    .max(2000, "Please keep the shopping request within 2000 characters."),

  limit: z.number().int().min(1).max(6).default(6),
});

// The incoming request may omit limit.
export type RecommendationRequest = z.input<
  typeof RecommendationRequestSchema
>;

// After validation, limit will always have a value.
export type ValidatedRecommendationRequest = z.output<
  typeof RecommendationRequestSchema
>;

export type RecommendationStatus =
  | "recommendations"
  | "alternatives"
  | "no_match"
  | "no_soft_match"
  | "needs_clarification";

// Catalogue facts that the recommendation endpoint will return.
export type RecommendationProduct = Pick<
  CatalogueProduct,
  | "product_id"
  | "product_name"
  | "category"
  | "subcategory"
  | "product_type"
  | "colour"
  | "occasion"
  | "style"
  | "price_aud"
  | "sizes_available"
  | "stock_qty"
  | "is_available"
  | "image_key"
> & {
  score: number;
  possible_score: number;
  matched_preferences: string[];
  unmatched_preferences: string[];
  explanation: string;
};

// A processed shopping request, including no-match or clarification results.
export type RecommendationSuccessResponse = {
  success: true;
  request_id: string;
  status: RecommendationStatus;
  message: string;

  // Keep the full extracted preferences visible.
  preferences: ShoppingPreferences | null;

  // Identify which supplied fields were actually used by the backend.
  applied_preference_fields: Array<keyof ShoppingPreferences>;

  budget_scope: "per_product";
  products: RecommendationProduct[];
  warnings: string[];
};

// An invalid request or a technical failure.
export type RecommendationErrorResponse = {
  success: false;
  request_id: string;
  code:
    | "INVALID_REQUEST"
    | "EXTRACTION_FAILED"
    | "CATALOGUE_UNAVAILABLE"
    | "INTERNAL_ERROR";
  error: string;
  issues?: Array<{
    field: string;
    message: string;
  }>;
};

export type RecommendationResponse =
  | RecommendationSuccessResponse
  | RecommendationErrorResponse;