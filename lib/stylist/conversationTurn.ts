import { z } from "zod";
import { ConversationPlanRequestSchema, ConversationPlanSchema } from "./conversationPlan";
import { TurnSchema, TurnReplySchema, type ConversationTurn } from "./conversationProtocol";
import { executeConversationSearch } from "./conversationSearch";
import { PreferenceScopesSchema } from "./preferenceScope";
import { presentShoppingResult } from "./shoppingPresentation";
import type { CatalogueProduct } from "../recommendations/catalogue";
import type { CataloguePreferenceValues } from "../catalogue/preferenceValues";

export function interpreterInput(input: unknown) {
  const turn = TurnSchema.parse(input);
  const { shortcut, preview_other_colours, ...request } = turn;
  void shortcut;
  void preview_other_colours;
  return ConversationPlanRequestSchema.parse(request);
}
export function shortcutPlan(turn: ConversationTurn): z.infer<typeof ConversationPlanSchema> | null {
  if (turn.preview_other_colours) {
    if (turn.shortcut || turn.pending) throw new Error("Resolve the pending request before a colour preview.");
    return ConversationPlanSchema.parse({
      action: "refine", intent_evidence: turn.message.slice(0, 200),
      reference: null, changes: [], question: null, continuation: false,
    });
  }
  if (!turn.shortcut) return null;
  const known = [...turn.context.latest, ...(turn.context.focused ? [turn.context.focused] : [])];
  if (!known.some(product => product.product_id === turn.shortcut!.product_id)) {
    throw new Error("The selected product is not in the current context.");
  }
  return ConversationPlanSchema.parse({
    action: turn.shortcut.kind, intent_evidence: turn.message.slice(0, 200),
    reference: { kind: "id", value: turn.shortcut.product_id },
    changes: [], question: null, continuation: false,
  });
}
export function cancellationReply(input: unknown) {
  const turn = TurnSchema.parse(input);
  if (turn.shortcut || turn.preview_other_colours || !/^(cancel|never mind|nevermind)[.!]?$/i.test(turn.message.trim())) return null;
  return TurnReplySchema.parse({
    status: "no_action", action: "none", products: [],
    message: turn.pending ? "Cancelled that request. Your previous preferences are restored and your cart is unchanged."
      : "There is no pending question to cancel. Your preferences and cart are unchanged.",
    proposed_scopes: turn.pending?.before_scopes ?? turn.scopes,
    applied_preferences: null, pending: null,
  });
}
export function finishConversationTurn(
  catalogue: readonly CatalogueProduct[], input: unknown, output: unknown,
  vocabulary: CataloguePreferenceValues
) {
  const turn = TurnSchema.parse(input);
  const plan = ConversationPlanSchema.parse(output);
  const result = executeConversationSearch(catalogue, interpreterInput(turn), plan, vocabulary);
  const presentation = presentShoppingResult(catalogue, turn, result, vocabulary);
  const continuing = plan.continuation === true;
  const pending = presentation.status === "needs_clarification" ? {
    action: plan.action === "clarify" ? turn.pending?.action ?? "clarify" : plan.action,
    reference: plan.reference ?? (continuing ? turn.pending?.reference ?? null : null),
    goal: continuing ? turn.pending?.goal ?? turn.message : turn.message,
    question: presentation.message.slice(0, 4000),
    before_scopes: PreferenceScopesSchema.parse(continuing ? turn.pending?.before_scopes ?? turn.scopes : turn.scopes),
  } : result.status === "no_action" ? turn.pending ?? null : null;

  const message = result.status === "no_action"
    ? /\b(add|cart|buy|purchase)\b/i.test(turn.message)
      ? "Use Add to cart on the product card. I'll ask for a size there only when needed. Your cart hasn't changed."
      : turn.pending ? `We still have this question: ${turn.pending.question}`
        : "Tell me what you'd like to find. I can help with catalogue products, but can't confirm unrecorded details or guarantee fit and delivery."
    : presentation.message;
  return TurnReplySchema.parse({ ...result, ...presentation, message, pending });
}