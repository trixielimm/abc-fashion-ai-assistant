import { z } from "zod";
import {
  ShoppingPreferencesSchema,
  type ShoppingPreferences,
} from "../ai/preferenceSchema";

const normalise = (value: string | null) =>
  (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const money = z.number().nonnegative().refine((value) => {
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) &&
    Math.abs(value * 100 - cents) < 0.000001;
}, "Use an AUD amount with at most two decimal places.");

const OptionSchema = z.object({
  product_id: z.string().trim().min(1),
  product_name: z.string().trim().min(1),
  price_aud: money,
  brand_line: z.string().nullable(),
  category: z.string().trim().min(1),
  subcategory: z.string().trim().min(1),
  product_type: z.string().trim().min(1),
  colour: z.string().nullable(),
  sizes_available: z.array(z.string().trim().min(1)).min(1),
  extra_cost_aud: money.refine((value) => value > 0),
  improved_preferences: z.array(z.string().trim().min(1)).min(1),
  unmatched_preferences: z.array(z.string().trim().min(1)),
  explanation: z.string().trim().min(1),
});

const ReplySchema = z.object({
  status: z.enum([
    "options", "no_upsell", "needs_more_detail",
    "primary_unavailable", "primary_mismatch",
  ]),
  message: z.string().min(1),
  primary_product_id: z.string().min(1),
  primary_price_aud: money.nullable(),
  budget_scope: z.literal("per_replacement_item"),
  applied_preferences: ShoppingPreferencesSchema.nullable(),
  products: z.array(OptionSchema).max(4),
});

export type UpsellOption = z.infer<typeof OptionSchema>;
export type UpsellReply = z.infer<typeof ReplySchema>;

export type UpsellPrimary = {
  product_id: string;
  product_name: string;
  category: string | null;
  subcategory: string | null;
  product_type: string | null;
};

export function buildUpsellRequest(
  primaryId: string,
  context: ShoppingPreferences
) {
  const preferences = ShoppingPreferencesSchema.parse(context);

  if (!primaryId.trim()) throw new Error("Choose a product first.");

 if (preferences.size !== null && !preferences.size.trim()) {
  throw new Error("A supplied size cannot be blank.");
}

if (preferences.max_price !== null) {
  money.parse(preferences.max_price);
}

  if (
  preferences.min_price !== null &&
  preferences.max_price !== null &&
  preferences.min_price > preferences.max_price
) {
    throw new Error("Clarify the price range in the main chat first.");
  }

  // No higher-budget field and no client-supplied product price.
  return { primary_product_id: primaryId.trim(), preferences };
}

function samePreferences(
  actual: ShoppingPreferences,
  requested: ShoppingPreferences
): boolean {
  function comparable(value: unknown): unknown {
    if (typeof value === "string") return normalise(value);
    if (Array.isArray(value)) {
      return [...new Set(value.map((label: string) => normalise(label)))].sort();
    }
    return value;
  }

  return (Object.keys(requested) as Array<keyof ShoppingPreferences>).every(
    (key) => JSON.stringify(comparable(actual[key])) ===
      JSON.stringify(comparable(requested[key]))
  );
}

export function readUpsellResponse(
  input: unknown,
  request: ReturnType<typeof buildUpsellRequest>,
  primary: UpsellPrimary
): UpsellReply {
  const result = ReplySchema.parse(input);
  const hasOptions = result.status === "options";

  function reject(): never {
    throw new Error("The replacement response could not be verified. Refresh the main search.");
  }

  if (
    primary.product_id !== request.primary_product_id ||
    result.primary_product_id !== request.primary_product_id ||
    hasOptions !== (result.products.length > 0)
  ) reject();

  if (!hasOptions) return result;

  const max = request.preferences.max_price;
  const min = request.preferences.min_price ?? 0;
  const size = request.preferences.size;
  const original = result.primary_price_aud;

  if (
    original === null ||
(max !== null && original > max) || original < min ||
    !result.applied_preferences ||
    !samePreferences(result.applied_preferences, request.preferences)
  ) reject();

  const ids = new Set<string>();
  const identity = ["category", "subcategory", "product_type"] as const;

  for (const product of result.products) {
    if (
      ids.has(product.product_id) ||
      product.product_id === primary.product_id ||
      product.price_aud <= original ||
(max !== null && product.price_aud > max) ||
      product.price_aud < min ||
      Math.round(product.extra_cost_aud * 100) !==
        Math.round(product.price_aud * 100) - Math.round(original * 100) ||
      (size !== null && !product.sizes_available.some(
  (label) => normalise(label) === normalise(size)
)) ||
      identity.some((field) =>
        !normalise(primary[field]) ||
        normalise(product[field]) !== normalise(primary[field])
      )
    ) reject();

    ids.add(product.product_id);
  }

  return result;
}