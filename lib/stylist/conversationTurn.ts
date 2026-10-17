import { z } from "zod";
import { checkConversationPlan, ConversationPlanRequestSchema, ConversationPlanSchema } from "./conversationPlan";
import { answerConversationQuestion, resolveAnswerProducts } from "./conversationAnswers";
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
  if (turn.pending_answer && !turn.shortcut) {
    const text = turn.message.trim();
    const ordinal = text.match(/^(?:the\s+)?(first|second|third|fourth|[1-4])(?:\s+(dress|dresses|item|product|one))?[.!]?$/i);
    const known = [...turn.context.latest, ...(turn.context.focused ? [turn.context.focused] : [])];
    const named = known.find(product => product.product_name.toLowerCase() === text.toLowerCase() || product.product_id === text);
    const positions: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4 };
    const reference = ordinal ? {
      kind: "position" as const,
      position: positions[ordinal[1].toLowerCase()] ?? Number(ordinal[1]),
      subcategory: /^dress(?:es)?$/i.test(ordinal[2] ?? "") ? "Dresses" : null,
    } : named ? { kind: "id" as const, value: named.product_id } : null;
    if (reference) return ConversationPlanSchema.parse({
      action: "none", intent_evidence: text.slice(0, 250), changes: [], reference: null,
      question: null, continuation: false,
      answer: { ...turn.pending_answer.intent, references: [reference], continuation: true },
    });
  }
  if (!turn.shortcut && !turn.pending_answer) {
    // A small exact grammar for supported feature searches avoids routing a
    // known construction feature into colour/style. Richer requests still use
    // the interpreter; the anchors prevent dropping trailing constraints.
    const features: Record<string, "pockets" | "lining" | "adjustable_strap" | "zip_closure" | "machine_washable"> = {
      pockets: "pockets", lining: "lining", "adjustable straps": "adjustable_strap",
      "an adjustable strap": "adjustable_strap", "a zip closure": "zip_closure",
      "machine wash care": "machine_washable",
    };
    const add = turn.message.trim().match(/^(?:show|find)(?: me)? (bags|dresses|shoes|accessories) with (pockets|lining|adjustable straps|an adjustable strap|a zip closure|machine wash care)[.!]?$/i);
    const remove = turn.message.trim().match(/^remove (?:my |the )?(pockets|lining|adjustable straps|an adjustable strap|a zip closure|machine wash care) requirement and (?:show|find)(?: me)? (bags|dresses|shoes|accessories)[.!]?$/i);
    const feature = add ? features[add[2].toLowerCase()] : remove ? features[remove[1].toLowerCase()] : null;
    if (feature && (add || turn.styling?.required_features.includes(feature))) {
      const categoryWord = (add?.[1] ?? remove![2]).toLowerCase();
      const category = { bags: "Bags", dresses: "Clothing", shoes: "Shoes", accessories: "Accessories" }[categoryWord]!;
      const sameRole = turn.scopes.item.category === category && (categoryWord !== "dresses" || turn.scopes.item.subcategory === "Dresses");
      return ConversationPlanSchema.parse({
        action: sameRole ? "refine" : "new_search", intent_evidence: turn.message,
        changes: sameRole ? [] : [
          { scope: "item", field: "category", operation: "set", value: category, evidence: add?.[1] ?? remove![2] },
          ...(categoryWord === "dresses" ? [{ scope: "item", field: "subcategory", operation: "set", value: "Dresses", evidence: add?.[1] ?? remove![2] }] : []),
        ],
        reference: null, question: null, continuation: false,
        styling_intent: { preferences: [{ kind: "requirement", operation: add ? "add" : "remove", value: feature, evidence: add?.[2] ?? remove![1] }],
          outfit_changes: [], owned_categories: [], offers: null },
      });
    }
  }
  // Resolve a short answer to our own benefit question deterministically. Keep
  // compound requests and negations with the interpreter so no filters are lost.
  const benefitReference = turn.context.comparison ?? turn.context.focused;
  if (!turn.shortcut && !turn.pending && !turn.pending_answer && benefitReference &&
      turn.history.at(-1)?.role === "assistant" &&
      (turn.context.comparison || turn.history.at(-1)!.content.includes("What would you value in a replacement:"))) {
    const match = turn.message.trim().match(/^(?:(?:i(?:'|’)d (?:value|like|prefer)|i (?:value|want|prefer))\s+)?(adjustability|adjustable straps?|pockets|lining|easier care|easy care|machine washability)(?:\s+(?:would be (?:useful|helpful|nice)|please))?[.!]?$/i);
    if (match) {
      const label = match[1].toLowerCase();
      const value = label.startsWith("adjust") ? "adjustability"
        : /care|wash/.test(label) ? "easy_care" : label;
      return ConversationPlanSchema.parse({
        action: "upsell", intent_evidence: turn.message, changes: [], question: null, continuation: false,
        reference: { kind: "id", value: benefitReference.product_id },
        styling_intent: { preferences: [{ kind: "priority", operation: "add", value, evidence: match[1] }],
          outfit_changes: [], owned_categories: [], offers: null },
      });
    }
  }
  if (!turn.shortcut) return null;
  const known = [...turn.context.latest, ...(turn.context.focused ? [turn.context.focused] : []), ...(turn.context.comparison ? [turn.context.comparison] : []), ...(turn.context.selected ?? [])];
  if (!known.some(product => product.product_id === turn.shortcut!.product_id)) {
    throw new Error("The selected product is not in the current context.");
  }
  if (["keep", "own", "remove", "reject"].includes(turn.shortcut.kind)) return ConversationPlanSchema.parse({
    action: "none", intent_evidence: turn.message.slice(0, 200), reference: null, changes: [], question: null, continuation: false,
    styling_intent: { preferences: [], owned_categories: [], offers: null,
      outfit_changes: [{ operation: turn.shortcut.kind, reference: { kind: "id", value: turn.shortcut.product_id }, evidence: turn.message.slice(0, 200) }] },
  });
  return ConversationPlanSchema.parse({
    action: turn.shortcut.kind, intent_evidence: turn.message.slice(0, 200),
    reference: { kind: "id", value: turn.shortcut.product_id },
    changes: [], question: null, continuation: false,
  });
}
export function cancellationReply(input: unknown) {
  const turn = TurnSchema.parse(input);
  if (turn.shortcut || turn.preview_other_colours || !/^(cancel|never mind|nevermind)[.!]?$/i.test(turn.message.trim())) return null;
  if (turn.pending_answer) return TurnReplySchema.parse({
    status: "no_action", action: "none", products: [],
    message: "Cancelled that product question. Your saved preferences, previous shopping question and cart are unchanged.",
    proposed_scopes: turn.scopes, applied_preferences: null, pending: turn.pending ?? null,
    pending_answer: null,
    styling: turn.styling,
  });
  return TurnReplySchema.parse({
    status: "no_action", action: "none", products: [],
    message: turn.pending ? "Cancelled that request. Your previous preferences are restored and your cart is unchanged."
      : "There is no pending question to cancel. Your preferences and cart are unchanged.",
    proposed_scopes: turn.pending?.before_scopes ?? turn.scopes,
    styling: turn.styling,
    applied_preferences: null, pending: null,
  });
}

export function resumesAnswerSearch(input: unknown, output: unknown) {
  const turn = TurnSchema.parse(input);
  const plan = ConversationPlanSchema.parse(output);
  return Boolean(plan.answer?.continuation && turn.pending_answer?.follow_up &&
    !resolveAnswerProducts(turn, plan.answer).question);
}

export function finishConversationTurn(
  catalogue: readonly CatalogueProduct[], input: unknown, output: unknown,
  vocabulary: CataloguePreferenceValues
): z.infer<typeof TurnReplySchema> {
  const turn = TurnSchema.parse(input);
  const plan = ConversationPlanSchema.parse(output);
  const checked = checkConversationPlan(interpreterInput(turn), plan);
  if (resumesAnswerSearch(turn, plan)) {
    // Revalidate the saved changes against their original quoted message. The
    // latest short reply supplies only the product reference, never new filters.
    const pending = turn.pending_answer!;
    const answer = { ...plan.answer!, continuation: false };
    return finishConversationTurn(catalogue, {
      ...turn, message: pending.question, pending_answer: null,
    }, {
      ...pending.follow_up!, answer,
      reference: pending.follow_up!.reference && pending.follow_up!.reference.kind !== "context"
        ? pending.follow_up!.reference
        : answer.references.length === 1 ? answer.references[0] : pending.follow_up!.reference,
      intent_evidence: pending.question.slice(0, 250), question: null, continuation: false,
    }, vocabulary);
  }
  const answer = plan.answer ? answerConversationQuestion(catalogue, turn, plan.answer) : null;
  if (answer && plan.action !== "none" && plan.answer?.kind === "policy") answer.pending_answer = null;
  // An ambiguous reference blocks a compound action too; never search on a guess.
  if (answer && (plan.action === "none" || answer.pending_answer)) {
    if (answer.pending_answer && ["new_search", "refine", "cross_sell", "cheaper", "upsell"].includes(plan.action)) {
      answer.pending_answer.follow_up = {
        action: plan.action as "new_search" | "refine" | "cross_sell" | "cheaper" | "upsell",
        changes: plan.changes, reference: plan.reference,
      };
    } else if (answer.pending_answer && plan.answer?.continuation) {
      answer.pending_answer.follow_up = turn.pending_answer?.follow_up ?? null;
    }
    return TurnReplySchema.parse({
      ...answer, status: "answered", action: "none", products: [],
      proposed_scopes: turn.scopes, applied_preferences: null, pending: turn.pending ?? null,
      styling: checked.styling,
    });
  }
  const result = executeConversationSearch(catalogue, interpreterInput(turn), plan, vocabulary);
  const presentation = presentShoppingResult(catalogue, turn, result, vocabulary);
  const continuing = plan.continuation === true;
  const pending = presentation.status === "needs_clarification" ? {
    action: plan.action === "none" ? "clarify" : plan.action === "clarify" ? turn.pending?.action ?? "clarify" : plan.action,
    reference: plan.reference ?? (continuing ? turn.pending?.reference ?? null : null),
    goal: continuing ? turn.pending?.goal ?? turn.message : turn.message,
    question: presentation.message.slice(0, 4000),
    before_scopes: PreferenceScopesSchema.parse(continuing ? turn.pending?.before_scopes ?? turn.scopes : turn.scopes),
    ...(checked.styling_question ? { styling_question: true } : {}),
  } : result.status === "no_action" && !(turn.pending?.styling_question && plan.styling_intent?.outfit_changes.length) ? turn.pending ?? null : null;

  const message = result.status === "no_action"
    ? plan.styling_intent ? result.message
      : /\b(add|cart|buy|purchase)\b/i.test(turn.message)
      ? "Use Add to cart on the product card. I'll ask for a size there only when needed. Your cart hasn't changed."
      : /^(?:thanks|thank you|cheers)[!. ]*$/i.test(turn.message.trim()) ? "You're welcome. I'm here if you'd like to compare these items or find something to go with them."
        : /^(?:hi|hello|hey)[!. ]*$/i.test(turn.message.trim()) ? "Hi! I can help you find items, explain a recommendation or compare products."
      : turn.pending ? `We still have this question: ${turn.pending.question}`
        : "Tell me what you'd like to find. I can help with catalogue products, but can't confirm unrecorded details or guarantee fit and delivery."
    : presentation.message;
  return TurnReplySchema.parse({
    ...result, ...presentation,
    ...(answer ? { answer_sources: answer.answer_sources } : {}),
    message: answer ? `${answer.message}\n\n${message}` : message, pending,
    pending_answer: result.status === "no_action" ? turn.pending_answer ?? null : null,
  });
}
