import { z } from "zod";
import { ShoppingPreferencesSchema } from "../ai/preferenceSchema";
import { relatedLabel } from "../search/preferenceSearch";
import { ConversationPlanRequestSchema, PendingConversationSchema } from "./conversationPlan";
import { createPreferenceScopes, emptyShoppingPreferences, PreferenceScopesSchema } from "./preferenceScope";
import { safeProductImageSource } from "./catalogueImages";
import { getProductImageEndpoint } from "../product-image";
import { AnswerSourceSchema, PendingAnswerSchema } from "./answerPlan";
import { emptyStylingState, PairingEvidenceSchema, StylingStateSchema, ValueComparisonSchema, COMMERCE_POLICY } from "./commerceSchema";
import { OutfitBudgetSchema, OutfitChoicesSchema, priceCents } from "./outfitBudgetSchema";
import { HISTORY_MESSAGES, MAX_DISPLAYED_PRODUCTS } from "./conversationLimits";
import { OutfitReviewSchema } from "./outfitReview";

export const ShortcutSchema = z.strictObject({
  kind: z.enum(["cross_sell", "cheaper", "upsell", "keep", "own", "remove", "reject"]),
  product_id: z.string().trim().min(1).max(250),
});
export const TurnSchema = ConversationPlanRequestSchema.extend({
  shortcut: ShortcutSchema.optional(),
  // An explicit, one-turn request to PREVIEW other colours, not change saved preferences.
  preview_other_colours: z.boolean().optional(),
});
export type ConversationTurn = z.infer<typeof TurnSchema>;
export const EnvelopeSchema = z.strictObject({
  request_id: z.string().uuid(),
  retry: z.boolean().default(false),
  turn: TurnSchema,
});
export type TurnEnvelope = z.infer<typeof EnvelopeSchema>;

export const ChatProductSchema = z.object({
  product_id: z.string().trim().min(1),
  product_name: z.string().trim().min(1),
  price_aud: z.number().nonnegative(),
  category: ShoppingPreferencesSchema.shape.category,
  subcategory: z.string().nullable(),
  product_type: z.string().nullable(),
  brand_line: z.string().nullable(),
  colour: z.string().nullable(),
  occasion: z.string().nullable().optional(),
  style: z.string().nullable().optional(),
  sizes_available: z.array(z.string().trim().min(1)).min(1),
  explanation: z.string().optional(),
  extra_target: z.string().nullable().optional(),
  image_src: z.string().refine(safeProductImageSource, "Use a local image or the product image route.").nullable().optional(),
  pairing_evidence: PairingEvidenceSchema.optional(),
  value_comparison: ValueComparisonSchema.optional(),
});
export type ChatProduct = z.infer<typeof ChatProductSchema>;
export const AlternativeProductSchema = ChatProductSchema.extend({
  differences: z.array(z.string().trim().min(1)).min(1),
});
export type AlternativeProduct = z.infer<typeof AlternativeProductSchema>;

const normalise = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
export const TurnReplySchema = z.object({
  intent_understood: z.boolean().default(true),
  outfit_budget: OutfitBudgetSchema.nullable().default(null),
  outfit_choices: OutfitChoicesSchema.nullable().default(null),
  outfit_review: OutfitReviewSchema.nullable().default(null),
  status: z.enum(["matches", "partial", "alternatives", "no_match", "no_action", "answered", "needs_clarification", "no_upsell", "no_rule", "rule_unavailable", "primary_unavailable", "primary_mismatch"]),
  action: z.enum(["new_search", "refine", "cross_sell", "cheaper", "upsell", "clarify", "none"]),
  message: z.string().min(1),
  proposed_scopes: PreferenceScopesSchema,
  applied_preferences: ShoppingPreferencesSchema.nullable(),
  products: z.array(ChatProductSchema).max(MAX_DISPLAYED_PRODUCTS),
  alternatives: z.array(AlternativeProductSchema).max(4).default([]),
  alternatives_preferences: ShoppingPreferencesSchema.nullable().default(null),
  alternative_kind: z.enum(["context_difference", "colour_preview"]).nullable().default(null),
  optional_question: z.string().min(1).nullable().default(null),
  can_preview_other_colours: z.boolean().default(false),
  pending: PendingConversationSchema.nullable(),
  pending_answer: PendingAnswerSchema.nullable().default(null),
  answer_sources: z.array(AnswerSourceSchema).max(8).default([]),
  answer_product_ids: z.array(z.string().min(1)).max(8).default([]),
  styling: StylingStateSchema.default(emptyStylingState),
  commerce_policy: z.literal(COMMERCE_POLICY).default(COMMERCE_POLICY),
  feature_data_status: z.enum(["available", "not_configured", "unavailable"]).optional(),
  comparison_reference_id: z.string().min(1).nullable().default(null),
}).superRefine((reply, ctx) => {
  const reject = (message: string) => ctx.addIssue({ code: "custom", message });
  const matches = reply.status === "matches" || reply.status === "partial";
  if (matches !== (reply.products.length > 0)) reject("Status and exact products disagree.");
  if (reply.status === "alternatives" && !reply.alternatives.length) reject("Alternatives status requires alternatives.");
  if (reply.alternatives.length && !["matches", "partial", "alternatives"].includes(reply.status)) reject("Alternatives cannot hide a blocking result.");
  const all = [...reply.products, ...reply.alternatives];
  if (reply.outfit_review && (reply.status !== "answered" || reply.action !== "none" || all.length || reply.outfit_budget || reply.outfit_choices)) reject("An outfit review must be an answer without shopping results.");
  const budget = reply.outfit_budget;
  const choices = reply.outfit_choices;
  if (budget) {
    const total = budget.items.reduce((sum, item) => sum + priceCents(reply.products.find(product => product.product_id === item.product_id)?.price_aud ?? NaN), 0);
    if (reply.status !== "matches" || reply.alternatives.length || !reply.styling.outfit_request ||
        priceCents(budget.limit_aud) !== priceCents(reply.styling.outfit_request.total_budget_aud) ||
        budget.items.length !== reply.styling.outfit_request.items.length ||
        (!choices && budget.items.length !== reply.products.length) || new Set(budget.items.map(item => item.product_id)).size !== budget.items.length ||
        budget.items.some(item => !reply.products.some(product => product.product_id === item.product_id)) ||
        total !== priceCents(budget.total_aud) || total > priceCents(budget.limit_aud) ||
        priceCents(budget.remaining_aud) !== priceCents(budget.limit_aud) - total) reject("The complete outfit and combined budget are inconsistent.");
  } else if (reply.styling.outfit_request && ["new_search", "refine"].includes(reply.action) && all.length) {
    reject("A shared-budget outfit requires a verified complete-set total.");
  }
  if (choices) {
    const ids = choices.groups.flatMap(group => group.product_ids);
    const maximum = choices.groups.reduce((sum, group) => sum + Math.max(...group.product_ids.map(id =>
      priceCents(reply.products.find(product => product.product_id === id)?.price_aud ?? NaN))), 0);
    const minimum = choices.groups.reduce((sum, group) => sum + Math.min(...group.product_ids.map(id =>
      priceCents(reply.products.find(product => product.product_id === id)?.price_aud ?? NaN))), 0);
    if (!budget || reply.status !== "matches" || reply.alternatives.length ||
        choices.groups.length !== reply.styling.outfit_request?.items.length ||
        ids.length !== reply.products.length || new Set(ids).size !== ids.length ||
        ids.some(id => !reply.products.some(product => product.product_id === id)) ||
        choices.groups.some((group, i) => !group.product_ids.includes(budget.items[i]?.product_id)) ||
        minimum !== priceCents(budget.total_aud) || maximum !== priceCents(choices.maximum_total_aud) || maximum > priceCents(budget.limit_aud)) {
      reject("Grouped outfit choices must cover each component and every displayed combination must fit the total.");
    }
  }
  if (all.some(product => product.image_src?.startsWith("/api/products/") &&
      product.image_src !== getProductImageEndpoint(product.product_id))) reject("The image route must belong to the displayed product.");
  if (all.length > (choices ? MAX_DISPLAYED_PRODUCTS : 4) || new Set(all.map(p => p.product_id)).size !== all.length) reject("Return unique displayed products within the shortlist limit.");
  if ((reply.status === "needs_clarification") !== (reply.pending !== null) && !["no_action", "answered"].includes(reply.status)) reject("Missing or unexpected pending question.");
  if (reply.status === "answered" && (reply.action !== "none" || all.length || reply.applied_preferences !== null || reply.can_preview_other_colours)) reject("Answer-only replies cannot perform a shopping action.");
  if (reply.pending_answer && !["answered", "no_action"].includes(reply.status)) reject("Resolve the product question before another shopping action.");
  if (all.length && !reply.applied_preferences) reject("Displayed products need applied preferences.");
  if (reply.optional_question && (!all.length || reply.pending)) reject("An optional question cannot be a blocking question.");

  function checkProducts(products: ChatProduct[], preferences: z.infer<typeof ShoppingPreferencesSchema> | null) {
    if (!products.length) return;
    if (!preferences) { reject("Products require explicit filter context."); return; }
    for (const product of products) {
      if (product.value_comparison) {
        const value = product.value_comparison;
        if (Math.abs(Math.round(product.price_aud * 100) - Math.round(value.primary_price_aud * 100) - Math.round(value.extra_cost_aud * 100)) > 0 ||
            (value.kind === "upgrade") !== (value.extra_cost_aud > 0)) reject("The value comparison price difference is inconsistent.");
      }
      if ((preferences.max_price !== null && product.price_aud > preferences.max_price) ||
          (preferences.min_price !== null && product.price_aud < preferences.min_price) ||
          (preferences.size !== null && !product.sizes_available.some(s => normalise(s) === normalise(preferences.size!)))) reject("Returned products violate price or size constraints.");
      for (const field of ["category", "subcategory", "product_type"] as const) {
        if (preferences[field] !== null && !relatedLabel(product[field], preferences[field]!)) reject("Returned product identity differs from its filters.");
      }
      if (preferences.preferred_colours.length && !preferences.preferred_colours.some(c => relatedLabel(product.colour, c))) reject("A required colour was not met.");
      if (preferences.excluded_colours.length && (!product.colour || preferences.excluded_colours.some(c => relatedLabel(product.colour, c)))) reject("A colour exclusion was not respected.");
    }
  }
  if (budget) {
    for (const item of budget.items) checkProducts(reply.products.filter(product => product.product_id === item.product_id), item.preferences);
  }
  if (choices) {
    for (const [index, group] of choices.groups.entries()) {
      const products = reply.products.filter(product => group.product_ids.includes(product.product_id));
      checkProducts(products, group.preferences);
      checkProducts(products, reply.styling.outfit_request?.items[index] ?? null);
    }
  }
  checkProducts(reply.products, reply.applied_preferences);
  checkProducts(reply.alternatives, reply.alternatives_preferences);
  if (reply.alternatives.length) {
    const requested = reply.applied_preferences;
    const compared = reply.alternatives_preferences;
    if (!requested || !compared || !reply.alternative_kind) { reject("Missing alternative context."); return; }
    for (const field of Object.keys(requested) as Array<keyof typeof requested>) {
      if (reply.alternative_kind === "colour_preview" && field === "preferred_colours") continue;
      if (JSON.stringify(requested[field]) !== JSON.stringify(compared[field])) reject("Alternatives cannot weaken other filters.");
    }
    if (reply.alternative_kind === "colour_preview" &&
        (reply.proposed_scopes.shared.preferred_colours.length > 0 || compared.preferred_colours.length > 0)) reject("A colour preview cannot override a shared colour rule.");
  }
});
export type TurnReply = z.infer<typeof TurnReplySchema>;

export type Session = {
  scopes: z.infer<typeof PreferenceScopesSchema>;
  pending: z.infer<typeof PendingConversationSchema> | null;
  pending_answer?: z.infer<typeof PendingAnswerSchema> | null;
  context: ConversationTurn["context"];
  history: ConversationTurn["history"];
  styling?: z.infer<typeof StylingStateSchema>;
  cart_product_ids?: string[];
};
export function newSession(): Session {
  return { scopes: createPreferenceScopes(), pending: null, pending_answer: null, context: { focused: null, latest: [] }, history: [], styling: emptyStylingState() };
}
export function snapshot(product: {
  product_id: string; product_name: string; price_aud?: number;
  category: ChatProduct["category"]; subcategory: string | null; product_type: string | null;
  pairing_evidence?: { anchor_ids: string[] };
  value_comparison?: { primary_product_id: string };
  recommendation_context?: ConversationTurn["context"]["latest"][number]["recommendation_context"];
}): NonNullable<ConversationTurn["context"]["focused"]> {
  const { product_id, product_name, category, subcategory, product_type, price_aud } = product;
  const recommendation_context = product.pairing_evidence || product.value_comparison ? {
    anchor_ids: product.pairing_evidence?.anchor_ids ?? [],
    primary_product_id: product.value_comparison?.primary_product_id ?? null,
  } : product.recommendation_context;
  return { product_id, product_name, category, subcategory, product_type, price_aud,
    ...(recommendation_context ? { recommendation_context } : {}) };
}
export function makeTurn(
  session: Session, message: string,
  focus: ConversationTurn["context"]["focused"] = null,
  shortcut?: z.infer<typeof ShortcutSchema>,
  previewOtherColours = false
): ConversationTurn {
  const scopes = PreferenceScopesSchema.parse(session.scopes);
  const styling = StylingStateSchema.parse(session.styling ?? emptyStylingState());
  const known = [...session.context.latest, ...(session.context.previous?.flat() ?? []), ...(session.context.focused ? [session.context.focused] : []), ...(session.context.comparison ? [session.context.comparison] : []), ...styling.outfit];
  if (focus && !known.some(p => p.product_id === focus.product_id) && !session.pending) {
    const savedSize = scopes.item.category === focus.category ? scopes.item.size : null;
    scopes.item = { ...emptyShoppingPreferences(), size: savedSize };
    scopes.unresolved_item = [];
  }
  return TurnSchema.parse({
    message, scopes, pending: shortcut && ["cross_sell", "cheaper", "upsell"].includes(shortcut.kind) ? null : session.pending,
    pending_answer: (shortcut && ["cross_sell", "cheaper", "upsell"].includes(shortcut.kind)) || previewOtherColours ? null : session.pending_answer ?? null,
    context: { focused: focus ?? session.context.focused, latest: session.context.latest,
      ...(session.context.previous?.length ? { previous: session.context.previous } : {}),
      ...(session.context.comparison ? { comparison: session.context.comparison } : {}),
      ...(styling.outfit.length ? { selected: styling.outfit.map(snapshot) } : {}) },
    styling, cart_product_ids: session.cart_product_ids ?? [],
    history: session.history.slice(-HISTORY_MESSAGES), ...(shortcut ? { shortcut } : {}),
    ...(previewOtherColours ? { preview_other_colours: true } : {}),
  });
}
export function acceptReply(turn: ConversationTurn, input: unknown): { reply: TurnReply; session: Session } {
  const reply = TurnReplySchema.parse(input);
  if (!reply.intent_understood && (JSON.stringify(reply.proposed_scopes) !== JSON.stringify(turn.scopes) ||
      JSON.stringify(reply.styling) !== JSON.stringify(turn.styling ?? emptyStylingState()))) {
    throw new Error("An unclear intention cannot change remembered shopping preferences or outfit choices.");
  }
  if (reply.alternative_kind === "colour_preview" && turn.preview_other_colours !== true) {
    throw new Error("Colour alternatives require the explicit preview action.");
  }
  const visible = [...reply.products, ...reply.alternatives];
  const previous = [turn.context.latest, ...(turn.context.previous ?? [])].filter(products => products.length).slice(0, 2);
  const context: Session["context"] = !reply.intent_understood || reply.pending || !visible.length || reply.status === "answered"
    ? { ...turn.context, latest: [...turn.context.latest] } : { focused: null, latest: visible.map(snapshot),
      ...(previous.length ? { previous } : {}) };
  if (reply.status === "answered") {
    if (JSON.stringify(reply.proposed_scopes) !== JSON.stringify(turn.scopes) ||
        JSON.stringify(reply.pending) !== JSON.stringify(turn.pending ?? null)) {
      throw new Error("An answer cannot change saved shopping preferences or a pending search.");
    }
    if (reply.outfit_review) {
      const styling = turn.styling ?? emptyStylingState();
      if (JSON.stringify(reply.styling) !== JSON.stringify(styling) ||
          !styling.outfit.length && !styling.external_items.length ||
          JSON.stringify(reply.answer_product_ids) !== JSON.stringify(styling.outfit.map(piece => piece.product_id))) {
        throw new Error("An outfit review must cover the current selected pieces without changing them.");
      }
    }
    if (reply.answer_product_ids.length) {
      const pool = [turn.context.focused, turn.context.comparison, ...turn.context.latest, ...(turn.context.previous?.flat() ?? []), ...(turn.context.selected ?? [])];
      if (reply.answer_product_ids.some(id => !pool.some(row => row?.product_id === id))) {
        throw new Error("The answered products must belong to the current context.");
      }
      const product = reply.answer_product_ids.length === 1 ? pool.find(row => row?.product_id === reply.answer_product_ids[0]) : null;
      // Keep displayed order, while making a subsequent 'it' refer to the item just discussed.
      context.focused = product ?? null;
    }
  }
  if (reply.action === "upsell" && reply.comparison_reference_id) {
    const product = [turn.context.focused, turn.context.comparison, ...turn.context.latest, ...(turn.context.previous?.flat() ?? []), ...(turn.context.selected ?? [])].find(row => row?.product_id === reply.comparison_reference_id);
    if (!product) throw new Error("The comparison reference must belong to the conversation.");
    context.comparison = product;
    if (reply.status === "no_upsell") context.focused = product;
  }
  const spoken = [reply.message, reply.optional_question].filter(Boolean).join("\n");
  const history: Session["history"] = !reply.intent_understood ? turn.history : [
    ...turn.history, { role: "user", content: turn.message },
    { role: "assistant", content: spoken.slice(0, 2000) },
  ];
  return { reply, session: {
    scopes: PreferenceScopesSchema.parse(reply.proposed_scopes), pending: reply.pending,
    pending_answer: reply.pending_answer,
    styling: reply.styling,
    cart_product_ids: turn.cart_product_ids,
    context, history: history.slice(-HISTORY_MESSAGES),
  } };
}
