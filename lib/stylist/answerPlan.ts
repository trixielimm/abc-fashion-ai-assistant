import { z } from "zod";
import { ProductReferenceSchema } from "./productReference";
import { ConversationChangeSchema } from "./conversationChanges";

// The model selects questions and references; it never supplies product facts.
export const AnswerIntentSchema = z.strictObject({
  kind: z.enum(["product", "compare", "policy", "outfit_review", "guidance", "combination"]),
  topics: z.array(z.enum([
    "recommendation", "material", "fit", "sizes", "availability", "price",
    "care", "quality", "delivery", "returns", "payment", "general", "total_price",
  ])).min(1).max(13),
  references: z.array(ProductReferenceSchema).max(4),
  // An exact quotation of the occasion/use mentioned by the customer, or null.
  purpose: z.string().trim().min(1).max(150).nullable(),
  continuation: z.boolean(),
});
export type AnswerIntent = z.infer<typeof AnswerIntentSchema>;

export const CombinationSummarySchema = z.strictObject({
  items: z.array(z.strictObject({ product_id: z.string().min(1), quantity: z.number().int().min(1).max(20),
    unit_price_aud: z.number().nonnegative().nullable(), owned: z.boolean() })).min(1).max(4),
  purchase_total_aud: z.number().nonnegative().nullable(),
  limit_aud: z.number().nonnegative().nullable(),
  remaining_aud: z.number().nullable(),
}).superRefine((value, ctx) => {
  const cents = (n: number) => Math.round(n * 100);
  const known = value.items.every(item => item.owned || item.unit_price_aud !== null);
  const sum = value.items.reduce((total, item) => total + (item.owned ? 0 : cents(item.unit_price_aud ?? 0) * item.quantity), 0);
  if (new Set(value.items.map(item => item.product_id)).size !== value.items.length ||
      (known ? value.purchase_total_aud === null || cents(value.purchase_total_aud) !== sum : value.purchase_total_aud !== null) ||
      (value.limit_aud !== null && value.purchase_total_aud !== null
        ? value.remaining_aud === null || cents(value.remaining_aud) !== cents(value.limit_aud) - sum : value.remaining_aud !== null)) {
    ctx.addIssue({ code: "custom", message: "The named combination total is inconsistent." });
  }
});

// Independent of a pending search: a policy interjection must not replace it.
export const PendingAnswerSchema = z.strictObject({
  intent: AnswerIntentSchema,
  question: z.string().min(1).max(2000),
  follow_up: z.strictObject({
    action: z.enum(["new_search", "refine", "cross_sell", "cheaper", "upsell"]),
    reference: ProductReferenceSchema.nullable(),
    changes: z.array(ConversationChangeSchema).max(24),
  }).nullable().default(null),
});

export const AnswerSourceSchema = z.strictObject({
  label: z.string().min(1).max(250),
  url: z.string().regex(/^\/products\/[^/?#]+(?:#delivery-returns)?$/),
});
