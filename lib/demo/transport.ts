import { ChatRequestError } from "../ai/chatRequest";
import { emptyStylingState, COMMERCE_POLICY } from "../stylist/commerceSchema";
import { TurnReplySchema, snapshot, type ChatProduct, type ConversationTurn, type TurnEnvelope, type TurnReply } from "../stylist/conversationProtocol";
import { emptyShoppingPreferences } from "../stylist/preferenceScope";
import { demoChatProduct, getDemoProduct } from "./catalogue";
import { matchDemoChoice, normaliseDemoMessage, type DemoProgress, type DemoOccasion } from "./journey";

const dressPools: Record<DemoOccasion, string[]> = {
  beach: ["DEMO-P1178", "DEMO-P1219", "DEMO-P1162", "DEMO-P1284", "DEMO-P1004", "DEMO-P1021"],
  work: ["DEMO-P1235", "DEMO-P1284", "DEMO-P1040", "DEMO-P1219", "DEMO-P1004", "DEMO-P1021"],
};
const bagPools: Record<DemoOccasion, string[]> = {
  beach: ["DEMO-P1182", "DEMO-P1167"], work: ["DEMO-P1151", "DEMO-P1108"],
};
const money = (price: number) => `A$${price.toFixed(2)}`;
const occasionLabel = (occasion: DemoOccasion) => occasion === "beach" ? "beach wedding" : "work dinner";

function knownProducts(turn: ConversationTurn) {
  return [turn.context.focused, turn.context.comparison, ...turn.context.latest,
    ...(turn.context.complementary ?? []), ...(turn.context.previous?.flat() ?? []),
    ...(turn.context.selected ?? []), ...(turn.styling?.outfit ?? [])].filter(product => product != null);
}
function reference(turn: ConversationTurn) {
  const named = knownProducts(turn).find(product => normaliseDemoMessage(turn.message).includes(normaliseDemoMessage(product.product_name)));
  const id = turn.shortcut?.product_id ?? named?.product_id ??
    (/\bsecond\b/i.test(turn.message) ? turn.context.latest[1]?.product_id :
      /\bfirst\b/i.test(turn.message) ? turn.context.latest[0]?.product_id : turn.context.focused?.product_id ?? turn.context.latest[0]?.product_id);
  return id && knownProducts(turn).some(product => product.product_id === id) && getDemoProduct(id) ? demoChatProduct(id) : null;
}
function available(products: ChatProduct[], turn: ConversationTurn) {
  return products.filter(product => !turn.styling?.rejected_ids.includes(product.product_id));
}
function dresses(occasion: DemoOccasion, turn: ConversationTurn, preferences = turn.scopes.item) {
  return available(dressPools[occasion].map(demoChatProduct), turn).filter(product =>
    (preferences.max_price === null || product.price_aud <= preferences.max_price) &&
    (preferences.min_price === null || product.price_aud >= preferences.min_price) &&
    (!preferences.size || product.sizes_available.includes(preferences.size)) &&
    (!preferences.preferred_colours.length || preferences.preferred_colours.includes(product.colour ?? "")) &&
    !preferences.excluded_colours.includes(product.colour ?? ""));
}
function bags(anchor: ChatProduct, occasion: DemoOccasion, turn: ConversationTurn) {
  return available(bagPools[occasion].map(demoChatProduct), turn)
    .filter(product => !turn.cart_product_ids?.includes(product.product_id) && !turn.styling?.outfit.some(piece => piece.product_id === product.product_id))
    .map(product => ({ ...product, explanation: `${product.colour} adds a finishing touch for ${money(product.price_aud)}.`,
      pairing_evidence: { policy_version: COMMERCE_POLICY, anchor_ids: [anchor.product_id],
        reasons: [`A scripted styling suggestion for ${anchor.product_name}.`],
        limitations: ["Fit and visual compatibility should be checked together."], level: "limited" as const } }));
}
function finishingTouches(anchor: ChatProduct, occasion: DemoOccasion, turn: ConversationTurn) {
  if (turn.styling?.offers_paused || turn.styling?.owned_categories.includes("Bags")) return null;
  const products = bags(anchor, occasion, turn).slice(0, 2);
  if (!products.length) return null;
  const extras = products.reduce((sum, product) => sum + product.price_aud, 0);
  const ownership = turn.styling?.outfit.find(piece => piece.product_id === anchor.product_id)?.ownership ?? "example";
  const base = ownership === "owned" ? 0 : anchor.price_aud;
  return { anchor, anchor_ownership: ownership, combined_limit_aud: null,
    items: products.map(product => ({ product, preferences: { ...emptyShoppingPreferences(), category: "Bags" as const, max_price: 80 } })),
    base_total_aud: base, extras_total_aud: extras, total_aud: base + extras };
}

export type DemoResult = { reply: TurnReply; progress: DemoProgress; delayMs: number };

// Pure response generation. Nothing advances until the chat accepts the reply.
export function buildDemoReply(turn: ConversationTurn, current: DemoProgress): DemoResult {
  const progress = { ...current };
  const styling = structuredClone(turn.styling ?? emptyStylingState());
  const base = {
    status: "no_action", action: "none", products: [], applied_preferences: null,
    proposed_scopes: structuredClone(turn.scopes), pending: turn.pending ?? null,
    pending_answer: turn.pending_answer ?? null, styling, task: turn.task,
    message: "Choose one of the audience options below to continue this shopping journey.",
  };
  function result(overrides: Record<string, unknown>, delayMs = 800): DemoResult {
    return { reply: TurnReplySchema.parse({ ...base, ...overrides }), progress, delayMs };
  }
  const occasion = progress.occasion ?? "beach";
  const anchor = reference(turn);

  if (turn.offer_anchor_id) {
    const product = turn.context.latest.find(product => product.product_id === turn.offer_anchor_id);
    if (!product || !getDemoProduct(product.product_id)) return result({ intent_understood: false });
    return result({ offer_refresh: true, complementary_offer: finishingTouches(demoChatProduct(product.product_id), occasion, turn),
      message: `Finishing touches updated for ${product.product_name}.` }, 350);
  }

  if (turn.shortcut && ["keep", "own", "remove", "reject"].includes(turn.shortcut.kind)) {
    if (!anchor) return result({ intent_understood: false });
    const kind = turn.shortcut.kind;
    styling.outfit = styling.outfit.filter(piece => piece.product_id !== anchor.product_id);
    if (kind === "keep" || kind === "own") {
      if (styling.outfit.length >= 8) return result({ styling: turn.styling, message: "Your look already has eight pieces. Remove one before saving another." }, 300);
      styling.outfit.push({ ...snapshot(anchor), ownership: kind === "own" ? "owned" : "selected" });
    }
    if (kind === "reject") styling.rejected_ids = [...new Set([...styling.rejected_ids, anchor.product_id])].slice(-50);
    return result({ message: kind === "keep" ? `${anchor.product_name} saved to your look.`
      : kind === "own" ? `${anchor.product_name} marked as already owned.`
      : kind === "reject" ? `${anchor.product_name} will be skipped.` : `${anchor.product_name} removed from your look.` }, 300);
  }

  if (turn.preview_other_colours && progress.occasion) {
    const preferences = { ...turn.scopes.item, preferred_colours: [] };
    const alternatives = dresses(occasion, turn, preferences).filter(product => !turn.scopes.item.preferred_colours.includes(product.colour ?? "")).slice(0, 3);
    return alternatives.length ? result({ status: "alternatives", action: "refine", applied_preferences: turn.scopes.item,
      alternatives: alternatives.map(product => ({ ...product, differences: [`Colour: ${product.colour}, outside your saved lavender preference.`] })),
      alternatives_preferences: preferences, alternative_kind: "colour_preview",
      message: "Here are other colours as labelled alternatives. Your saved colour, occasion, size and budget stay unchanged." })
      : result({ message: "There are no other colours within your saved size and budget." });
  }

  const text = normaliseDemoMessage(turn.message);
  if (["no more extras", "stop suggesting extras", "resume extras", "resume extra suggestions"].includes(text)) {
    styling.offers_paused = !text.startsWith("resume");
    return result({ message: styling.offers_paused ? "Extra suggestions are paused. You can still ask for a matching item."
      : "Extra suggestions are enabled again." }, 300);
  }
  if (["review my outfit", "can you review my outfit", "review my look"].includes(text)) {
    if (!styling.outfit.length) return result({ message: "Save a piece to your look first, then ask me to review it." });
    return result({ status: "answered", answer_product_ids: styling.outfit.map(piece => piece.product_id),
      outfit_review: { works: `${styling.outfit.map(piece => piece.product_name).join(" and ")} form your saved look.`,
        considerations: `Selected purchases total ${money(styling.outfit.filter(piece => piece.ownership === "selected").reduce((sum, piece) => sum + (piece.price_aud ?? 0), 0))}. Owned items add no new cost.`,
        limitations: "Try the pieces together to check fit, comfort and visual compatibility." },
      message: "Here is a review of your saved look." });
  }

  const choice = matchDemoChoice(turn.message, progress);
  if (choice && !progress.occasion) {
    progress.occasion = choice.id as DemoOccasion;
    const preferences = { ...emptyShoppingPreferences(), gender: "Women" as const, category: "Clothing" as const,
      subcategory: "Dresses", occasion: progress.occasion === "beach" ? "Beach Wedding" : "Work Dinner", max_price: 200 };
    const products = dresses(progress.occasion, turn, preferences).slice(0, 3);
    const offer = !turn.task?.complementary_shown && !turn.task?.complementary_dismissed && products[0]
      ? finishingTouches(products[0], progress.occasion, turn) : null;
    return result({ status: products.length ? "matches" : "no_match", action: "new_search", products,
      proposed_scopes: { ...turn.scopes, item: preferences }, applied_preferences: preferences,
      task: turn.task ? { ...turn.task, complementary_shown: Boolean(offer) || turn.task.complementary_shown } : undefined,
      complementary_offer: offer,
      message: `Here are ${products.length} dress ideas for your ${occasionLabel(progress.occasion)}, all under A$200.${offer ? " I've included optional bags below, priced separately." : ""}` }, 1250);
  }
  if (choice && progress.occasion && !progress.refinement) {
    progress.refinement = choice.id as DemoProgress["refinement"];
    const preferences = { ...turn.scopes.item,
      ...(choice.id === "budget" ? { max_price: 150 } : choice.id === "colour" ? { preferred_colours: ["Lavender"] } : { size: "10" }) };
    const products = dresses(occasion, turn, preferences).slice(0, 3);
    const change = choice.id === "budget" ? "I've lowered your dress budget to A$150" : choice.id === "colour" ? "I've narrowed the options to lavender" : "I've filtered for size 10";
    return result({ status: products.length ? "matches" : "no_match", action: "refine", products,
      proposed_scopes: { ...turn.scopes, item: preferences }, applied_preferences: preferences,
      can_preview_other_colours: choice.id === "colour",
      message: `${change}, keeping your ${occasionLabel(occasion)} occasion${choice.id === "budget" ? "." : ` and ${money(preferences.max_price ?? 200)} budget.`} These are your updated options.` }, 900);
  }

  const operation = turn.shortcut?.kind ?? (choice && progress.refinement && !progress.followUp ? choice.id : null);
  if (operation && anchor && progress.occasion) {
    if (choice && progress.refinement && !progress.followUp) progress.followUp = choice.id as DemoProgress["followUp"];
    if (operation === "bag" || operation === "cross_sell") {
      const preferences = { ...emptyShoppingPreferences(), gender: "Women" as const, category: "Bags" as const, max_price: 80 };
      const products = bags(anchor, occasion, turn);
      return result({ status: products.length ? "matches" : "no_match", action: "cross_sell", products,
        proposed_scopes: { ...turn.scopes, item: preferences }, applied_preferences: preferences,
        message: products.length ? `These bags are styling suggestions for ${anchor.product_name}, each under A$80. Your dress budget is separate; the dress is ${money(anchor.price_aud)}.`
          : "You've already saved, added or skipped the available matching bags. Your look and cart are unchanged." }, 1100);
    }
    if (operation === "cheaper" || operation === "similar" || operation === "upsell") {
      const preferences = anchor.category === "Bags" ? { ...emptyShoppingPreferences(), category: "Bags" as const, max_price: 80 }
        : { ...emptyShoppingPreferences(), gender: "Women" as const, category: "Clothing" as const, subcategory: "Dresses",
          occasion: occasion === "beach" ? "Beach Wedding" : "Work Dinner", max_price: progress.refinement === "budget" ? 150 : 200,
          preferred_colours: progress.refinement === "colour" ? ["Lavender"] : [], size: progress.refinement === "size" ? "10" : null };
      const pool = anchor.category === "Bags" ? bags(anchor, occasion, turn) : dresses(occasion, turn, preferences);
      const products = pool.filter(product => product.product_id !== anchor.product_id &&
        (operation !== "cheaper" || product.price_aud < anchor.price_aud) &&
        (operation !== "upsell" || product.price_aud > anchor.price_aud)).slice(0, 3);
      return result({ status: products.length ? "matches" : operation === "upsell" ? "no_upsell" : "no_match",
        action: operation === "similar" ? "discover" : operation,
        products, proposed_scopes: { ...turn.scopes, item: preferences }, applied_preferences: preferences, comparison_reference_id: operation === "upsell" ? anchor.product_id : null,
        message: products.length ? operation === "cheaper"
          ? `These cost less than ${anchor.product_name} (${money(anchor.price_aud)}), while keeping your saved colour, size, occasion and budget.`
          : `Here are other options for ${anchor.product_name}, within your saved preferences.`
          : "There isn't another option within those limits in this selection. Your saved requirements are unchanged." }, 900);
    }
    if (operation === "compare") {
      const first = turn.context.latest[0] && demoChatProduct(turn.context.latest[0].product_id);
      const second = turn.context.latest[1] && demoChatProduct(turn.context.latest[1].product_id);
      if (!first || !second) { progress.followUp = current.followUp; return result({ intent_understood: false }); }
      const firstRecord = getDemoProduct(first.product_id)!;
      const secondRecord = getDemoProduct(second.product_id)!;
      return result({ status: "answered", answer_product_ids: [first.product_id, second.product_id],
        answer_sources: [first, second].map(product => ({ label: product.product_name, url: `/products/${product.product_id}` })),
        message: `${first.product_name}: ${money(first.price_aud)}, ${first.colour?.toLowerCase()}, ${firstRecord.material}, ${firstRecord.fit?.toLowerCase() ?? "standard"} fit.\n\n${second.product_name}: ${money(second.price_aud)}, ${second.colour?.toLowerCase()}, ${secondRecord.material}, ${secondRecord.fit?.toLowerCase() ?? "standard"} fit.\n\nThe price difference is ${money(Math.abs(first.price_aud - second.price_aud))}. Both stay within your saved requirements; choose the fabric and silhouette you prefer.` });
    }
    if (operation === "material") {
      const record = getDemoProduct(anchor.product_id)!;
      return result({ status: "answered", answer_product_ids: [anchor.product_id],
        answer_sources: [{ label: anchor.product_name, url: `/products/${anchor.product_id}` }],
        message: `${anchor.product_name} is listed as ${record.material ?? "material not specified"}.${record.fit ? ` Its recorded fit is ${record.fit.toLowerCase()}.` : ""} It costs ${money(anchor.price_aud)}. Check the garment care label before washing; fabric composition percentages aren't provided here.` });
    }
  }
  return result({ intent_understood: false,
    message: progress.followUp ? "Your audience journey is complete. Save a favourite to your look or add it to your bag. Use Reset demo to try another route."
      : "Choose one of the audience options below, or send its prepared prompt. Your saved preferences, look and cart are unchanged." });
}

export async function postDemoTurn(envelope: TurnEnvelope, progress: DemoProgress, options: { signal: AbortSignal; delayMs?: number }): Promise<DemoResult> {
  const response = buildDemoReply(envelope.turn, progress);
  await new Promise<void>((resolve, reject) => {
    if (options.signal.aborted) { reject(new ChatRequestError("cancelled")); return; }
    const cancel = () => { clearTimeout(timer); options.signal.removeEventListener("abort", cancel); reject(new ChatRequestError("cancelled")); };
    const timer = setTimeout(() => { options.signal.removeEventListener("abort", cancel); resolve(); }, options.delayMs ?? response.delayMs);
    options.signal.addEventListener("abort", cancel, { once: true });
  });
  return response;
}
