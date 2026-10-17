import { z } from "zod";
import { ShoppingPreferencesSchema } from "../ai/preferenceSchema";
import { OPTIONS_PER_COMPONENT } from "./conversationLimits";

// A total belongs to the complete requested set, never to each item search.
export const OutfitRequestSchema = z.strictObject({
  total_budget_aud: z.number().finite().nonnegative().multipleOf(0.01),
  items: z.array(ShoppingPreferencesSchema).min(2).max(4),
  evidence: z.string().trim().min(1).max(250),
});
export type OutfitRequest = z.infer<typeof OutfitRequestSchema>;

export const OutfitBudgetSchema = z.strictObject({
  limit_aud: z.number().finite().nonnegative(),
  total_aud: z.number().finite().nonnegative(),
  remaining_aud: z.number().finite().nonnegative(),
  items: z.array(z.strictObject({
    product_id: z.string().min(1),
    preferences: ShoppingPreferencesSchema,
  })).min(2).max(4),
});
export type OutfitBudget = z.infer<typeof OutfitBudgetSchema>;
export const OutfitChoicesSchema = z.strictObject({
  groups: z.array(z.strictObject({
    label: z.string().min(1).max(100),
    product_ids: z.array(z.string().min(1)).min(1).max(OPTIONS_PER_COMPONENT),
    preferences: ShoppingPreferencesSchema,
  })).min(2).max(4),
  maximum_total_aud: z.number().finite().nonnegative(),
});
export type OutfitChoices = z.infer<typeof OutfitChoicesSchema>;
export const priceCents = (value: number) => Math.round(value * 100);
