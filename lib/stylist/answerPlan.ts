import { z } from "zod";
import { ProductReferenceSchema } from "./productReference";
import { ConversationChangeSchema } from "./conversationChanges";

// The model selects questions and references; it never supplies product facts.
export const AnswerIntentSchema = z.strictObject({
  kind: z.enum(["product", "compare", "policy"]),
  topics: z.array(z.enum([
    "recommendation", "material", "fit", "sizes", "availability", "price",
    "care", "quality", "delivery", "returns", "payment", "general",
  ])).min(1).max(12),
  references: z.array(ProductReferenceSchema).max(4),
  // An exact quotation of the occasion/use mentioned by the customer, or null.
  purpose: z.string().trim().min(1).max(150).nullable(),
  continuation: z.boolean(),
});
export type AnswerIntent = z.infer<typeof AnswerIntentSchema>;

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
