import { z } from "zod";
import { ShoppingPreferencesSchema } from "../ai/preferenceSchema";
import {
  composePreferences, createPreferenceScopes,
  emptyShoppingPreferences, PreferenceScopesSchema,
} from "./preferenceScope";
import { ProductReferenceSchema, resolveProductReference } from "./productReference";
import { AnswerIntentSchema, PendingAnswerSchema } from "./answerPlan";
import { ConversationChangeSchema } from "./conversationChanges";
import { emptyStylingState, PrioritySchema, RecommendationContextSchema, StylingIntentSchema, StylingStateSchema } from "./commerceSchema";
export { ConversationChangeSchema } from "./conversationChanges";

const text = z.string().trim().min(1).max(250);
const ContextProductSchema = z.strictObject({
  product_id: text,
  product_name: text,
  category: ShoppingPreferencesSchema.shape.category,
  subcategory: text.nullable(),
  product_type: text.nullable(),
  price_aud: z.number().nonnegative().optional(),
  recommendation_context: RecommendationContextSchema.optional(),
});

export const PendingConversationSchema = z.strictObject({
  action: z.enum(["new_search", "refine", "cross_sell", "cheaper", "upsell", "clarify"]),
  reference: ProductReferenceSchema.nullable(),
  goal: z.string().min(1).max(2000),
  question: z.string().min(1).max(4000),
  before_scopes: PreferenceScopesSchema,
  styling_question: z.boolean().optional(),
});

export const ConversationPlanRequestSchema = z.strictObject({
  message: z.string().trim().min(1).max(2000),
  scopes: PreferenceScopesSchema.default(createPreferenceScopes),
  context: z.strictObject({
    focused: ContextProductSchema.nullable(),
    latest: z.array(ContextProductSchema).max(4),
    selected: z.array(ContextProductSchema).max(8).optional(),
    comparison: ContextProductSchema.optional(),
  }).default({ focused: null, latest: [] }),
  history: z.array(z.strictObject({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(2000),
  })).max(8).default([]),
  pending: PendingConversationSchema.nullable().optional(),
  pending_answer: PendingAnswerSchema.nullable().optional(),
  styling: StylingStateSchema.optional(),
  cart_product_ids: z.array(text).max(50).optional(),
});


export const ConversationPlanSchema = z.strictObject({
  action: z.enum(["new_search", "refine", "cross_sell", "cheaper", "upsell", "clarify", "none"]),
  intent_evidence: text,
  reference: ProductReferenceSchema.nullable(),
  changes: z.array(ConversationChangeSchema).max(24),
  question: z.string().trim().min(1).max(400).nullable(),
  // Optional for existing offline fixtures; required by the live model schema.
  continuation: z.boolean().optional(),
  answer: AnswerIntentSchema.nullable().optional(),
  styling_intent: StylingIntentSchema.nullable().optional(),
});

export type ConversationPlanRequest = z.infer<typeof ConversationPlanRequestSchema>;
const normalise = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

function unsupportedRequestDetails(message: string) {
  const negativeMaterial = message.match(
    /\b(?:no|without|avoid|exclude|excluding)\s+(?:any\s+)?(leather|suede|fur|wool|silk|cotton|polyester|linen|nylon|cashmere)\b/i
  ) ?? message.match(/\b(leather|suede|fur|wool|silk|cotton|polyester|linen|nylon|cashmere)[ -]free\b/i);
  return {
    material: negativeMaterial ? normalise(negativeMaterial[1]) : null,
    completeOutfit: /\b(?:build|find|create|put together|need|want|looking for|show me)\s+(?:me\s+)?(?:a\s+)?(?:complete|full|whole)\s+(?:outfit|look)\b/i.test(message),
  };
}

export function checkConversationPlan(input: unknown, output: unknown) {
  const request = ConversationPlanRequestSchema.parse(input);
  const plan = ConversationPlanSchema.parse(output);
  let scopes = PreferenceScopesSchema.parse(request.scopes);
  const continuing = plan.continuation === true;
  const originalStyling = StylingStateSchema.parse(request.styling ?? emptyStylingState());
  let styling = StylingStateSchema.parse(originalStyling);
  let stylingQuestion: string | null = null;

  if (continuing && (!request.pending ||
      (request.pending.action !== "clarify" && request.pending.action !== plan.action))) {
    throw new PlanValidationError("Continuation does not match the pending request.");
  }
  const reference = plan.reference ?? (continuing ? request.pending?.reference ?? null : null);

  function requireEvidence(quote: string, field: string) {
    const quotedText = normalise(quote);
    if (!quotedText || !normalise(request.message).includes(quotedText)) {
      throw new PlanEvidenceError(field);
    }
  }

  requireEvidence(plan.intent_evidence, "intent_evidence");
  if (!continuing && ["new_search", "cross_sell"].includes(plan.action)) {
    styling.priorities = []; styling.required_features = [];
  }
  if (plan.styling_intent) {
    const intent = plan.styling_intent;
    for (const preference of intent.preferences) {
      requireEvidence(preference.evidence, `styling.${preference.kind}.evidence`);
      const isPriority = preference.kind === "priority";
      if (isPriority && !PrioritySchema.safeParse(preference.value).success) throw new PlanValidationError("Use a supported benefit priority.");
      if (!isPriority && !["lining", "adjustable_strap", "pockets", "zip_closure", "machine_washable"].includes(preference.value)) throw new PlanValidationError("Only verified boolean features can be required.");
      const values = isPriority ? styling.priorities : styling.required_features;
      const updated = preference.operation === "add" ? [...new Set([...values, preference.value])] : values.filter(value => value !== preference.value);
      styling = StylingStateSchema.parse({ ...styling, [isPriority ? "priorities" : "required_features"]: updated });
    }
    if (intent.offers) {
      requireEvidence(intent.offers.evidence, "styling.offers.evidence");
      styling.offers_paused = intent.offers.paused;
    }
    for (const owned of intent.owned_categories) {
      requireEvidence(owned.evidence, "styling.owned.evidence");
      styling.owned_categories = owned.operation === "add"
        ? [...new Set([...styling.owned_categories, owned.category])]
        : styling.owned_categories.filter(category => category !== owned.category);
    }
    const context = { ...request.context, selected: originalStyling.outfit };
    const pool = [...request.context.latest, ...(request.context.focused ? [request.context.focused] : []), ...(request.context.comparison ? [request.context.comparison] : []), ...originalStyling.outfit];
    for (const change of intent.outfit_changes) {
      requireEvidence(change.evidence, "styling.outfit.evidence");
      const resolved = resolveProductReference(context, change.reference);
      if (resolved.status !== "resolved") { stylingQuestion = `${resolved.message} Please specify the action too, for example: keep the first product.`; break; }
      const product = pool.find(row => row.product_id === resolved.product_id)!;
      styling.outfit = styling.outfit.filter(row => row.product_id !== product.product_id);
      if (change.operation === "keep" || change.operation === "own") {
        styling.outfit = styling.outfit.filter(row => !(row.category === product.category && row.subcategory === product.subcategory));
        styling.outfit.push({ ...product, ownership: change.operation === "own" ? "owned" : "selected" });
        styling.rejected_ids = styling.rejected_ids.filter(id => id !== product.product_id);
      } else if (change.operation === "reject") {
        styling.rejected_ids = [...new Set([...styling.rejected_ids, product.product_id])].slice(-50);
      }
    }
    if (stylingQuestion) styling = originalStyling;
    styling = StylingStateSchema.parse(styling);
  }
  if (plan.answer) {
    const answer = plan.answer;
    if (plan.action === "upsell" && answer.kind === "compare" && answer.references.length < 2 && /\b(?:replacement|upgrade|alternative)\b/i.test(request.message)) {
      throw new PlanValidationError("Finding a replacement is an upsell search, not a comparison question about two existing products. Use action=upsell with the original reference and answer=null unless the customer separately asked about two existing products. Record explicit 'with pockets/adjustable straps/zip closure' requirements as styling requirement entries as well as relevant benefit priorities.");
    }
    if (answer.continuation && !request.pending_answer) {
      throw new PlanValidationError("An answer continuation requires a pending product question.");
    }
    const question = answer.continuation ? request.pending_answer!.question : request.message;
    if (answer.continuation && (answer.kind !== request.pending_answer!.intent.kind ||
        JSON.stringify(answer.topics) !== JSON.stringify(request.pending_answer!.intent.topics) ||
        answer.purpose !== request.pending_answer!.intent.purpose)) {
      throw new PlanValidationError("An answer continuation must retain the original question kind, topics and purpose.");
    }
    if (answer.purpose && !normalise(question).includes(normalise(answer.purpose))) {
      throw new PlanValidationError("The answer purpose must be quoted from the customer's question.");
    }
    if (answer.kind === "policy" && (answer.references.length || answer.purpose)) {
      throw new PlanValidationError("Policy questions do not select products or invent an occasion.");
    }
    if (answer.kind === "product" && answer.references.length > 1) {
      throw new PlanValidationError("Use a comparison answer for multiple product references.");
    }
    if (plan.action === "none" && plan.continuation) {
      throw new PlanValidationError("An answer cannot complete a pending shopping request.");
    }
  }
  if ((plan.action === "clarify") !== (plan.question !== null)) {
    throw new PlanValidationError("Only a clarification plan may include a question.");
  }
  if (plan.action === "none" && (plan.changes.length > 0 || plan.reference !== null)) {
    if (plan.answer) throw new PlanValidationError("A pure answer MUST have changes=[] and top-level reference=null. Put product references ONLY in answer.references and the quoted occasion ONLY in answer.purpose. Asking why an item suits an occasion does not save that occasion as a shopping preference. If the user also explicitly requests a search, choose that shopping action instead of none.");
    throw new PlanValidationError("An unrelated turn cannot change preferences or select a product.");
  }

  // An answer to a pending cross-sell must not erase the requested extra item.
  if (!continuing && (plan.action === "new_search" || plan.action === "cross_sell")) {
    scopes.item = emptyShoppingPreferences();
    scopes.unresolved_item = [];
  }

  const beforeCategory = scopes.item.category;
  const touched = new Set<string>();

  for (const change of plan.changes) {
    requireEvidence(change.evidence, `changes.${change.scope}.${change.field}.evidence`);
    const field = change.field;
    const featureLabels = ["pockets", "lining", "adjustable strap", "adjustable straps", "zip closure", "zipper closure", "machine washable"];
    const labelsToCheck = Array.isArray(change.value) ? change.value : [change.value];
    if (field !== "unresolved" && labelsToCheck.some(value => typeof value === "string" && featureLabels.includes(normalise(value)))) {
      throw new PlanValidationError("Construction and care features belong only in styling_intent.preferences with a supported feature/priority key. Never store pockets, lining, adjustable straps, closures or care as colours, style, material or another catalogue label. Remove the misplaced change.");
    }
    const key = `${change.scope}.${field}`;
    if (touched.has(key)) throw new PlanValidationError("Use one change per field per turn.");
    touched.add(key);

    if (change.scope === "shared" && ["category", "subcategory", "product_type", "size"].includes(field)) {
      throw new PlanValidationError("Product identity and size cannot be shared globally.");
    }
    const listField = field === "preferred_colours" || field === "excluded_colours" || field === "unresolved";
    if (!listField) {
      if (change.operation !== "set" || Array.isArray(change.value)) {
        throw new PlanValidationError("A scalar preference requires a set operation.");
      }
      Object.assign(scopes[change.scope], { [field]: change.value });
      continue;
    }

    if (!Array.isArray(change.value) || !change.value.length) {
      throw new PlanValidationError("A list change requires one or more labels.");
    }
    if (change.operation === "set" && field !== "preferred_colours") {
      throw new PlanValidationError("Exclusions and unresolved requirements require add or remove.");
    }

    const old = field === "unresolved"
      ? scopes[change.scope === "item" ? "unresolved_item" : "unresolved_shared"]
      : scopes[change.scope][field];
    const values = change.value;
    const labels = change.operation === "set" ? values
      : change.operation === "add" ? [...old, ...values]
        : old.filter(label => !values.some(value => normalise(value) === normalise(label)));
    const unique = [...new Map(labels.map(label => [normalise(label), label])).values()];

    if (field === "unresolved") {
      scopes[change.scope === "item" ? "unresolved_item" : "unresolved_shared"] = unique;
    } else {
      scopes[change.scope][field] = unique;
    }
  }

  if (scopes.item.category !== beforeCategory) {
    for (const field of ["subcategory", "product_type", "size"] as const) {
      if (!touched.has(`item.${field}`)) scopes.item[field] = null;
    }
  }

  scopes = PreferenceScopesSchema.parse(scopes);
  if (plan.action === "new_search" && !scopes.item.category && !scopes.item.subcategory && !scopes.item.product_type &&
      !scopes.unresolved_item.length && !scopes.unresolved_shared.length &&
      /\b(?:dresses|dress|bags|bag|shoes|shoe|clothing|accessories|accessory)\b/i.test(request.message)) {
    throw new PlanValidationError("A new_search clears the old item scope, so it must include the stated item/category even if it was previously selected. For a repeated request for the same item category, use refine and retain all existing requirements instead of an empty new_search.");
  }
  if (plan.action !== "clarify" && plan.action !== "none") {
    // These supported, explicit positive requirements belong in the reviewed
    // feature filter. Putting them in generic unresolved text bypasses that path.
    const explicitFeatures = [
      { pattern: /\bwith\s+(?:a\s+)?pockets\b/i, key: "pockets" },
      { pattern: /\bwith\s+(?:an?\s+)?adjustable straps?\b/i, key: "adjustable_strap" },
      { pattern: /\bwith\s+(?:a\s+)?(?:zip|zipper) closure\b/i, key: "zip_closure" },
    ];
    const softOrNegative = /\b(?:not necessary|not required|not needed|optional|prefer|would be|don't need|do not need)\b/i.test(request.message);
    if (!softOrNegative && ["new_search", "refine", "cross_sell", "upsell"].includes(plan.action)) {
      for (const feature of explicitFeatures) {
        if (feature.pattern.test(request.message) && !styling.required_features.includes(feature.key as "pockets" | "adjustable_strap" | "zip_closure")) {
          throw new PlanValidationError(`Use styling_intent.preferences kind=requirement, operation=add, value=${feature.key} for the explicit feature request. This feature is supported through reviewed facts; do not replace it with a priority or unresolved text. Keep the category and all other requirements.`);
        }
      }
    }
    // These unsupported requests must block retrieval even when a model emits
    // valid JSON but omits the requirement or treats it as a soft style label.
    const unresolved = [...scopes.unresolved_item, ...scopes.unresolved_shared];
    const { material, completeOutfit } = unsupportedRequestDetails(request.message);
    if (material) {
      const mentionsMaterial = (label: string) => normalise(label).includes(material);
      const removalPermission = new RegExp(`\\b(?:(?:remove|drop)\\s+(?:(?:my|the|that)\\s+)?(?:no\\s+|without\\s+)?${material}|(?:stop excluding|no longer exclude|allow)\\s+${material})\\b`, "i");
      const explicitRemoval = removalPermission.test(request.message) &&
        [...request.scopes.unresolved_item, ...request.scopes.unresolved_shared].some(mentionsMaterial) &&
        plan.changes.some(change => change.field === "unresolved" && change.operation === "remove" &&
          change.value.some(mentionsMaterial));
      if (!explicitRemoval && !unresolved.some(mentionsMaterial)) {
        throw new PlanValidationError(`The ${material} exclusion must remain an unresolved requirement. Do not omit it or store it as a style, occasion or positive material filter.`);
      }
    }
    if (completeOutfit && !unresolved.some(label => /\b(?:outfit|look|total|combined)\b/i.test(label))) {
      throw new PlanValidationError("A complete-outfit request must remain unresolved. Do not turn its total budget into a per-item maximum or fulfil it with one item.");
    }
  }
  const composition = composePreferences(scopes);
  const referenceIds: string[] = [];
  let referenceQuestion: string | null = null;

  if (plan.action === "cheaper" && reference === null) {
    const products = request.context.focused ? [request.context.focused] : request.context.latest;
    referenceIds.push(...new Set(products.map(product => product.product_id)));
    if (!referenceIds.length) referenceQuestion = "Which product should I compare prices with?";
  } else if (reference !== null || plan.action === "cross_sell" || plan.action === "upsell") {
    const resolved = resolveProductReference(request.context, reference ?? { kind: "context" });
    if (resolved.status === "resolved") referenceIds.push(resolved.product_id);
    else referenceQuestion = resolved.message;
  }

  const clarification = stylingQuestion ?? (composition.status === "needs_clarification"
    ? composition.message
    : referenceQuestion ?? (plan.action === "clarify" ? plan.question ?? "Please clarify your shopping request." : null));

  return {
    status: stylingQuestion ? "needs_clarification" : plan.action === "none" ? "no_action" : clarification ? "needs_clarification" : "ready_for_validation",
    action: plan.action,
    reference_product_ids: referenceIds,
    proposed_scopes: scopes,
    styling,
    styling_question: stylingQuestion !== null,
    preferences: composition.status === "ready" ? composition.preferences : null,
    message: clarification ?? (plan.action === "none"
      ? "No shopping action was requested."
      : "Interpretation checked. Catalogue validation and retrieval have not run."),
  };
}

export class PlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanValidationError";
  }
}

export class PlanEvidenceError extends PlanValidationError {
  readonly field: string;
  constructor(field: string) {
    super(`Plan evidence is not present in the latest message (${field}).`);
    this.name = "PlanEvidenceError";
    this.field = field;
  }
}

export async function generateValidatedConversationPlan(
  input: unknown,
  generate: (failedEvidenceField: string | null, validationFeedback: string | null) => Promise<unknown>
): Promise<z.infer<typeof ConversationPlanSchema>> {
  const request = ConversationPlanRequestSchema.parse(input);
  let failedEvidenceField: string | null = null;
  let validationFeedback: string | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const candidate = ConversationPlanSchema.parse(await generate(failedEvidenceField, validationFeedback));
      checkConversationPlan(request, candidate);
      return candidate;
    } catch (error) {
      // Only malformed model output is recoverable here. Provider failures,
      // cancellation and unexpected application errors remain technical errors.
      if (!(error instanceof PlanValidationError || error instanceof z.ZodError || error instanceof SyntaxError)) throw error;
      failedEvidenceField = error instanceof PlanEvidenceError ? error.field : null;
      validationFeedback = error instanceof z.ZodError
        ? error.issues.slice(0, 3).map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ").slice(0, 1200)
        : error instanceof SyntaxError ? "The model output was not valid JSON." : error.message;
    }
  }

  // Do not apply any unverified changes or select products after two bad plans.
  // The turn handler retains the full request as a pending clarification goal.
  if (request.pending_answer) return ConversationPlanSchema.parse({
    action: "none", intent_evidence: request.message.slice(0, 250),
    reference: null, changes: [], question: null, continuation: false,
    answer: { ...request.pending_answer.intent, continuation: true },
  });
  const unsupported = unsupportedRequestDetails(request.message);
  const limitations = [
    ...(unsupported.completeOutfit ? ["build a complete outfit within one total budget"] : []),
    ...(unsupported.material ? [`verify ${unsupported.material}-free products`] : []),
  ];
  return ConversationPlanSchema.parse({
    action: "clarify",
    intent_evidence: request.message.slice(0, 250),
    reference: null,
    changes: [],
    question: limitations.length
      ? `I can't yet ${limitations.join(" or ")}. Which part of your request would you like to change? I haven't changed your saved preferences or selected any products.`
      : "Could you rephrase what you'd like me to find or change? I haven't changed your saved preferences or searched with unverified requirements.",
    continuation: false,
  });
}
