import { z } from "zod";
import { ShoppingPreferencesSchema } from "../ai/preferenceSchema";
import { relatedLabel } from "../search/preferenceSearch";
import { ConversationPlanRequestSchema, PendingConversationSchema } from "./conversationPlan";
import { createPreferenceScopes, emptyShoppingPreferences, PreferenceScopesSchema } from "./preferenceScope";
import { safeLocalImagePath } from "./catalogueImages";

export const ShortcutSchema = z.strictObject({
  kind: z.enum(["cross_sell", "cheaper", "upsell"]),
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
  sizes_available: z.array(z.string().trim().min(1)).min(1),
  explanation: z.string().optional(),
  extra_target: z.string().nullable().optional(),
  image_src: z.string().refine(safeLocalImagePath, "Use a mapped local image.").nullable().optional(),
});
export type ChatProduct = z.infer<typeof ChatProductSchema>;
export const AlternativeProductSchema = ChatProductSchema.extend({
  differences: z.array(z.string().trim().min(1)).min(1),
});
export type AlternativeProduct = z.infer<typeof AlternativeProductSchema>;

const normalise = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
export const TurnReplySchema = z.object({
  status: z.enum(["matches", "partial", "alternatives", "no_match", "no_action", "needs_clarification", "no_upsell", "no_rule", "rule_unavailable", "primary_unavailable", "primary_mismatch"]),
  action: z.enum(["new_search", "refine", "cross_sell", "cheaper", "upsell", "clarify", "none"]),
  message: z.string().min(1),
  proposed_scopes: PreferenceScopesSchema,
  applied_preferences: ShoppingPreferencesSchema.nullable(),
  products: z.array(ChatProductSchema).max(4),
  alternatives: z.array(AlternativeProductSchema).max(4).default([]),
  alternatives_preferences: ShoppingPreferencesSchema.nullable().default(null),
  alternative_kind: z.enum(["context_difference", "colour_preview"]).nullable().default(null),
  optional_question: z.string().min(1).nullable().default(null),
  can_preview_other_colours: z.boolean().default(false),
  pending: PendingConversationSchema.nullable(),
}).superRefine((reply, ctx) => {
  const reject = (message: string) => ctx.addIssue({ code: "custom", message });
  const matches = reply.status === "matches" || reply.status === "partial";
  if (matches !== (reply.products.length > 0)) reject("Status and exact products disagree.");
  if (reply.status === "alternatives" && !reply.alternatives.length) reject("Alternatives status requires alternatives.");
  if (reply.alternatives.length && !["matches", "partial", "alternatives"].includes(reply.status)) reject("Alternatives cannot hide a blocking result.");
  const all = [...reply.products, ...reply.alternatives];
  if (all.length > 4 || new Set(all.map(p => p.product_id)).size !== all.length) reject("Return at most four unique displayed products.");
  if ((reply.status === "needs_clarification") !== (reply.pending !== null) && reply.status !== "no_action") reject("Missing or unexpected pending question.");
  if (all.length && !reply.applied_preferences) reject("Displayed products need applied preferences.");
  if (reply.optional_question && (!all.length || reply.pending)) reject("An optional question cannot be a blocking question.");

  function checkProducts(products: ChatProduct[], preferences: z.infer<typeof ShoppingPreferencesSchema> | null) {
    if (!products.length) return;
    if (!preferences) { reject("Products require explicit filter context."); return; }
    for (const product of products) {
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
  context: ConversationTurn["context"];
  history: ConversationTurn["history"];
};
export function newSession(): Session {
  return { scopes: createPreferenceScopes(), pending: null, context: { focused: null, latest: [] }, history: [] };
}
export function snapshot(product: {
  product_id: string; product_name: string; price_aud: number;
  category: ChatProduct["category"]; subcategory: string | null; product_type: string | null;
}): NonNullable<ConversationTurn["context"]["focused"]> {
  const { product_id, product_name, category, subcategory, product_type, price_aud } = product;
  return { product_id, product_name, category, subcategory, product_type, price_aud };
}
export function makeTurn(
  session: Session, message: string,
  focus: ConversationTurn["context"]["focused"] = null,
  shortcut?: z.infer<typeof ShortcutSchema>,
  previewOtherColours = false
): ConversationTurn {
  const scopes = PreferenceScopesSchema.parse(session.scopes);
  const known = [...session.context.latest, ...(session.context.focused ? [session.context.focused] : [])];
  if (focus && !known.some(p => p.product_id === focus.product_id) && !session.pending) {
    const savedSize = scopes.item.category === focus.category ? scopes.item.size : null;
    scopes.item = { ...emptyShoppingPreferences(), size: savedSize };
    scopes.unresolved_item = [];
  }
  return TurnSchema.parse({
    message, scopes, pending: shortcut ? null : session.pending,
    context: { focused: focus ?? session.context.focused, latest: session.context.latest },
    history: session.history.slice(-8), ...(shortcut ? { shortcut } : {}),
    ...(previewOtherColours ? { preview_other_colours: true } : {}),
  });
}
export function acceptReply(turn: ConversationTurn, input: unknown): { reply: TurnReply; session: Session } {
  const reply = TurnReplySchema.parse(input);
  if (reply.alternative_kind === "colour_preview" && turn.preview_other_colours !== true) {
    throw new Error("Colour alternatives require the explicit preview action.");
  }
  const visible = [...reply.products, ...reply.alternatives];
  const context = reply.pending || reply.status === "no_action"
    ? turn.context : { focused: null, latest: visible.map(snapshot) };
  const spoken = [reply.message, reply.optional_question].filter(Boolean).join("\n");
  const history: Session["history"] = [
    ...turn.history, { role: "user", content: turn.message },
    { role: "assistant", content: spoken.slice(0, 2000) },
  ];
  return { reply, session: {
    scopes: PreferenceScopesSchema.parse(reply.proposed_scopes), pending: reply.pending,
    context, history: history.slice(-8),
  } };
}