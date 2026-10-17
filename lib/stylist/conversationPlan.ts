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
import { groundConversationPlan } from "./conversationGrounding";
import { OutfitRequestSchema } from "./outfitBudgetSchema";
import { HISTORY_MESSAGES, MAX_DISPLAYED_PRODUCTS } from "./conversationLimits";
import { dressCodeFromMessage } from "./dressCode";
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
    latest: z.array(ContextProductSchema).max(MAX_DISPLAYED_PRODUCTS),
    previous: z.array(z.array(ContextProductSchema).max(MAX_DISPLAYED_PRODUCTS)).max(2).optional(),
    selected: z.array(ContextProductSchema).max(8).optional(),
    comparison: ContextProductSchema.optional(),
  }).default({ focused: null, latest: [] }),
  history: z.array(z.strictObject({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(2000),
  })).max(HISTORY_MESSAGES).default([]),
  pending: PendingConversationSchema.nullable().optional(),
  pending_answer: PendingAnswerSchema.nullable().optional(),
  styling: StylingStateSchema.optional(),
  cart_product_ids: z.array(text).max(50).optional(),
});


export const ConversationPlanSchema = z.strictObject({
  outfit_request: OutfitRequestSchema.nullable().optional(),
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
  const originalPlan = ConversationPlanSchema.parse(output);
  // Validate model quotations before any normalization can replace a change.
  for (const change of originalPlan.changes) {
    if (!normalise(request.message).includes(normalise(change.evidence))) {
      throw new PlanEvidenceError(`changes.${change.scope}.${change.field}.evidence`);
    }
  }
  const originalIntent = originalPlan.styling_intent;
  const stylingQuotes = originalIntent ? [
    ...originalIntent.preferences.map(change => change.evidence),
    ...originalIntent.outfit_changes.map(change => change.evidence),
    ...originalIntent.owned_categories.map(change => change.evidence),
    ...(originalIntent.offers ? [originalIntent.offers.evidence] : []),
    ...(originalIntent.external_items ?? []).map(change => change.description),
  ] : [];
  for (const quote of stylingQuotes) {
    if (!normalise(request.message).includes(normalise(quote))) throw new PlanEvidenceError("styling.evidence");
  }
  const plan = groundConversationPlan(request, originalPlan);
  let scopes = PreferenceScopesSchema.parse(request.scopes);
  const continuing = plan.continuation === true;
  const originalStyling = StylingStateSchema.parse(request.styling ?? emptyStylingState());
  const resumesDescription = plan.action === "cross_sell" && originalStyling.external_items.length > 0 &&
    !plan.changes.some(change => change.field === "category" && change.value !== request.scopes.item.category);
  let styling = StylingStateSchema.parse(originalStyling);
  let stylingQuestion: string | null = null;

  if (continuing && (!request.pending ||
      (request.pending.action !== "clarify" && request.pending.action !== plan.action))) {
    throw new PlanValidationError("Continuation does not match the pending request.");
  }
  let reference = plan.reference ?? (continuing ? request.pending?.reference ?? null : null);
  if (plan.action === "cross_sell" && (!reference || reference.kind === "context") &&
      /\b(?:owned|my outfit|both|all my)\b/i.test(request.message) && originalStyling.outfit.length) {
    const role = request.message.match(/\bowned\s+(dress|bag|shoes?)\b/i)?.[1];
    const category = role ? /dress/i.test(role) ? "Clothing" : /bag/i.test(role) ? "Bags" : "Shoes" : null;
    const anchors = originalStyling.outfit.filter(piece => !category || piece.category === category);
    if (anchors.length === 1 || /\b(?:both|my outfit|all my)\b/i.test(request.message)) {
      reference = anchors[0] ? { kind: "id", value: anchors[0].product_id } : reference;
    }
  }

  function requireEvidence(quote: string, field: string) {
    const quotedText = normalise(quote);
    if (!quotedText || !normalise(request.message).includes(quotedText)) {
      throw new PlanEvidenceError(field);
    }
  }

  requireEvidence(plan.intent_evidence, "intent_evidence");
  const dressCode = dressCodeFromMessage(request.message);
  if (plan.action === "new_search") styling.dress_code = null;
  if (plan.action === "refine" && originalStyling.outfit_request && dressCode) styling.dress_code = dressCode;
  if (plan.action === "clarify") {
    if (!plan.question) throw new PlanValidationError("A clarification plan must include a question.");
    const composition = composePreferences(scopes);
    return { status: "needs_clarification", action: plan.action, reference_product_ids: [] as string[],
      proposed_scopes: scopes, styling: originalStyling, styling_question: false,
      preferences: composition.status === "ready" ? composition.preferences : null,
      message: plan.question ?? "Could you rephrase that change? Your saved shopping preferences are unchanged." };
  }
  if (plan.outfit_request) {
    const outfit = plan.outfit_request;
    requireEvidence(outfit.evidence, "outfit_request.evidence");
    if (!["new_search", "refine"].includes(plan.action)) {
      throw new PlanValidationError("A shared-budget outfit search uses new_search or refine.");
    }
    const previous = originalStyling.outfit_request;
    const amounts = [...outfit.evidence.matchAll(/(?:A?\$\s*(\d+(?:\.\d{1,2})?)\b|(\d+(?:\.\d{1,2})?)\s*(?:AUD|dollars?)\b)/gi)]
      .map(match => Number(match[1] ?? match[2]));
    const unlabelledBudget = outfit.evidence.match(/\b(?:budget|total|under|maximum|up to)\b[^\d]{0,70}(\d+(?:\.\d{1,2})?)\b/i);
    if (unlabelledBudget) amounts.push(Number(unlabelledBudget[1]));
    if (outfit.total_budget_aud !== previous?.total_budget_aud && !amounts.includes(outfit.total_budget_aud)) {
      throw new PlanValidationError("The combined budget must be stated in the latest outfit evidence.");
    }
    if (outfit.items.some(item => !item.category)) throw new PlanValidationError("Specify a category for every requested outfit item.");
    if (plan.changes.some(change => ["min_price", "max_price"].includes(change.field) && change.value === outfit.total_budget_aud)) {
      throw new PlanValidationError("Store the combined total only in outfit_request.total_budget_aud, never as a per-item price change.");
    }
    styling.outfit_request = outfit;
  } else if (["new_search", "cross_sell", "cheaper", "upsell"].includes(plan.action)) {
    styling.outfit_request = null;
  }
  if (!continuing && ["new_search", "cross_sell"].includes(plan.action) && !resumesDescription) {
    styling.priorities = []; styling.required_features = [];
  }
  if (plan.styling_intent) {
    const intent = plan.styling_intent;
    for (const item of intent.external_items ?? []) {
      requireEvidence(item.description, "styling.external.description");
      if (item.operation === "remove") {
        if (!/\b(?:remove|forget|delete)\b/i.test(request.message)) throw new PlanValidationError("Removing a described item needs explicit permission.");
        styling.external_items = styling.external_items.filter(row => normalise(row.description) !== normalise(item.description));
        continue;
      }
      if (!/\b(?:own|owned|already have|bought|my)\b/i.test(request.message)) throw new PlanValidationError("A described owned item needs an ownership statement.");
      for (const field of ["colour", "product_type", "occasion"] as const) {
        if (item[field] && !normalise(item.description).includes(normalise(item[field]))) {
          throw new PlanValidationError(`External ${field} must be stated in the quoted garment description; otherwise use null.`);
        }
      }
      if (!styling.external_items.some(row => normalise(row.description) === normalise(item.description))) {
        let id = 1;
        while (styling.external_items.some(row => row.external_id === `external-${id}`)) id++;
        const { operation, ...description } = item; void operation;
        styling.external_items.push({ ...description, external_id: `external-${id}`, source: "customer_description" });
      }
    }
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
    const pool = [...request.context.latest, ...(request.context.previous?.flat() ?? []), ...(request.context.focused ? [request.context.focused] : []), ...(request.context.comparison ? [request.context.comparison] : []), ...originalStyling.outfit];
    for (const change of intent.outfit_changes) {
      requireEvidence(change.evidence, "styling.outfit.evidence");
      // Interest is not consent to select an outfit piece. A short answer can
      // complete a previously explicit keep request, but a bare "I like" cannot.
      if (change.operation === "keep" &&
          !/\b(?:keep|select|choose|add\b.{0,30}\boutfit)\b/i.test(change.evidence) &&
          !(request.pending?.styling_question && /\b(?:keep|select|choose)\b/i.test(request.pending.goal))) continue;
      if (change.operation === "own" && !/\b(?:own|owned|already have|bought)\b/i.test(change.evidence) &&
          !(request.pending?.styling_question && /\b(?:own|owned|already have|bought)\b/i.test(request.pending.goal))) continue;
      const resolved = resolveProductReference(context, change.reference);
      if (resolved.status !== "resolved") { stylingQuestion = `${resolved.message} Please specify the action too, for example: keep the first product.`; break; }
      const product = pool.find(row => row.product_id === resolved.product_id)!;
      const alreadyOwned = styling.outfit.some(row => row.product_id === product.product_id && row.ownership === "owned");
      styling.outfit = styling.outfit.filter(row => row.product_id !== product.product_id);
      if (change.operation === "keep" || change.operation === "own") {
        styling.outfit = styling.outfit.filter(row => !(row.category === product.category && row.subcategory === product.subcategory));
        styling.outfit.push({ ...product, ownership: change.operation === "own" || alreadyOwned ? "owned" : "selected" });
        styling.rejected_ids = styling.rejected_ids.filter(id => id !== product.product_id);
      } else if (change.operation === "reject") {
        styling.rejected_ids = [...new Set([...styling.rejected_ids, product.product_id])].slice(-50);
      }
    }
    if (stylingQuestion) styling = originalStyling;
    styling = StylingStateSchema.parse(styling);
  }
  if (plan.action === "upsell") {
    // A requested replacement WITH a must-have is also an explicit reason to
    // compare that feature. Do not rely on a second duplicate model annotation.
    const priorities = { lining: "lining", pockets: "pockets", adjustable_strap: "adjustability",
      zip_closure: "closure", machine_washable: "easy_care" } as const;
    styling.priorities = [...new Set([...styling.priorities,
      ...styling.required_features.map(feature => priorities[feature])])];
  }
  if (plan.answer) {
    const answer = plan.answer;
    if (answer.kind === "outfit_review" && (plan.action !== "none" || answer.references.length || answer.continuation || plan.styling_intent)) {
      throw new PlanValidationError("An outfit review answers from the current styling.outfit and external_items without selecting, removing or searching for products. Use action=none, references=[], continuation=false and styling_intent=null.");
    }
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
  if (plan.question !== null) {
    throw new PlanValidationError("Only a clarification plan may include a question.");
  }
  if (plan.action === "none" && (plan.changes.length > 0 || plan.reference !== null)) {
    if (plan.answer) throw new PlanValidationError("A pure answer MUST have changes=[] and top-level reference=null. Put product references ONLY in answer.references and the quoted occasion ONLY in answer.purpose. Asking why an item suits an occasion does not save that occasion as a shopping preference. If the user also explicitly requests a search, choose that shopping action instead of none.");
    throw new PlanValidationError("An unrelated turn cannot change preferences or select a product.");
  }

  // An answer to a pending cross-sell must not erase the requested extra item.
  if (!continuing && (plan.action === "new_search" || (plan.action === "cross_sell" && !resumesDescription))) {
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

    const clearColours = field === "preferred_colours" && change.operation === "set" && Array.isArray(change.value) && !change.value.length;
    if (!Array.isArray(change.value) || (!change.value.length && !clearColours)) {
      throw new PlanValidationError("A list change requires one or more labels.");
    }
    if (change.operation === "set" && field !== "preferred_colours") {
      throw new PlanValidationError("Exclusions and unresolved requirements require add or remove.");
    }

    const old = field === "unresolved"
      ? scopes[change.scope === "item" ? "unresolved_item" : "unresolved_shared"]
      : scopes[change.scope][field];
    if (clearColours && old.length && !/\b(?:(?:any|all) colou?rs?|no (?:preferred |particular |specific )?colou?r(?: preference)?|(?:remove|clear|drop)\b.{0,25}\bcolou?r)\b/i.test(request.message)) {
      throw new PlanValidationError("Clearing a saved colour restriction requires explicit permission, such as any colour or remove the colour preference.");
    }
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
  if (styling.outfit_request && ["new_search", "refine"].includes(plan.action)) {
    // Item identity and sizes live on each component, not on the complete set.
    for (const field of ["category", "subcategory", "product_type", "size"] as const) scopes.item[field] = null;
  }
  if (plan.action === "new_search" && !scopes.item.category && !scopes.item.subcategory && !scopes.item.product_type &&
      !styling.outfit_request &&
      !scopes.unresolved_item.length && !scopes.unresolved_shared.length &&
      /\b(?:dresses|dress|bags|bag|shoes|shoe|clothing|accessories|accessory)\b/i.test(request.message)) {
    throw new PlanValidationError("A new_search clears the old item scope, so it must include the stated item/category even if it was previously selected. For a repeated request for the same item category, use refine and retain all existing requirements instead of an empty new_search.");
  }
  if (plan.action !== "none") {
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
    const targetBrief = request.message.split(/\b(?:to go with|to match|with my|my owned)\b/i)[0];
    const requestedRoles = new Set(targetBrief.match(/\b(?:dress(?:es)?|shoes?|bags?|necklaces?)\b/gi)?.map(role =>
      /dress/i.test(role) ? "Dresses" : /shoe/i.test(role) ? "Shoes" : /bag/i.test(role) ? "Bags" : "Necklace"));
    const explicitTotal = ["new_search", "refine"].includes(plan.action) && requestedRoles.size > 1 && /\b(?:total|combined|both|together|all of them)\b/i.test(request.message);
    if (explicitTotal && !styling.outfit_request) {
      throw new PlanValidationError("Use outfit_request with every requested component and the combined total. Do not fulfil a shared-budget request with a single-item search or mark this supported request unresolved.");
    }
    if (explicitTotal && styling.outfit_request && [...requestedRoles].some(role =>
        !styling.outfit_request!.items.some(item => role === "Dresses" ? item.category === "Clothing" && item.subcategory === "Dresses"
          : role === "Necklace" ? item.product_type === "Necklace" : item.category === role))) {
      throw new PlanValidationError("The outfit_request must include every explicitly requested component.");
    }
    if (!plan.outfit_request && styling.outfit_request && plan.changes.some(change => change.field === "max_price") &&
        /\b(?:budget|total|combined|both)\b/i.test(request.message)) {
      throw new PlanValidationError("Update outfit_request.total_budget_aud for a combined-budget refinement; retain all components.");
    }
    if (completeOutfit && !styling.outfit_request && !unresolved.some(label => /\b(?:outfit|look|total|combined)\b/i.test(label))) {
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
  } else if (plan.action === "cross_sell" && styling.external_items.length && (!reference || reference.kind === "context") && !styling.outfit.length) {
    // A customer description has no SKU to resolve or verify in the catalogue.
  } else if (reference !== null || plan.action === "cross_sell" || plan.action === "upsell") {
    const resolved = resolveProductReference(request.context, reference ?? { kind: "context" });
    if (resolved.status === "resolved") referenceIds.push(resolved.product_id);
    else referenceQuestion = resolved.message;
  }

  const clarification = stylingQuestion ?? (composition.status === "needs_clarification"
    ? composition.message
    : referenceQuestion);

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
      return groundConversationPlan(request, candidate);
    } catch (error) {
      // Only malformed model output is recoverable here. Provider failures,
      // cancellation and unexpected application errors remain technical errors.
      if (!(error instanceof PlanValidationError || error instanceof z.ZodError || error instanceof SyntaxError)) throw error;
      failedEvidenceField = error instanceof PlanEvidenceError ? error.field : null;
      validationFeedback = error instanceof z.ZodError
        ? error.issues.slice(0, 3).map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ").slice(0, 1200)
        : error instanceof SyntaxError ? "The model output was not valid JSON." : error.message;
      console.warn("Conversation plan rejected", { attempt: attempt + 1, type: error.name,
        field: failedEvidenceField, reason: validationFeedback });
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
    ...(unsupported.material ? [`verify ${unsupported.material}-free products`] : []),
  ];
  return ConversationPlanSchema.parse({
    action: "clarify",
    intent_evidence: request.message.slice(0, 250),
    reference: null,
    changes: [],
    question: limitations.length
      ? `I can't yet ${limitations.join(" or ")}. Which part of your request would you like to change? I haven't changed your saved preferences or selected any products.`
      : unsupported.completeOutfit ? "I couldn't reliably interpret that outfit request. Please name the pieces and their combined budget again. Your saved preferences are unchanged."
      : "Could you rephrase what you'd like me to find or change? I haven't changed your saved preferences or searched with unverified requirements.",
    continuation: false,
  });
}
