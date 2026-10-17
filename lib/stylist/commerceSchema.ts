import { z } from "zod";
import { ProductReferenceSchema } from "./productReference";

export const COMMERCE_POLICY = "stylist-commerce-v1" as const;
export const FeatureKeySchema = z.enum(["lining", "adjustable_strap", "pockets", "zip_closure", "machine_washable", "capacity_litres", "use_cases"]);
export const PrioritySchema = z.enum(["lining", "adjustability", "pockets", "closure", "easy_care", "capacity", "versatility"]);
const booleanKeys = z.enum(["lining", "adjustable_strap", "pockets", "zip_closure", "machine_washable"]);
export const VerifiedFeatureSchema = z.object({
  product_id: z.string().min(1).max(250),
  feature_key: FeatureKeySchema,
  value: z.union([z.boolean(), z.number().finite().positive(), z.array(z.string().trim().min(1).max(100)).min(1).max(12)]),
  source_reference: z.string().trim().min(1).max(1000),
  source_version: z.string().trim().min(1).max(100),
  review_status: z.literal("verified"),
  verified_at: z.string().datetime({ offset: true }),
}).superRefine((feature, ctx) => {
  const valid = feature.feature_key === "capacity_litres" ? typeof feature.value === "number"
    : feature.feature_key === "use_cases" ? Array.isArray(feature.value) : typeof feature.value === "boolean";
  if (!valid) ctx.addIssue({ code: "custom", message: "Feature value does not match its type." });
});
export type VerifiedFeature = z.infer<typeof VerifiedFeatureSchema>;
export const RecommendationContextSchema = z.strictObject({
  anchor_ids: z.array(z.string().min(1).max(250)).max(8),
  primary_product_id: z.string().min(1).max(250).nullable(),
});

export const OutfitPieceSchema = z.strictObject({
  product_id: z.string().trim().min(1).max(250),
  product_name: z.string().trim().min(1).max(250),
  category: z.enum(["Clothing", "Shoes", "Bags", "Accessories"]).nullable(),
  subcategory: z.string().nullable(), product_type: z.string().nullable(),
  price_aud: z.number().nonnegative().optional(),
  ownership: z.enum(["selected", "owned"]),
  recommendation_context: RecommendationContextSchema.optional(),
});
export const StylingStateSchema = z.strictObject({
  outfit: z.array(OutfitPieceSchema).max(8).default([]),
  rejected_ids: z.array(z.string().trim().min(1).max(250)).max(50).default([]),
  priorities: z.array(PrioritySchema).max(7).default([]),
  required_features: z.array(booleanKeys).max(5).default([]),
  offers_paused: z.boolean().default(false),
  owned_categories: z.array(z.enum(["Clothing", "Shoes", "Bags", "Accessories"])).max(4).default([]),
});
export type StylingState = z.infer<typeof StylingStateSchema>;
export const emptyStylingState = (): StylingState => StylingStateSchema.parse({});

export const StylingIntentSchema = z.strictObject({
  preferences: z.array(z.strictObject({
    kind: z.enum(["priority", "requirement"]), operation: z.enum(["add", "remove"]),
    value: z.enum(["lining", "adjustability", "pockets", "closure", "easy_care", "capacity", "versatility", "adjustable_strap", "zip_closure", "machine_washable"]),
    evidence: z.string().trim().min(1).max(250),
  })).max(12),
  outfit_changes: z.array(z.strictObject({
    operation: z.enum(["keep", "own", "remove", "reject"]), reference: ProductReferenceSchema,
    evidence: z.string().trim().min(1).max(250),
  })).max(8),
  offers: z.strictObject({ paused: z.boolean(), evidence: z.string().trim().min(1).max(250) }).nullable(),
  owned_categories: z.array(z.strictObject({
    category: z.enum(["Clothing", "Shoes", "Bags", "Accessories"]),
    operation: z.enum(["add", "remove"]), evidence: z.string().trim().min(1).max(250),
  })).max(4),
});
export type StylingIntent = z.infer<typeof StylingIntentSchema>;

export const PairingEvidenceSchema = z.object({
  policy_version: z.literal(COMMERCE_POLICY),
  anchor_ids: z.array(z.string().min(1)).min(1).max(8),
  reasons: z.array(z.string().min(1)).min(1).max(12),
  limitations: z.array(z.string().min(1)).max(12),
  level: z.enum(["catalogue_supported", "limited"]),
});
export const ValueComparisonSchema = z.object({
  policy_version: z.literal(COMMERCE_POLICY),
  primary_product_id: z.string().min(1),
  primary_price_aud: z.number().nonnegative(),
  extra_cost_aud: z.number().finite(),
  benefits: z.array(z.object({
    feature_key: FeatureKeySchema, label: z.string().min(1),
    evidence_kind: z.enum(["verified", "synthetic"]).optional(),
    before: z.union([z.boolean(), z.number(), z.array(z.string())]),
    after: z.union([z.boolean(), z.number(), z.array(z.string())]),
    source_references: z.array(z.string().min(1)).min(2).max(2),
  })).max(7),
  context_benefits: z.array(z.string().min(1)).max(4),
  tradeoffs: z.array(z.string().min(1)).max(12),
  kind: z.enum(["upgrade", "alternative"]),
}).refine(value => value.benefits.length + value.context_benefits.length > 0, "A comparison requires a demonstrated benefit.");

export const RecommendationEventSchema = z.strictObject({
  event_id: z.string().uuid(), session_id: z.string().uuid(), recommendation_id: z.string().uuid(),
  event_type: z.enum(["impression", "select", "own", "reject", "add_to_cart"]),
  product_id: z.string().trim().min(1).max(250),
  position: z.number().int().min(1).max(4),
  policy_version: z.literal(COMMERCE_POLICY),
});
