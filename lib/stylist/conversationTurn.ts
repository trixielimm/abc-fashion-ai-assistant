import { z } from "zod";
import { checkConversationPlan, ConversationPlanRequestSchema, ConversationPlanSchema } from "./conversationPlan";
import { answerConversationQuestion, resolveAnswerProducts } from "./conversationAnswers";
import { TurnSchema, TurnReplySchema, type ConversationTurn } from "./conversationProtocol";
import { executeConversationSearch } from "./conversationSearch";
import { PreferenceScopesSchema } from "./preferenceScope";
import { presentShoppingResult } from "./shoppingPresentation";
import type { CatalogueProduct } from "../recommendations/catalogue";
import type { CataloguePreferenceValues } from "../catalogue/preferenceValues";
import { groundConversationPlan } from "./conversationGrounding";
import { valueQuestionProducts, messageProductReference } from "./productReference";
import { dressCodeFromMessage } from "./dressCode";
import { isOutfitReviewQuestion } from "./outfitReview";
import { discoveryPresentation, type DiscoveryIntent } from "./discovery";
import { collectionPresentation, explicitCollection, emptyCollectionState, defaultCollectionCategory } from "./collectionPreference";
import { simpleMatchingSet, statedCombinedBudget, confirmedBudgetRequest, requestedComponents } from "./combinedShoppingRequest";
import { prepareConversationTask, TaskStateSchema } from "./taskState";
import { issueMessage, confirmedColourChoice } from "./conversationIssues";
import { buildComplementaryOffer, refreshOfferSource } from "./proactiveCrossSell";

export function interpreterInput(input: unknown) {
  const turn = prepareConversationTask(TurnSchema.parse(input));
  const { shortcut, preview_other_colours, recovery, offer_anchor_id, ...request } = turn;
  void shortcut;
  void preview_other_colours;
  void recovery;
  void offer_anchor_id;
  return ConversationPlanRequestSchema.parse(request);
}
export function shortcutPlan(input: ConversationTurn): z.infer<typeof ConversationPlanSchema> | null {
  const turn = prepareConversationTask(input);
  if (turn.offer_anchor_id) return ConversationPlanSchema.parse({ action: "refine", intent_evidence: turn.message.slice(0, 250),
    reference: null, changes: [], question: null, continuation: false });
  // Explicit provisional consent with unchanged filters needs no reinterpretation.
  // A different colour/cap or any additional instruction still goes to the model.
  const provisional = turn.message.trim().match(/^Browse provisional options with ([^.!?]{1,120}) unverified\.(?:\s*Keep ([a-z]+(?: [a-z]+)?) and (?:A\$|\$)\s*(\d+(?:\.\d{1,2})?)\.?)?$/i);
  const unknowns = [...turn.scopes.unresolved_item, ...turn.scopes.unresolved_shared];
  const requirementName = (value: string) => value.toLowerCase().replace(/^(?:verified|confirmed)\s+/, "").replace(/\bwaterproofing\b/g, "waterproof").trim();
  const caps = [turn.scopes.item.max_price, turn.scopes.shared.max_price].filter((value): value is number => value !== null);
  const colours = turn.scopes.shared.preferred_colours.length ? turn.scopes.shared.preferred_colours : turn.scopes.item.preferred_colours;
  if (!turn.shortcut && !turn.pending_answer && provisional && turn.task?.preview_unverified && unknowns.length === 1 &&
      requirementName(unknowns[0]) === requirementName(provisional[1]) &&
      (!provisional[2] || colours.length === 1 && colours[0].toLowerCase() === provisional[2].toLowerCase() &&
        caps.length > 0 && Math.min(...caps) === Number(provisional[3]))) {
    return ConversationPlanSchema.parse({ action: "refine", intent_evidence: turn.message.slice(0, 250),
      reference: null, changes: [], question: null, continuation: false });
  }
  const confirmedBudget = turn.pending?.budget_confirmation ? confirmedBudgetRequest(turn.message, turn.pending.budget_confirmation) : null;
  if (!turn.shortcut && confirmedBudget) {
    return ConversationPlanSchema.parse({ action: "refine", intent_evidence: turn.message, reference: null,
      changes: [], question: null, continuation: false,
      outfit_request: confirmedBudget });
  }
  const colourChoice = confirmedColourChoice(turn.message, turn.task?.issues ?? []);
  if (colourChoice && new RegExp(`^(?:let['’]s try |try )?${colourChoice.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: instead| is fine|,? please)?[.!?]*$`, "i").test(turn.message.trim())) {
    return ConversationPlanSchema.parse({ action: "refine", intent_evidence: turn.message.slice(0, 250),
      changes: [], reference: null, question: null, continuation: false });
  }
  const named = [...new Map([...turn.context.latest, ...(turn.context.complementary ?? []), ...(turn.context.previous?.flat() ?? []), ...(turn.context.selected ?? [])]
    .filter(product => turn.message.toLowerCase().includes(product.product_name.toLowerCase())).map(product => [product.product_id, product])).values()];
  const totalQuestion = /\b(?:total|sum|altogether|combined (?:cost|price)|cost (?:together|in total)|what (?:would|will|do) I pay)\b/i.test(turn.message);
  const combinationQuestion = /\b(?:work|go)\b.{0,50}\b(?:together|with|outfit)|\b(?:one outfit|combination)\b/i.test(turn.message);
  if (!turn.shortcut && named.length && named.length <= 4 && (totalQuestion || combinationQuestion) &&
      !/\b(?:show|find|browse|looking for|keep|select|reject|add to (?:my )?cart)\b/i.test(turn.message)) {
    return ConversationPlanSchema.parse({ action: "none", intent_evidence: turn.message.slice(0, 250), changes: [], reference: null,
      question: null, continuation: false, answer: { kind: "combination", topics: [
        ...(totalQuestion ? ["total_price"] : []), ...(combinationQuestion ? ["recommendation"] : [])],
        references: [...new Set(named.map(product => product.product_name))].map(value => ({ kind: "name", value })), purpose: null, continuation: false } });
  }
  if (turn.recovery) {
    const target = turn.task?.issues.find(value => value.id === turn.recovery!.issue_id);
    if (turn.recovery.operation === "drop_requirement" && target?.code === "unverified_requirement" && typeof target.value === "string") {
      return ConversationPlanSchema.parse({ action: "refine", intent_evidence: turn.message.slice(0, 250), reference: null,
        changes: [{ scope: target.scope === "shared" ? "shared" : "item", field: "unresolved", operation: "remove", value: [target.value], evidence: turn.message.slice(0, 250) }], question: null, continuation: false });
    }
    if (turn.recovery.operation === "preview_unverified") return ConversationPlanSchema.parse({ action: "refine", intent_evidence: turn.message.slice(0, 250), reference: null, changes: [], question: null, continuation: false });
    if (turn.recovery.operation === "restart_task") return ConversationPlanSchema.parse({ action: "none", intent_evidence: turn.message.slice(0, 250), reference: null, changes: [], question: null, continuation: false });
  }
  const matchingSet = !turn.shortcut && !turn.preview_other_colours && !turn.pending_answer ? simpleMatchingSet(turn.message) : null;
  if (matchingSet) return groundConversationPlan(turn, ConversationPlanSchema.parse({
    action: "new_search", intent_evidence: turn.message.slice(0, 250), changes: [],
    reference: { kind: "context" }, question: null, continuation: false, outfit_request: matchingSet,
  }));
  if (turn.collection?.checkpoint && !turn.shortcut && !turn.pending && !turn.pending_answer) {
    const choice = explicitCollection(turn.message, true);
    const text = turn.message.trim().replace(/[’']/g, "").replace(/[,!.?]/g, "").replace(/\s+please$/i, "");
    const exact = /^(?:mens?(?:wear)?|womens?(?:wear)?|ladies|unisex)(?: (?:clothing|clothes|collection))?$/i.test(text) ||
      choice?.choice === "All" && /^(?:(?:show me|just show me|lets browse) )?(?:both(?: collections|\s*\/\s*no preference)?|either|all(?: collections)?|any(?: collection)?|anything|no preference|skip(?: this question)?|just browsing|(?:some |a few different )?(?:ideas|options)|surprise me|i (?:dont|do not) (?:mind|know(?: what i (?:want|am looking for))?)|i have no idea(?: what i want)?|help me (?:choose|decide)|(?:im |i am )?(?:still )?not sure(?: what i want)?)$/i.test(text);
    if (choice && exact) {
      const checkpoint = turn.collection.checkpoint;
      const action = checkpoint.action === "discover" && !turn.scopes.item.category ? "discover" : "refine";
      return ConversationPlanSchema.parse({ action,
        discovery_intent: action === "discover" ? choice.choice === "All" && /skip|ideas|brows|surprise|dont|do not|not sure|no idea|help me/i.test(text)
          ? "browse" : checkpoint.discovery_intent ?? "browse" : null,
        intent_evidence: turn.message.slice(0, 250), reference: null, question: null, continuation: false,
        changes: [{ scope: "item", field: "gender", operation: "set", value: choice.choice === "All" ? null : choice.choice,
          evidence: choice.evidence }] });
    }
  }
  // Exact UI choices and simple uncertainty bypass the model. Compound requests
  // deliberately fall through so their constraints and questions are retained.
  if (!turn.shortcut && !turn.preview_other_colours && !turn.pending && !turn.pending_answer && !turn.styling?.outfit_request) {
    const text = turn.message.trim().replace(/[.!?]+$/, "").toLowerCase().replace(/[’']/g, "");
    const uncertain = text.replace(/^(?:i feel like buying something new|i want something new),? but /, "");
    let discoveryIntent: DiscoveryIntent | null = null;
    if (/^(?:i (?:dont|do not) know(?: (?:what i (?:am|was) looking for|what im looking for|what i want))?|i have no idea(?: what i want)?|(?:im |i am )?(?:still )?not sure(?: what i (?:want|am looking for))?|(?:i )?still (?:dont|do not) know|help me (?:choose|decide))$/.test(uncertain)) discoveryIntent = "start";
    if (/^(?:show me (?:a few different ideas|ideas|some ideas|a mix of everyday ideas)|just (?:browsing|show me some options)|surprise me|skip(?: this question)?)$/.test(text)) discoveryIntent = "browse";
    if (/^(?:something for )?everyday(?: wear)?$/.test(text)) discoveryIntent = "everyday";
    if (/^(?:something for )?an occasion$/.test(text)) discoveryIntent = "occasion";
    if (/^(?:none of these(?:[.,]? show me different ideas)?|show me different ideas|different ideas)$/.test(text)) discoveryIntent = "different";
    if (turn.discovery && /^(?:show me ideas for (?:work|relaxed weekends|a wedding guest|dinner)|work|relaxed weekends|a mix)$/.test(text)) discoveryIntent = "browse";
    if (discoveryIntent) {
      const everyday = turn.message.match(/everyday(?: wear)?|relaxed weekends/i);
      const work = turn.message.match(/\bwork\b/i);
      const dinner = turn.message.match(/\bdinner\b/i);
      return ConversationPlanSchema.parse({ action: "discover", discovery_intent: discoveryIntent,
        intent_evidence: turn.message.slice(0, 250), reference: null, question: null, continuation: false,
        changes: everyday || work || dinner ? [{ scope: "item", field: "occasion", operation: "set",
          value: everyday ? "Casual" : work ? "Work" : "Dinner", evidence: (everyday ?? work ?? dinner)![0] }] : [] });
    }
  }
  if (!turn.shortcut && !turn.preview_other_colours && isOutfitReviewQuestion(turn.message)) {
    return ConversationPlanSchema.parse({
      action: "none", intent_evidence: turn.message.slice(0, 250), reference: null, changes: [], question: null, continuation: false,
      answer: { kind: "outfit_review", topics: ["recommendation"], references: [], purpose: null, continuation: false },
    });
  }
  const dressCode = dressCodeFromMessage(turn.message);
  if (dressCode && turn.styling?.outfit_request && !turn.pending && !turn.pending_answer && !turn.shortcut) {
    return ConversationPlanSchema.parse({
      action: "refine", intent_evidence: turn.message, reference: null, changes: [], question: null, continuation: false,
      outfit_request: { ...turn.styling.outfit_request, evidence: turn.message },
    });
  }
  // This complete grammar contains only supported filters. Extra qualifiers
  // deliberately fall through to the interpreter instead of being discarded.
  const browseMore = !turn.shortcut && !turn.pending && !turn.pending_answer && !turn.styling?.outfit_request && turn.message.trim().match(
    /^(?:show|find)(?: me)? (?:other|more|similar) (dresses|bags|shoes|necklaces|accessories),?\s+(?:still|keeping) (black|white|blue|navy|red|pink|green|beige|brown|silver|gold|grey|gray|purple) and under (?:A?\$)\s*\d+(?:\.\d{1,2})?[.!]?$/i);
  if (browseMore) {
    const category = /dress/i.test(browseMore[1]) ? "Clothing" : /bag/i.test(browseMore[1]) ? "Bags"
      : /shoe/i.test(browseMore[1]) ? "Shoes" : "Accessories";
    return ConversationPlanSchema.parse({ action: turn.scopes.item.category === category ? "refine" : "new_search",
      intent_evidence: turn.message, reference: null, changes: [], question: null, continuation: false });
  }
  const valueProducts = !turn.shortcut && !turn.pending && !turn.pending_answer
    ? valueQuestionProducts(turn.context, turn.message) : null;
  if (valueProducts) return ConversationPlanSchema.parse({
    action: "none", intent_evidence: turn.message.slice(0, 250), reference: null, changes: [], question: null, continuation: false,
    answer: { kind: "compare", topics: ["price", "general", "recommendation"],
      references: valueProducts.ids.map(value => ({ kind: "id", value })), purpose: null, continuation: false },
  });
  const externalRemoval = turn.message.match(/^Remove the owned item I described as "(.+)"\.$/);
  const external = externalRemoval && turn.styling?.external_items.find(item => item.description === externalRemoval[1]);
  if (!turn.shortcut && external) {
    const { external_id, source, ...description } = external; void external_id; void source;
    return ConversationPlanSchema.parse({ action: "none", intent_evidence: turn.message.slice(0, 250),
      reference: null, changes: [], question: null, continuation: false,
      styling_intent: { preferences: [], outfit_changes: [], owned_categories: [], offers: null,
        external_items: [{ ...description, operation: "remove" }] } });
  }
  if (turn.preview_other_colours) {
    if (turn.shortcut || turn.pending) throw new Error("Resolve the pending request before a colour preview.");
    return ConversationPlanSchema.parse({
      action: "refine", intent_evidence: turn.message.slice(0, 200),
      reference: null, changes: [], question: null, continuation: false,
    });
  }
  if (turn.pending_answer && !turn.shortcut) {
    const text = turn.message.trim();
    const ordinal = text.match(/^(?:the\s+)?(first|second|third|fourth|fifth|[1-5])(?:\s+(dress|dresses|item|product|one))?[.!]?$/i);
    const known = [...turn.context.latest, ...(turn.context.complementary ?? []), ...(turn.context.previous?.flat() ?? []), ...(turn.context.focused ? [turn.context.focused] : [])];
    const named = known.find(product => product.product_name.toLowerCase() === text.toLowerCase() || product.product_id === text);
    const positions: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
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
  const known = [...turn.context.latest, ...(turn.context.complementary ?? []), ...(turn.context.previous?.flat() ?? []), ...(turn.context.focused ? [turn.context.focused] : []), ...(turn.context.comparison ? [turn.context.comparison] : []), ...(turn.context.selected ?? [])];
  if (!known.some(product => product.product_id === turn.shortcut!.product_id)) {
    throw new Error("The selected product is not in the current context.");
  }
  if (["keep", "own", "remove", "reject"].includes(turn.shortcut.kind)) return ConversationPlanSchema.parse({
    action: "none", intent_evidence: turn.message.slice(0, 200), reference: null, changes: [], question: null, continuation: false,
    styling_intent: { preferences: [], owned_categories: [], offers: null,
      outfit_changes: [{ operation: turn.shortcut.kind, reference: { kind: "id", value: turn.shortcut.product_id }, evidence: turn.message.slice(0, 200) }] },
  });
  return ConversationPlanSchema.parse({
    action: turn.shortcut.kind === "similar" ? "refine" : turn.shortcut.kind, intent_evidence: turn.message.slice(0, 200),
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
    discovery: turn.discovery ?? null,
    collection: turn.collection ?? emptyCollectionState(),
  });
  return TurnReplySchema.parse({
    status: "no_action", action: "none", products: [],
    message: turn.collection?.checkpoint ? "Cancelled that clothing request. Your saved preferences and cart are unchanged."
      : turn.pending ? "Cancelled that request. Your previous preferences are restored and your cart is unchanged."
      : "There is no pending question to cancel. Your preferences and cart are unchanged.",
    proposed_scopes: turn.pending?.before_scopes ?? turn.scopes,
    styling: turn.pending?.before_styling ? { ...turn.pending.before_styling, outfit: turn.styling?.outfit ?? turn.pending.before_styling.outfit } : turn.styling,
    discovery: turn.discovery ? { ...turn.discovery, stage: "complete" } : null,
    collection: { ...(turn.pending?.before_collection ?? turn.collection ?? emptyCollectionState()), checkpoint: null },
    task: { ...TaskStateSchema.parse(turn.task ?? {}), issues: [], blocker_repeats: 0, blocker_signature: "" },
    applied_preferences: null, pending: null,
  });
}

export function resumesAnswerSearch(input: unknown, output: unknown) {
  const turn = prepareConversationTask(TurnSchema.parse(input));
  const plan = groundConversationPlan(turn, ConversationPlanSchema.parse(output));
  return Boolean(plan.answer?.continuation && turn.pending_answer?.follow_up &&
    !resolveAnswerProducts(turn, plan.answer).question);
}

export function finishConversationTurn(
  catalogue: readonly CatalogueProduct[], input: unknown, output: unknown,
  vocabulary: CataloguePreferenceValues
): z.infer<typeof TurnReplySchema> {
  const turn = prepareConversationTask(TurnSchema.parse(input));
  if (turn.offer_anchor_id) {
    let offer = null;
    try {
      const source = refreshOfferSource(catalogue, turn, vocabulary);
      if (source) offer = buildComplementaryOffer(catalogue, turn, source, vocabulary, turn.offer_anchor_id);
    } catch { /* An optional preview failure cannot invalidate the primary search. */ }
    return TurnReplySchema.parse({ action: "none", status: "no_action", products: [], applied_preferences: null,
      proposed_scopes: turn.scopes, styling: turn.styling, pending: turn.pending ?? null,
      pending_answer: turn.pending_answer ?? null, collection: turn.collection, discovery: turn.discovery,
      task: turn.task, offer_refresh: true, complementary_offer: offer,
      message: offer ? `Finishing touches now pair with ${offer.anchor.product_name}.` : "No eligible finishing touches are available for that item within your saved requirements.",
      task_transition_applied: process.env.STYLIST_TASK_RECOVERY_ENABLED !== "false" });
  }
  const reply = finishPreparedConversationTurn(catalogue, turn, output, vocabulary);
  const task = TaskStateSchema.parse(reply.task ?? turn.task ?? {});
  const interpreted = ConversationPlanSchema.parse(output);
  if (interpreted.styling_intent?.offers?.paused === false && !reply.styling.offers_paused) {
    task.complementary_shown = false;
    task.complementary_dismissed = false;
  }
  let offer = null;
  try {
    if (!interpreted.answer) offer = buildComplementaryOffer(catalogue, { ...turn, task }, reply, vocabulary);
  } catch { /* Optional catalogue enrichment must not block requested products. */ }
  if (offer) task.complementary_shown = true;
  const paragraphs = reply.message.split("\n\n");
  if (offer) paragraphs[0] += ` I've also included optional finishing touches for ${offer.anchor.product_name} below.`;
  return TurnReplySchema.parse({ ...reply, message: paragraphs.join("\n\n"), task, complementary_offer: offer,
    task_transition_applied: process.env.STYLIST_TASK_RECOVERY_ENABLED !== "false" });
}

function finishPreparedConversationTurn(
  catalogue: readonly CatalogueProduct[], input: unknown, output: unknown,
  vocabulary: CataloguePreferenceValues
): z.infer<typeof TurnReplySchema> {
  const turn = prepareConversationTask(TurnSchema.parse(input));
  checkConversationPlan(interpreterInput(turn), output);
  const plan = groundConversationPlan(turn, ConversationPlanSchema.parse(output));
  const checked = checkConversationPlan(interpreterInput(turn), plan);
  if (plan.outfit_request && !turn.styling?.outfit_request && !turn.pending?.budget_confirmation &&
      requestedComponents(turn.message).size >= 2 && statedCombinedBudget(turn.message) === null &&
      !/\b(?:combined|total|together|both|each|per item|all of them|everything)\b/i.test(turn.message)) {
    const question = `Is A$${plan.outfit_request.total_budget_aud.toFixed(2)} the combined total for all ${plan.outfit_request.items.length} new pieces?`;
    return TurnReplySchema.parse({ status: "needs_clarification", action: "refine", message: question,
      products: [], applied_preferences: null, proposed_scopes: checked.proposed_scopes,
      styling: { ...checked.styling, outfit_request: null }, collection: checked.collection,
      pending: { action: "refine", reference: null, goal: turn.message, question,
        before_scopes: turn.scopes, before_styling: turn.styling, before_collection: turn.collection,
        budget_confirmation: plan.outfit_request },
      suggested_replies: [
        { label: "Yes, combined total", message: "Yes." },
        { label: "Budget is per item", message: `No, A$${plan.outfit_request.total_budget_aud.toFixed(2)} per item.` },
      ] });
  }
  if (turn.task?.brief.goal === "travel_layers" && turn.task.brief.total_budget_aud !== null && !checked.styling.outfit_request &&
      checked.collection.current && !checked.collection.checkpoint && plan.action === "discover" && !checked.issues.length) {
    return TurnReplySchema.parse({ action: "discover", status: "no_action", products: [], pending: null,
      proposed_scopes: checked.proposed_scopes, styling: checked.styling, collection: checked.collection,
      discovery: { ...(checked.discovery ?? { asked: [], skipped: [], seen_product_ids: [] }), stage: "components" },
      applied_preferences: null,
      message: `For a compact layered wardrobe, shall we start with a shirt and a removable jacket, or add trousers? Your A$${turn.task.brief.total_budget_aud.toFixed(2)} total stays saved. Warmth and comfort cannot be confirmed from catalogue labels.`,
      suggested_replies: [
        { label: "Jacket and shirt", message: "Find a jacket and shirt using my saved total budget." },
        { label: "Add trousers", message: "Find a jacket, shirt and trousers using my saved total budget." },
        { label: "Choose other pieces", message: "I want to choose different pieces for the travel wardrobe." },
      ] });
  }
  const compoundReference = turn.pending_answer?.follow_up && !plan.answer && plan.action !== "none"
    ? messageProductReference(turn.context, turn.message) : null;
  if (compoundReference?.status === "resolved") {
    // Validate the earlier draft using its own evidence, then apply the new
    // edits using the current evidence. Neither turn's constraints disappear.
    const draft = turn.pending_answer!;
    const restored = finishConversationTurn(catalogue, { ...turn, message: draft.question, pending_answer: null }, {
      ...draft.follow_up!, reference: compoundReference.reference, answer: null,
      intent_evidence: draft.question.slice(0, 250), question: null, continuation: false,
    }, vocabulary);
    return finishConversationTurn(catalogue, { ...turn, scopes: restored.proposed_scopes,
      styling: restored.styling, pending: null, pending_answer: null }, plan, vocabulary);
  }
  if (checked.status === "no_action" && checked.discovery && (plan.action === "discover" || checked.discovery.stage === "collection")) {
    const presentation = checked.discovery.stage === "collection" ? collectionPresentation : discoveryPresentation(checked.discovery);
    return TurnReplySchema.parse({ action: plan.action, status: "no_action", products: [],
      message: presentation.message, suggested_replies: presentation.suggestions,
      discovery: checked.discovery, proposed_scopes: checked.proposed_scopes,
      collection: checked.collection,
      styling: checked.styling, applied_preferences: null, pending: null });
  }
  if (resumesAnswerSearch(turn, plan)) {
    // Revalidate the saved changes against their original quoted message. The
    // latest short reply supplies only the product reference, never new filters.
    const pending = turn.pending_answer!;
    const answer = { ...plan.answer!, continuation: false };
    return finishConversationTurn(catalogue, {
      ...turn, message: pending.question, pending_answer: null,
    }, {
      ...pending.follow_up!, answer,
      reference: answer.compare_new_results ? null : pending.follow_up!.reference && pending.follow_up!.reference.kind !== "context"
        ? pending.follow_up!.reference
        : answer.references.length === 1 ? answer.references[0] : pending.follow_up!.reference,
      intent_evidence: pending.question.slice(0, 250), question: null, continuation: false,
    }, vocabulary);
  }
  const comparisonNeedsReference = plan.answer?.compare_new_results && resolveAnswerProducts(turn, plan.answer).question;
  let answer = plan.answer && (!plan.answer.compare_new_results || comparisonNeedsReference) ? answerConversationQuestion(catalogue, turn, plan.answer) : null;
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
      discovery: turn.discovery ?? null,
      collection: turn.collection ?? emptyCollectionState(),
    });
  }
  const result = executeConversationSearch(catalogue, interpreterInput(turn), plan, vocabulary);
  const presentation = presentShoppingResult(catalogue, turn, result, vocabulary);
  if (plan.answer?.compare_new_results && presentation.status !== "needs_clarification") {
    const anchor = resolveAnswerProducts(turn, plan.answer);
    const compared = [...presentation.products, ...presentation.alternatives].filter(product => !anchor.ids.includes(product.product_id)).slice(0, 3);
    if (compared.length && !anchor.question) {
      answer = answerConversationQuestion(catalogue, { ...turn, context: { ...turn.context,
        latest: compared.map(product => ({ product_id: product.product_id, product_name: product.product_name,
          category: product.category, subcategory: product.subcategory, product_type: product.product_type, price_aud: product.price_aud })),
        previous: [turn.context.latest, ...(turn.context.previous ?? [])].slice(0, 2),
      } }, { ...plan.answer, compare_new_results: false,
        references: [...anchor.ids, ...compared.map(product => product.product_id)].map(value => ({ kind: "id", value })) });
    }
  }
  const continuing = plan.continuation === true;
  const pending = plan.action === "clarify" && turn.pending ? turn.pending : presentation.status === "needs_clarification" ? {
    action: plan.action === "none" ? "clarify" : plan.action === "clarify" ? turn.pending?.action ?? "clarify" : plan.action,
    reference: plan.reference ?? (continuing ? turn.pending?.reference ?? null : null),
    goal: continuing ? turn.pending?.goal ?? turn.message : turn.message,
    question: presentation.message.slice(0, 4000),
    before_scopes: PreferenceScopesSchema.parse(continuing ? turn.pending?.before_scopes ?? turn.scopes : turn.scopes),
    before_styling: continuing ? turn.pending?.before_styling ?? turn.styling : turn.styling,
    before_collection: continuing ? turn.pending?.before_collection ?? turn.collection : turn.collection,
    ...(checked.styling_question ? { styling_question: true } : {}),
  } : result.status === "no_action" && !(turn.pending?.styling_question && plan.styling_intent?.outfit_changes.length) ? turn.pending ?? null : null;

  let message = result.status === "no_action"
    ? /\bkeep\b.{0,50}\b(?:limits?|budgets?|requirements?|restrictions?)\b/i.test(turn.message)
      ? "I've kept your stated limit and other saved requirements. No restrictions have been relaxed and no alternative colours or sizes have been selected."
      : plan.styling_intent ? result.message
      : /\b(add|cart|buy|purchase)\b/i.test(turn.message)
      ? "Use Add to cart on the product card. I'll ask for a size there only when needed. Your cart hasn't changed."
      : /^(?:thanks|thank you|cheers)[!. ]*$/i.test(turn.message.trim()) ? "You're welcome. I'm here if you'd like to compare these items or find something to go with them."
        : /^(?:hi|hello|hey)[!. ]*$/i.test(turn.message.trim()) ? "Hi! I can help you find items, explain a recommendation or compare products."
      : turn.pending ? `We still have this question: ${turn.pending.question}`
        : "Tell me what you'd like to find. I can help with catalogue products, but can't confirm unrecorded details or guarantee fit and delivery."
    : presentation.message;
  const stylingIntent = plan.styling_intent;
  const stylingChange = stylingIntent && (stylingIntent.preferences.length || stylingIntent.outfit_changes.length ||
    stylingIntent.external_items?.length || stylingIntent.owned_categories.length || stylingIntent.offers);
  const acknowledged = /^(?:hi|hello|hey|thanks|thank you|cheers)[!. ]*$/i.test(turn.message.trim()) ||
    /\b(?:cart|buy|purchase|keep\b.{0,50}\b(?:limits?|budgets?|requirements?|restrictions?))\b/i.test(turn.message);
  const understood = plan.action !== "clarify" && !(plan.action === "none" && !plan.answer && !stylingChange && !acknowledged && turn.recovery?.operation !== "restart_task");
  if (!understood && plan.action === "none") message = "I couldn't understand the change you'd like. Your saved preferences and previous product choices are still here. Could you rephrase it?";
  if (!understood && plan.action === "none" && /\b(?:system prompt|hidden (?:prompt|instructions)|api key|credentials)\b/i.test(turn.message)) {
    message = "I can help you shop the catalogue. I can't share private instructions or credentials, change recorded prices, or pretend an item was added to your bag.";
  }
  if (result.action === "cross_sell" && result.styling.external_items.length &&
      [...presentation.products, ...presentation.alternatives].length) {
    message = `Based on your description of ${result.styling.external_items.map(item => item.description).join(" and ")}, these are styling suggestions. I can't verify the exact shade, material or visual match of the item you own.\n\n${message}`;
  }
  if (checked.collection.current?.source === "category_default" && turn.scopes.item.gender === "Men" &&
      result.applied_preferences?.gender === "Women" && presentation.status !== "needs_clarification") {
    message = `I'll look in the women's ${defaultCollectionCategory(result.applied_preferences)?.toLowerCase() ?? "clothing"} collection for this request.\n\n${message}`;
  }
  const collectionAlternatives = presentation.status === "no_match" && result.applied_preferences?.gender === "Men" &&
    defaultCollectionCategory(result.applied_preferences) &&
    ["new_search", "refine"].includes(plan.action);
  const target = result.applied_preferences ? defaultCollectionCategory(result.applied_preferences)?.toLowerCase() : null;
  if (collectionAlternatives) {
    message = `I searched the men's ${target} collection. ${message}`;
  }
  const task = TaskStateSchema.parse(turn.task ?? {});
  const signature = result.issues.map(value => value.id).join("|").slice(0, 1000);
  task.blocker_repeats = signature ? task.blocker_signature === signature ? task.blocker_repeats + 1 : 1 : 0;
  task.blocker_signature = signature; task.issues = result.issues.slice(0, 12);
  if (result.issues.some(value => value.code === "interpretation_failed") && !message.startsWith("I couldn't reliably interpret that outfit request")) message = result.issues.map(issueMessage).filter(Boolean).join("\n\n");
  if (task.blocker_repeats >= 2) message += "\n\nWe're still blocked on the same detail. You can change that requirement or start a new shopping task below.";
  if (result.purchase_budget) {
    const budget = result.purchase_budget;
    message += `\n\nYour selected purchases count as A$${budget.fixed_total_aud.toFixed(2)} of the A$${budget.limit_aud.toFixed(2)} combined budget, leaving A$${budget.remaining_aud.toFixed(2)} for this addition.${budget.maximum_total_aud !== null ? ` The displayed choices bring the purchase total to A$${budget.minimum_total_aud!.toFixed(2)}${budget.maximum_total_aud !== budget.minimum_total_aud ? `–A$${budget.maximum_total_aud.toFixed(2)}` : ""}.` : ""} Delivery and discounts are not included.`;
  }
  const visible = [...presentation.products, ...presentation.alternatives];
  if (visible.length && turn.task?.brief.goal === "bolder_style" && plan.action === "discover") {
    const directions = visible.slice(0, 3).map(product => `${product.product_name}: try ${product.colour ?? "its recorded silhouette"}${product.category === "Accessories" ? " as a small accent" : product.category === "Shoes" ? " through footwear" : " as a focal piece"}.`);
    message += `\n\nWays to try a bolder direction:\n${directions.join("\n")} These are styling suggestions; check the exact colours and event dress code.`;
  }
  if (turn.task?.brief.goal === "flexible_fit" && visible.length) {
    message += "\n\nThese options use recorded fit labels. Stretch, adjustable-waist construction and future fit are not established by those labels. Your size remains unspecified unless you choose one.";
  }
  if (presentation.alternatives.length && result.applied_preferences?.occasion === "Work") {
    message += "\n\nWhy these are alternatives: " + presentation.alternatives.slice(0, 2)
      .map(product => `${product.product_name}: ${product.differences.slice(0, 2).join(" ")}`).join(" ");
  }
  if (turn.task?.brief.deadline && ["new_search", "refine", "discover", "cross_sell"].includes(plan.action)) {
    message += `\n\nYour deadline is ${turn.task.brief.deadline}. I can't confirm arrival for that deadline because live delivery estimates and dispatch cut-offs are unavailable.`;
  }
  return TurnReplySchema.parse({
    ...result, ...presentation,
    task,
    ...(collectionAlternatives ? { suggested_replies: [
      { label: `Browse women's ${target}`, message: `Show women's ${target}, keeping my other requirements.` },
      { label: "Browse both collections", message: `Show ${target} from both collections, keeping my other requirements.` },
    ] } : {}),
    collection: checked.collection,
    discovery: plan.action === "discover" ? {
      ...checked.discovery!, seen_product_ids: [...new Set([...(turn.discovery?.seen_product_ids ?? []),
        ...(plan.discovery_intent === "different" ? turn.context.latest.map(product => product.product_id) : []),
        ...presentation.products.map(product => product.product_id), ...presentation.alternatives.map(product => product.product_id)])].slice(-64),
    } : turn.discovery ? { ...turn.discovery, stage: understood && ["new_search", "refine", "cross_sell", "cheaper", "upsell"].includes(plan.action) ? "complete" : turn.discovery.stage } : null,
    intent_understood: understood,
    ...(!understood ? { proposed_scopes: turn.scopes, styling: turn.styling } : {}),
    ...(answer ? { answer_sources: answer.answer_sources, answer_product_ids: answer.answer_product_ids } : {}),
    message: answer ? `${answer.message}\n\n${message}` : message, pending,
    pending_answer: result.status === "no_action" ? turn.pending_answer ?? null : null,
  });
}
