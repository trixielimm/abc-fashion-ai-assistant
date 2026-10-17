import { z } from "zod";
import { ShoppingPreferencesSchema } from "../ai/preferenceSchema";

const text = z.string().trim().min(1).max(250);
const changeContext = {
  scope: z.enum(["item", "shared"]),
  evidence: text,
};
const scalarChange = { ...changeContext, operation: z.literal("set") };
const labels = z.array(text).min(1).max(12);

// Keep the model's value type tied to its field. A broad value union allowed
// strings for unresolved lists and arbitrary labels for enum preferences.
export const ConversationChangeSchema = z.discriminatedUnion("field", [
  z.strictObject({
    ...scalarChange,
    field: z.literal("gender"),
    value: ShoppingPreferencesSchema.shape.gender,
  }),
  z.strictObject({
    ...scalarChange,
    field: z.literal("category"),
    value: ShoppingPreferencesSchema.shape.category,
  }),
  z.strictObject({
    ...scalarChange,
    field: z.literal("brand_line"),
    value: ShoppingPreferencesSchema.shape.brand_line,
  }),
  z.strictObject({
    ...scalarChange,
    field: z.enum(["min_price", "max_price"]),
    value: z.number().nonnegative().nullable(),
  }),
  z.strictObject({
    ...scalarChange,
    field: z.enum(["subcategory", "product_type", "occasion", "style", "season", "material", "fit", "size"]),
    value: text.nullable(),
  }),
  z.strictObject({
    ...changeContext,
    field: z.literal("preferred_colours"),
    operation: z.enum(["set", "add", "remove"]),
    value: z.array(text).max(12),
  }).refine(change => change.operation === "set" || change.value.length > 0,
    "Adding or removing colours requires at least one label."),
  z.strictObject({
    ...changeContext,
    field: z.enum(["excluded_colours", "unresolved"]),
    operation: z.enum(["add", "remove"]),
    value: labels,
  }),
]);
