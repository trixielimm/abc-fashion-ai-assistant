import { z } from "zod";

export const ConversationIssueSchema = z.strictObject({
  id: z.string().min(1).max(500),
  code: z.enum(["invalid_preference", "shared_conflict", "unverified_requirement", "ambiguous_reference", "stale_product", "interpretation_failed", "needs_detail"]),
  field: z.string().max(100),
  scope: z.enum(["item", "shared", "task"]),
  value: z.union([z.string(), z.number(), z.array(z.string())]).nullable(),
  saved_value: z.union([z.string(), z.number(), z.array(z.string())]).nullable().default(null),
  options: z.array(z.string()).max(8).default([]),
});
export type ConversationIssue = z.infer<typeof ConversationIssueSchema>;
export const RecoverySchema = z.strictObject({
  issue_id: z.string().min(1).max(500),
  generation: z.number().int().nonnegative(),
  operation: z.enum(["drop_requirement", "preview_unverified", "restart_task"]),
});
export function issue(code: ConversationIssue["code"], field: string, scope: ConversationIssue["scope"], value: ConversationIssue["value"], savedValue: ConversationIssue["saved_value"] = null, options: string[] = []): ConversationIssue {
  return { id: `${code}:${scope}:${field}:${JSON.stringify(value)}`.slice(0, 500), code, field, scope, value, saved_value: savedValue, options: options.slice(0, 8) };
}
export function issueMessage(item: ConversationIssue): string {
  const label = item.field === "gender" ? "collection" : item.field.replaceAll("_", " ");
  const value = Array.isArray(item.value) ? item.value.join(", ") : String(item.value ?? "");
  const saved = Array.isArray(item.saved_value) ? item.saved_value.join(", ") : String(item.saved_value ?? "");
  if (item.code === "shared_conflict") return `Your ${label} request (${value}) conflicts with your saved rule for all items (${saved}). Tell me which rule to change; I haven't removed either restriction.`;
  if (item.code === "invalid_preference") return `I couldn't apply ${label}: ${value}. That value isn't supported by the current catalogue${item.options.length ? `; recorded options include ${item.options.join(", ")}` : ""}. Please change that detail; your other requirements are still saved.`;
  if (item.code === "unverified_requirement") return `I can't verify ${value} from the product information. Keep it as a hard requirement, remove it, or explicitly ask to browse with that detail unverified. Known violations will still be excluded.`;
  if (item.code === "interpretation_failed") return "I couldn't reliably interpret the requested change. No unverified changes were applied. You can clarify the item and change, or start a new shopping task below.";
  return "";
}
