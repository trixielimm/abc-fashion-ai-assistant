import { z } from "zod";
import { statedCombinedBudget } from "./combinedShoppingRequest";
import { ExcludedRoleSchema, recipientFromMessage, uncertainRecipientSize, shoppingRoleExclusions } from "./shoppingContext";

// Customer context is distinct from catalogue filters and product claims.
export const ShoppingBriefSchema = z.strictObject({
  goal: z.enum(["travel_layers", "bolder_style", "flexible_fit"]).nullable().default(null),
  total_budget_aud: z.number().finite().nonnegative().nullable().default(null),
  budget_evidence: z.string().max(250).nullable().default(null),
  guidance: z.array(z.string().min(1).max(100)).max(6).default([]),
  deadline: z.string().max(100).nullable().default(null),
  gift_recipient: z.string().min(1).max(100).nullable().default(null),
  uncertain_recipient_size: z.boolean().default(false),
  excluded_roles: z.array(ExcludedRoleSchema).max(7).default([]),
  occasion_context: z.string().max(100).nullable().default(null),
});
export type ShoppingBrief = z.infer<typeof ShoppingBriefSchema>;
export function updateShoppingBrief(previous: ShoppingBrief, message: string): ShoppingBrief {
  const brief = structuredClone(previous);
  brief.gift_recipient = recipientFromMessage(message) ?? brief.gift_recipient;
  if (brief.gift_recipient && uncertainRecipientSize(message)) brief.uncertain_recipient_size = true;
  brief.excluded_roles = shoppingRoleExclusions(message, brief.excluded_roles);
  const occasion = message.match(/\b(?:beach wedding|birthday dinner|dinner|office|(?:for|at|to) work|workplace|workwear|weekends?|everyday wear|wedding guest)\b/i);
  if (occasion) brief.occasion_context = occasion[0];
  if (/\b(?:trip|travel|packing|wardrobe)\b/i.test(message) && /\b(?:warm|cool|layer|versatile|small|pieces)\b/i.test(message)) brief.goal = "travel_layers";
  if (/\b(?:want|need|try|show|something|look|like)\b[^.!?]{0,80}\b(?:bold|bolder|bright)\b/i.test(message)) brief.goal = "bolder_style";
  if (/\b(?:flexible fit|size may change|changing (?:body|size))\b/i.test(message)) brief.goal = "flexible_fit";
  const amount = statedCombinedBudget(message);
  if (amount !== null) { brief.total_budget_aud = amount; brief.budget_evidence = message.slice(0, 250); }
  const guidance = message.match(/\b(?:bright colou?rs?|bold(?:er)?(?: look| style)?|flexible fit|warm afternoons|cool evenings)\b/gi) ?? [];
  brief.guidance = [...new Set([...brief.guidance, ...guidance])].slice(-6);
  const deadline = message.match(/\b(?:by (?:this |next )?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|tomorrow|tonight)|this weekend)\b/i);
  if (deadline) brief.deadline = deadline[0];
  return ShoppingBriefSchema.parse(brief);
}
