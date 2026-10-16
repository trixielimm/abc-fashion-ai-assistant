import { z } from "zod";
import { ShoppingPreferencesSchema } from "../ai/preferenceSchema";
import {
  composePreferences, createPreferenceScopes,
  emptyShoppingPreferences, PreferenceScopesSchema,
} from "./preferenceScope";
import { ProductReferenceSchema, resolveProductReference } from "./productReference";

const text = z.string().trim().min(1).max(250);
const ContextProductSchema = z.strictObject({
  product_id: text,
  product_name: text,
  category: ShoppingPreferencesSchema.shape.category,
  subcategory: text.nullable(),
  product_type: text.nullable(),
  price_aud: z.number().nonnegative().optional(),
});

export const PendingConversationSchema = z.strictObject({
  action: z.enum(["new_search", "refine", "cross_sell", "cheaper", "upsell", "clarify"]),
  reference: ProductReferenceSchema.nullable(),
  goal: z.string().min(1).max(2000),
  question: z.string().min(1).max(4000),
  before_scopes: PreferenceScopesSchema,
});

export const ConversationPlanRequestSchema = z.strictObject({
  message: z.string().trim().min(1).max(2000),
  scopes: PreferenceScopesSchema.default(createPreferenceScopes),
  context: z.strictObject({
    focused: ContextProductSchema.nullable(),
    latest: z.array(ContextProductSchema).max(4),
  }).default({ focused: null, latest: [] }),
  history: z.array(z.strictObject({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(2000),
  })).max(8).default([]),
  pending: PendingConversationSchema.nullable().optional(),
});

export const ConversationPlanSchema = z.strictObject({
  action: z.enum(["new_search", "refine", "cross_sell", "cheaper", "upsell", "clarify", "none"]),
  intent_evidence: text,
  reference: ProductReferenceSchema.nullable(),
  changes: z.array(z.strictObject({
    scope: z.enum(["item", "shared"]),
    field: z.enum([...ShoppingPreferencesSchema.keyof().options, "unresolved"]),
    operation: z.enum(["set", "add", "remove"]),
    value: z.union([text, z.number().nonnegative(), z.array(text).max(12), z.null()]),
    evidence: text,
  })).max(24),
  question: z.string().trim().min(1).max(400).nullable(),
  // Optional for existing offline fixtures; required by the live model schema.
  continuation: z.boolean().optional(),
});

export type ConversationPlanRequest = z.infer<typeof ConversationPlanRequestSchema>;
const normalise = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

export function checkConversationPlan(input: unknown, output: unknown) {
  const request = ConversationPlanRequestSchema.parse(input);
  const plan = ConversationPlanSchema.parse(output);
  let scopes = PreferenceScopesSchema.parse(request.scopes);
  const continuing = plan.continuation === true;

  if (continuing && (!request.pending ||
      (request.pending.action !== "clarify" && request.pending.action !== plan.action))) {
    throw new Error("Continuation does not match the pending request.");
  }
  const reference = plan.reference ?? (continuing ? request.pending?.reference ?? null : null);

  function requireEvidence(quote: string, field: string) {
    const quotedText = normalise(quote);
    if (!quotedText || !normalise(request.message).includes(quotedText)) {
      throw new PlanEvidenceError(field);
    }
  }

  requireEvidence(plan.intent_evidence, "intent_evidence");
  if ((plan.action === "clarify") !== (plan.question !== null)) {
    throw new Error("Only a clarification plan may include a question.");
  }
  if (plan.action === "none" && (plan.changes.length > 0 || plan.reference !== null)) {
    throw new Error("An unrelated turn cannot change preferences or select a product.");
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
    const key = `${change.scope}.${field}`;
    if (touched.has(key)) throw new Error("Use one change per field per turn.");
    touched.add(key);

    if (change.scope === "shared" && ["category", "subcategory", "product_type", "size"].includes(field)) {
      throw new Error("Product identity and size cannot be shared globally.");
    }
    const listField = field === "preferred_colours" || field === "excluded_colours" || field === "unresolved";
    if (!listField) {
      if (change.operation !== "set" || Array.isArray(change.value)) {
        throw new Error("A scalar preference requires a set operation.");
      }
      Object.assign(scopes[change.scope], { [field]: change.value });
      continue;
    }

    if (!Array.isArray(change.value) || !change.value.length) {
      throw new Error("A list change requires one or more labels.");
    }
    if (change.operation === "set" && field !== "preferred_colours") {
      throw new Error("Exclusions and unresolved requirements require add or remove.");
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

  const clarification = composition.status === "needs_clarification"
    ? composition.message
    : referenceQuestion ?? (plan.action === "clarify" ? plan.question ?? "Please clarify your shopping request." : null);

  return {
    status: plan.action === "none" ? "no_action" : clarification ? "needs_clarification" : "ready_for_validation",
    action: plan.action,
    reference_product_ids: referenceIds,
    proposed_scopes: scopes,
    preferences: composition.status === "ready" ? composition.preferences : null,
    message: clarification ?? (plan.action === "none"
      ? "No shopping action was requested."
      : "Interpretation checked. Catalogue validation and retrieval have not run."),
  };
}

export class PlanEvidenceError extends Error {
  readonly field: string;
  constructor(field: string) {
    super(`Plan evidence is not present in the latest message (${field}).`);
    this.name = "PlanEvidenceError";
    this.field = field;
  }
}

export async function generateValidatedConversationPlan(
  input: unknown,
  generate: (failedEvidenceField: string | null) => Promise<unknown>
): Promise<z.infer<typeof ConversationPlanSchema>> {
  const request = ConversationPlanRequestSchema.parse(input);
  let failedEvidenceField: string | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const candidate = ConversationPlanSchema.parse(await generate(failedEvidenceField));
    try {
      checkConversationPlan(request, candidate);
      return candidate;
    } catch (error) {
      if (!(error instanceof PlanEvidenceError) || attempt === 1) throw error;
      failedEvidenceField = error.field;
    }
  }
  throw new Error("No validated conversation plan was returned.");
}