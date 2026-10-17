import { z } from "zod";
import { AnswerIntentSchema } from "../stylist/answerPlan";
import { ExternalItemChangeSchema, StylingIntentSchema } from "../stylist/commerceSchema";
import { ConversationPlanSchema, PlanValidationError } from "../stylist/conversationPlan";
import { OutfitRequestSchema } from "../stylist/outfitBudgetSchema";

// A uniform transport shape avoids making the model choose between many almost
// identical union branches. The domain schema still validates field/value types.
export const ModelChangeSchema = z.strictObject({
  scope: z.enum(["item", "shared"]),
  field: z.enum(["gender", "category", "subcategory", "product_type", "occasion", "style", "preferred_colours", "excluded_colours", "season", "material", "fit", "size", "min_price", "max_price", "brand_line", "unresolved"]),
  operation: z.enum(["set", "add", "remove"]),
  text_value: z.string().nullable().describe("Text/enum field value, or null. Never use for a price or list."),
  number_value: z.number().nullable().describe("Numeric price only. Null for all other fields."),
  list_values: z.array(z.string()).describe("Colour or unresolved labels only. Empty for scalar fields."),
  evidence: z.string().min(1).max(250).describe("Exact contiguous quotation from the latest customer message."),
});
export const ModelPlanSchema = ConversationPlanSchema.extend({
  outfit_request: OutfitRequestSchema.nullable(),
  changes: z.array(ModelChangeSchema).max(24),
  continuation: z.boolean(),
  answer: AnswerIntentSchema.nullable(),
  styling_intent: StylingIntentSchema.extend({ external_items: z.array(ExternalItemChangeSchema).max(8) }).nullable(),
});
export function decodeModelPlan(input: unknown) {
  const plan = ModelPlanSchema.parse(input);
  const changes = plan.changes.flatMap(({ text_value, number_value, list_values, ...change }) => {
    const list = ["preferred_colours", "excluded_colours", "unresolved"].includes(change.field);
    const price = ["min_price", "max_price"].includes(change.field);
    if ((list && (text_value !== null || number_value !== null)) ||
        (price && (text_value !== null || list_values.length)) ||
        (!list && !price && (number_value !== null || list_values.length))) {
      throw new PlanValidationError(`Use only the matching value slot for ${change.field}: text_value, number_value or list_values.`);
    }
    if (list && !list_values.length) {
      if (change.operation === "remove") return [];
      if (!(change.field === "preferred_colours" && change.operation === "set")) {
        throw new PlanValidationError(`${change.field} ${change.operation} needs at least one label. Omit unused list changes; do not emit an empty unresolved or exclusion change.`);
      }
    }
    return [{ ...change, value: list ? list_values : price ? number_value : text_value }];
  });
  return ConversationPlanSchema.parse({ ...plan, changes });
}
