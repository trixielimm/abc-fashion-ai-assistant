import type { ConversationPlanRequest } from "./conversationPlan";
import type { AnswerIntent } from "./answerPlan";
import { messageProductReference } from "./productReference";

// Recognize store tasks, never a claim that a purchase or cart mutation occurred.
export function shoppingNavigationIntent(turn: ConversationPlanRequest): AnswerIntent | null {
  const message = turn.message;
  const link = /\b(?:product (?:link|page)|link (?:to|for)|where (?:can|do|should) I (?:go|click|select))\b/i.test(message);
  const checkout = /\b(?:checkout|check out|place (?:an?|the|my) order|complete (?:the |my )?purchase)\b/i.test(message);
  const steps = /\b(?:how (?:do|can|should|would) I|where (?:do|can|should) I)\b[^?!.]{0,120}\b(?:buy|purchase|order|add|save|select|choose)\b/i.test(message);
  if (!link && !checkout && !steps) return null;
  // A mixed search must still reach interpretation with all its requirements.
  if (/\b(?:show|find|browse|looking for)\b(?!\s+(?:(?:me|the|a)\s+)*(?:product )?link\b)/i.test(message)) return null;
  const identity = messageProductReference(turn.context, message);
  if (identity.conflict) return null;
  const productStep = link || steps && /\b(?:size|item|piece|this|that|it|blouse|shirt|dress|product)\b/i.test(message) ||
    /\b(?:save|add|select|choose)\b[^?!.]{0,80}\b(?:blouse|shirt|dress|product|size)\b/i.test(message);
  const topics: AnswerIntent["topics"] = ["general"];
  if (/\b(?:delivery|shipping|arrive)\b/i.test(message)) topics.push("delivery");
  if (/\b(?:returns?|exchanges?|refund)\b/i.test(message)) topics.push("returns");
  return { kind: "navigation", topics, purpose: null, continuation: false, compare_new_results: false,
    references: identity.status === "resolved" ? [identity.reference]
      : productStep && (turn.context.latest.length || turn.context.focused) ? [{ kind: "context" }] : [] };
}
