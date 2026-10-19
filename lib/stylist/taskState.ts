import { z } from "zod";
import { ConversationIssueSchema, RecoverySchema } from "./conversationIssues";
import { emptyShoppingPreferences } from "./preferenceScope";
import { explicitCollection, requestedClothing, shoppingTarget } from "./collectionPreference";
import { requestedComponents } from "./combinedShoppingRequest";
import type { ConversationPlanRequest } from "./conversationPlan";

export const TaskStateSchema = z.strictObject({
  generation: z.number().int().nonnegative().default(0),
  prepared_key: z.string().max(30).default(""),
  preview_unverified: z.boolean().default(false),
  blocker_signature: z.string().max(1000).default(""),
  blocker_repeats: z.number().int().nonnegative().default(0),
  issues: z.array(ConversationIssueSchema).max(12).default([]),
});
export type TaskState = z.infer<typeof TaskStateSchema>;
export const emptyTaskState = (): TaskState => TaskStateSchema.parse({});
const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// A small idempotency marker for repeated validation within one turn, not an identity/security token.
function messageKey(message: string) {
  let hash = 2166136261;
  for (const char of message) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}
export function taskReplacement(message: string) {
  const commands = message.matchAll(/\b(?:new search|start (?:over|fresh)|forget (?:the |that |my |this )?(?:(?:two-piece|combined|whole) )?(?:trousers|pants|skirts?|dress|shoes|shirts?|outfit|search|similar)|drop (?:the |that )?(?:shoes|trousers|outfit|combined)|cancel the current shopping task)\b/gi);
  return [...commands].some(match => !/\b(?:don't|don’t|do not|never|not)\s*$/i.test(message.slice(0, match.index)));
}
export function replacesOutfitRequest(message: string, active: boolean) {
  if (taskReplacement(message)) return true;
  if (!active || !isShoppingRequest(message) || requestedComponents(message).size !== 1) return false;
  if (/\b(?:don't|don’t|do not|never)\s+(?:drop|remove|forget|cancel)\b/i.test(message)) return false;
  // A complete single-piece brief with its own cap replaces a grouped search.
  // Component refinements and references must keep the other requested pieces.
  if (/\b(?:more|other|similar|options|keep|both|combined|together|total|to match|to go with|with my|for the dress)\b/i.test(message)) return false;
  return /\b(?:show|find|browse)\b/i.test(message) &&
    (/\b(?:only|just|single)\b/i.test(message) || /\b(?:under|below|max(?:imum)?)\s*(?:A?\$)\s*\d/i.test(message));
}
export function isShoppingRequest(message: string) {
  return /\b(?:show|find|browse|looking for|i (?:want|need)|more like|similar|new search)\b/i.test(message);
}
export function removedRequirements(message: string, labels: readonly string[]) {
  const removal = message.match(/\b(?:remove|drop|forget|ignore|relax)\b([^.!?]*(?:checks|requirements|rules|restrictions|fabric|waist|length)[^.!?]*|[^.!?]*)/i);
  if (!removal) return [];
  const permission = normalise(removal[0]);
  return labels.filter(label => {
    const text = normalise(label);
    return permission.includes(text) ||
      /\bfabric\b/.test(permission) && /polyester|cotton|wool|leather|material|fabric|linen|silk/.test(text) ||
      /\bwaist\b/.test(permission) && /waist/.test(text) ||
      /\blength\b/.test(permission) && /length|cropped/.test(text) ||
      /\b(?:all|those|these) (?:checks|requirements|restrictions|rules)\b/.test(permission);
  });
}

export function prepareConversationTask<T extends ConversationPlanRequest>(input: T): T {
  if (process.env.STYLIST_TASK_RECOVERY_ENABLED === "false") return input;
  const request = structuredClone(input);
  const task = TaskStateSchema.parse(request.task ?? {});
  const key = messageKey(request.message);
  if (task.prepared_key === key) return request;
  const recovery = "recovery" in request && request.recovery ? RecoverySchema.parse(request.recovery) : null;
  if (recovery && (recovery.generation !== task.generation || !task.issues.some(value => value.id === recovery.issue_id))) {
    throw new Error("That recovery choice is no longer current. Answer the latest question instead.");
  }
  const replacing = replacesOutfitRequest(request.message, Boolean(request.styling?.outfit_request));
  if (replacing) {
    task.generation++;
    task.preview_unverified = false;
    task.issues = []; task.blocker_repeats = 0; task.blocker_signature = "";
    request.pending = null; request.pending_answer = null;
    request.scopes.item = emptyShoppingPreferences(); request.scopes.unresolved_item = [];
    if (request.styling) { request.styling.outfit_request = null; request.styling.purchase_budget = null; request.styling.dress_code = null; request.styling.required_features = []; request.styling.priorities = []; }
    if (request.collection) { request.collection.checkpoint = null; request.collection.current = null; }
    if (request.discovery) request.discovery.stage = "complete";
    request.context.focused = null;
  } else if (isShoppingRequest(request.message) && requestedClothing(request.message)) {
    // A clear different garment family supersedes a reference/pending question,
    // while retaining preferences on same-family refinements.
    const target = requestedClothing(request.message)!;
    if (request.scopes.item.subcategory && target.subcategory && target.subcategory !== request.scopes.item.subcategory &&
        !/\b(?:to go with|to match|with my)\b/i.test(request.message) && !/\b(?:and|both|together|combined)\b/i.test(shoppingTarget(request.message))) {
      request.pending = null; request.pending_answer = null;
    }
  }
  // Retain an unambiguous answer even if another clause needs interpretation
  // repair. This is browsing memory; shared restrictions remain untouched.
  if (request.collection?.checkpoint) {
    const choice = explicitCollection(request.message, true);
    if (choice) request.collection.choice = choice.choice;
  }
  const permitted = /\b(?:show|browse|explore)\b[^.!?]{0,100}\b(?:unverified|provisional|(?:things|details) to check)\b|\b(?:keep|leave)\b[^.!?]{0,60}\b(?:unverified|things to check)\b/i.test(request.message);
  if (permitted || recovery?.operation === "preview_unverified") {
    task.preview_unverified = true; request.pending = null;
  }
  if (/\b(?:dealbreaker|hard requirement|must (?:be )?verif|reapply)\b/i.test(request.message)) task.preview_unverified = false;
  task.prepared_key = key;
  request.task = task;
  return request;
}
