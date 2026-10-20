import type { z } from "zod";
import type { ConversationPlanRequest, ConversationPlanSchema } from "./conversationPlan";
import type { ConversationChangeSchema } from "./conversationChanges";
import { matchesRole, resolveProductReference, messageProductReference } from "./productReference";
import { explicitCollection, requestedClothing, shoppingTarget, defaultCollectionCategory } from "./collectionPreference";
import { simpleMatchingSet, requestedComponents, jacketPairingRequest, isJacket } from "./combinedShoppingRequest";
import { removedRequirements, taskReplacement, replacesOutfitRequest, isShoppingRequest } from "./taskState";
import { explicitDressCode } from "./dressCode";
import { explicitSizeEdit } from "./sizeEdit";
import { confirmedColourChoice, isRequirementInstruction } from "./conversationIssues";

type Plan = z.infer<typeof ConversationPlanSchema>;
type Change = z.infer<typeof ConversationChangeSchema>;
const colours = "black|white|ivory|cream|blue|navy|red|pink|green|beige|brown|silver|gold|grey|gray|lavender|purple|yellow|orange|taupe";
const rolePattern = /\b(dress(?:es)?(?![ -]+(?:shirts?|shoes?|code|me|us|up|down)\b)|skirts?|jackets?|blazers?|shirts?|trousers?|pants|bags?|shoes?|flats?|necklaces?|accessories|accessory|clothing|clothes)\b/i;

// Repair only known requirement paraphrases against explicit, literal words in
// this message. Arbitrary labels and every other evidence field still fail closed.
export function groundRequirementEvidence(message: string, candidate: Plan): Plan {
  const plan = structuredClone(candidate);
  const rules = [
    { label: /^(?:no polyester|without polyester|polyester[- ]free)$/i, quote: /\b(?:(?:no|without) polyester|polyester[- ]free)\b/i },
    { label: /^(?:no (?:elastic|elasticated)(?: waist(?:band)?)?|non[- ]elastic(?:ated)? waist(?:band)?)$/i, quote: /\bno (?:elastic|elasticated)(?: waist(?:band)?)?\b/i },
    { label: /^(?:full[- ]length(?: not cropped)?|not cropped|no cropped(?: length)?)$/i, quote: /\b(?:full[- ]length(?: not cropped)?|not cropped|no cropped(?: length)?)\b/i },
    { label: /^(?:high[- ]waist(?:ed)?)$/i, quote: /\bhigh[- ]waist(?:ed)?\b/i },
  ];
  plan.changes = plan.changes.flatMap(change => {
    if (change.field !== "unresolved" || change.operation !== "add" ||
        message.toLowerCase().includes(change.evidence.toLowerCase())) return [change];
    const quotes = change.value.map(label => rules.find(rule => rule.label.test(label.trim()))?.quote.exec(message)?.[0]);
    if (quotes.some(quote => !quote)) return [change];
    const starts = quotes.map(quote => message.toLowerCase().indexOf(quote!.toLowerCase()));
    const start = Math.min(...starts);
    const end = Math.max(...starts.map((position, index) => position + quotes[index]!.length));
    return [{ ...change, evidence: message.slice(start, end) }];
  });
  return plan;
}

// Ground a few unambiguous shopping constraints in the customer's actual words.
// This is deliberately not a general language parser: unknown/compound requests
// still go through the interpreter and the existing fail-closed validation.
export function groundConversationPlan(request: ConversationPlanRequest, candidate: Plan): Plan {
  const plan = structuredClone(candidate);
  const message = request.message;
  // Exhausted interpretation repair must remain fail-closed. In particular,
  // recognizing a task replacement does not verify its remaining constraints.
  if (plan.action === "clarify" && /^(?:Could you rephrase|I couldn't reliably interpret)/.test(plan.question ?? "")) return plan;
  const identity = messageProductReference(request.context, message);
  const colourChoice = confirmedColourChoice(message, request.task?.issues ?? []);
  if (colourChoice && ["new_search", "refine"].includes(plan.action)) {
    plan.changes = plan.changes.filter(change => change.field !== "preferred_colours");
    plan.changes.push({ scope: "item", field: "preferred_colours", operation: "set", value: [colourChoice.value], evidence: colourChoice.evidence });
  }
  // Descriptions guide the conversation; they are not literal catalogue labels.
  plan.changes = plan.changes.flatMap(change => {
    if (change.field === "preferred_colours" && Array.isArray(change.value)) {
      const values = change.value.filter(value => !/^(?:bright|bold|bolder|neutral colours?)$/i.test(value));
      return values.length || !change.value.length ? [{ ...change, value: values }] : [];
    }
    if (change.field === "fit" && /^(?:flexible|adjustable)$/i.test(String(change.value))) return [];
    if (change.field === "unresolved" && Array.isArray(change.value)) {
      const values = change.value.filter(value => !isRequirementInstruction(value));
      return values.length ? [{ ...change, value: values }] : [];
    }
    return [change];
  });
  if (plan.outfit_request) plan.outfit_request.items = plan.outfit_request.items.map(item =>
    item.category === "Clothing" && /^(?:jackets?|blazers?)$/i.test(item.subcategory ?? "")
      ? { ...item, subcategory: "Outerwear", product_type: item.product_type ?? "Jacket" } : item);
  const collectionReply = request.collection?.checkpoint ? explicitCollection(message, true) : null;
  const rejectedReferences = plan.styling_intent?.outfit_changes.filter(change => change.operation === "reject") ?? [];
  if (rejectedReferences.length) {
    const pool = [...request.context.latest, ...(request.context.previous?.flat() ?? [])];
    let brief = message;
    for (const change of rejectedReferences) {
      const resolved = resolveProductReference(request.context, change.reference);
      const product = resolved.status === "resolved" ? pool.find(row => row.product_id === resolved.product_id) : null;
      if (product) brief = brief.replace(new RegExp(product.product_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
    }
    const referenceFields = new Set(["product_type", "style", "material", "fit", "brand_line", "preferred_colours"]);
    plan.changes = plan.changes.filter(change => !referenceFields.has(change.field) || change.value === null ||
      (Array.isArray(change.value) ? change.value : [String(change.value)]).every(value => brief.toLowerCase().includes(value.toLowerCase())));
    if (plan.action === "refine" && !/\b(?:similar|more like)\b/i.test(brief)) plan.reference = null;
  }
  const searchAvailability = request.scopes.item.category && identity.status === "absent" &&
    /\b(?:any (?:eligible|matching|available)|any matches|anything (?:available|that matches)|whether any|do you have any matches)\b/i.test(message);
  if (searchAvailability && plan.answer?.topics.includes("availability")) {
    plan.action = "refine"; plan.answer = null; plan.reference = null; plan.question = null; plan.continuation = false;
  }
  if (collectionReply && plan.answer?.kind === "product" && identity.status === "absent" &&
      /\bfit (?:information|details|labels)|what.*\bfit\b/i.test(message)) {
    plan.action = request.collection!.checkpoint!.action === "discover" && !request.scopes.item.category ? "discover" : "refine";
    plan.discovery_intent = plan.action === "discover" ? request.collection!.checkpoint!.discovery_intent ?? "browse" : null;
    plan.answer = { kind: "guidance", topics: ["fit"], references: [], purpose: null, continuation: false };
    plan.reference = null; plan.question = null; plan.continuation = false;
  }
  const compoundEdit = /\b(?:under|below|cheaper|similar|more like|different colou?r|no (?:beige|yellow|black|white)|instead)\b/i.test(message);
  if (identity.status === "resolved") {
    if (plan.reference) plan.reference = identity.reference;
    if (plan.action === "none" && plan.answer?.kind === "product" && !plan.answer.continuation) plan.answer.references = [identity.reference];
    if (request.pending_answer && compoundEdit && !/\b(?:why|what|made of|material|wash|fit me)\b/i.test(message)) {
      plan.action = "refine"; plan.reference = identity.reference; plan.answer = null; plan.question = null; plan.continuation = false;
    }
  }
  if (identity.conflict && (plan.reference || plan.answer?.kind === "product")) {
    plan.action = "clarify"; plan.reference = null; plan.answer = null; plan.changes = [];
    plan.question = "The product name and position are ambiguous. Which product should I use?"; plan.continuation = false;
  }
  if (replacesOutfitRequest(message, Boolean(request.styling?.outfit_request)) && ["new_search", "refine", "cross_sell", "clarify"].includes(plan.action) && requestedClothing(message)) {
    plan.action = "new_search"; plan.outfit_request = null; plan.reference = null; plan.answer = null; plan.question = null; plan.continuation = false;
  }
  if (isShoppingRequest(message) && requestedClothing(message) && request.pending_answer && identity.status === "absent") {
    plan.answer = null; plan.continuation = false;
  }
  const allItems = /\b(?:shared|global|all (?:items|recommendations|future searches)|every item|throughout|for everything)\b/i.test(message);
  // A collection answer is remembered by collection.choice. It is not a hard
  // global restriction unless the customer explicitly asks for one.
  if (!allItems && request.collection?.checkpoint && explicitCollection(message, true)) {
    plan.changes = plan.changes.map(change => change.field === "gender" ? { ...change, scope: "item" } : change);
  }
  if (!allItems) plan.changes = plan.changes.map(change =>
    change.scope === "shared" && !["gender", "category", "subcategory", "product_type", "size", "unresolved"].includes(change.field) ? { ...change, scope: "item" } : change);
  const event = message.match(/\b(?:wedding(?: guest)?|cocktail|office|work)\b/i);
  if (event && !/\b(?:not|no)\s*$/i.test(message.slice(0, event.index))) {
    const mapped = explicitDressCode(message) === "wedding_guest" ? "Wedding Guest" : /cocktail/i.test(event[0]) ? "Formal" : /wedding/i.test(event[0]) ? "Wedding Guest" : "Work";
    plan.changes = plan.changes.map(change => change.field === "occasion" && /^(?:cocktail|office)$/i.test(String(change.value)) ? { ...change, value: mapped } : change);
    // An event supplies an occasion, not an additional hard style choice.
    plan.changes = plan.changes.filter(change => !(change.field === "style" && typeof change.value === "string" &&
      /\b(?:wedding|cocktail|office|work)\b/i.test(change.evidence) && !message.toLowerCase().includes(change.value.toLowerCase())));
    if (plan.outfit_request) plan.outfit_request.items = plan.outfit_request.items.map(item => ({ ...item,
      occasion: /^(?:cocktail|office)$/i.test(item.occasion ?? "") ? mapped : item.occasion }));
    // These are supported event contexts, not construction/certification facts.
    // Remove only a duplicated bare label, retaining compound unknowns.
    plan.changes = plan.changes.flatMap(change => {
      if (change.field !== "unresolved" || change.operation !== "add") return [change];
      const value = change.value.filter(label => !/^(?:cocktail(?: dress code)?|office(?: wear)?)$/i.test(label.trim()));
      return value.length ? [{ ...change, value }] : [];
    });
  }
  for (const scope of ["item", "shared"] as const) {
    if (scope === "shared" && !allItems) continue;
    const labels = request.scopes[scope === "item" ? "unresolved_item" : "unresolved_shared"];
    const removed = removedRequirements(message, labels);
    if (removed.length) {
      plan.changes = plan.changes.filter(change => !(change.scope === scope && change.field === "unresolved" && change.operation === "remove"));
      plan.changes.push({ scope, field: "unresolved", operation: "remove", value: removed, evidence: message.slice(0, 250) });
      if (plan.action === "clarify") { plan.action = "refine"; plan.question = null; plan.continuation = false; }
    }
  }
  const matchingSet = simpleMatchingSet(message);
  if (matchingSet && ["new_search", "refine", "cross_sell", "clarify"].includes(plan.action)) {
    plan.action = request.styling?.outfit_request ? "refine" : "new_search";
    plan.outfit_request = matchingSet; plan.discovery_intent = null;
    plan.question = null; plan.continuation = false;
    plan.changes = plan.changes.filter(change => !["category", "subcategory", "product_type", "size", "min_price", "max_price"].includes(change.field));
  }
  const components = requestedComponents(message);
  const savedTotal = request.task?.brief.total_budget_aud;
  if (request.task?.brief.goal === "travel_layers" && components.size >= 2 && savedTotal !== null && savedTotal !== undefined &&
      ["new_search", "refine", "discover", "clarify"].includes(plan.action) && !plan.outfit_request) {
    plan.action = "refine"; plan.discovery_intent = null; plan.reference = null; plan.answer = null;
    plan.question = null; plan.continuation = false;
    plan.outfit_request = { items: [...components.values()], total_budget_aud: savedTotal, evidence: message.slice(0, 250) };
    plan.changes = plan.changes.filter(change => !["category", "subcategory", "product_type", "min_price", "max_price"].includes(change.field));
  }
  const addition = message.match(/\b(?:show|find|need|want)(?: me)?\s+(?:(?:some|other|new|flat|black|formal|a|one|pair of)\s+)*(shoes?|flats?|bags?|necklaces?)\b/i)
    ?? (/\b(?:show|find|need|want)\b/i.test(message) ? message.match(/\b(?:one|a) pair of (shoes?|flats?)\b/i) : null);
  let savedAddition: { category: "Shoes" | "Bags" | "Accessories"; evidence: string } | null = null;
  if (addition && !taskReplacement(message) && /\b(?:keep|saved|selected|owned|already own|to go with|to match)\b/i.test(message)) {
    const saved = request.styling?.outfit ?? [];
    const named = saved.filter(piece => message.toLowerCase().includes(piece.product_name.toLowerCase()));
    const anchors = named.length ? named : saved.filter(piece => /\b(?:keep|saved|selected|owned|own)\b[^.!?]{0,50}\bdress\b/i.test(message) && piece.subcategory === "Dresses");
    if (anchors.length === 1 && ["new_search", "refine", "cross_sell", "clarify", "none"].includes(plan.action)) {
      plan.action = "cross_sell"; plan.reference = { kind: "id", value: anchors[0].product_id };
      plan.outfit_request = null; plan.answer = null; plan.question = null; plan.continuation = false;
      const category = /shoe|flat/i.test(addition[1]) ? "Shoes" : /bag/i.test(addition[1]) ? "Bags" : "Accessories";
      savedAddition = { category, evidence: addition[0] };
      plan.changes = plan.changes.filter(change => !["category", "subcategory", "product_type", "size"].includes(change.field));
      plan.changes.push({ scope: "item", field: "category", operation: "set", value: category, evidence: addition[0] });
      const flat = message.match(/\bflats?\b/i);
      if (category === "Shoes" && flat) plan.changes.push({ scope: "item", field: "product_type", operation: "set", value: "Flats", evidence: flat[0] });
    }
  }
  if (plan.outfit_request && jacketPairingRequest(message)) {
    const focused = request.context.focused;
    const candidates = [...request.context.latest, ...(request.context.selected ?? []), ...(request.context.previous?.flat() ?? [])].filter(isJacket);
    const ids = [...new Set(candidates.map(product => product.product_id))];
    if (!plan.reference || plan.reference.kind === "context") {
      plan.reference = focused && isJacket(focused) ? { kind: "id", value: focused.product_id }
        : ids.length === 1 ? { kind: "id", value: ids[0] } : { kind: "context" };
    }
  }
  // Discovery prompts are optional suggestions, not pending transactions.
  // A model may copy their question or mark a short reply as a continuation;
  // neither should prevent a clear search from proceeding through validation.
  if (request.discovery && !request.pending && ["new_search", "refine", "discover"].includes(plan.action)) {
    plan.continuation = false;
    plan.question = null;
  }
  const pause = message.match(/\b(?:no other items|no extras|no extra recommendations(?: after [^.]+)?|i only need (?:a |an )?(?:dress|shoes|necklace))\b/i);
  if (pause) {
    plan.styling_intent ??= { preferences: [], outfit_changes: [], owned_categories: [], offers: null };
    plan.styling_intent.offers = { paused: true, evidence: pause[0] };
  }
  if (request.styling?.external_items.length && /\b(?:work from|use (?:that|the|my))\b.{0,30}\bdescription\b/i.test(message)) {
    plan.action = "cross_sell"; plan.reference = null; plan.answer = null; plan.question = null;
    plan.changes = []; plan.continuation = false;
  }
  if (plan.action === "refine" && plan.reference?.kind === "context" && !plan.outfit_request) plan.reference = null;
  if (plan.answer?.purpose && !plan.answer.continuation) {
    const purpose = plan.answer.purpose.match(/\b(?:beach wedding|wedding guest|smart casual|date night|everyday wear|wedding|work|casual|brunch|party|formal|travel)\b/i);
    if (purpose) plan.answer.purpose = purpose[0];
    else if (/^(?:extra cost|price difference|improve |gain |go with |match )/i.test(plan.answer.purpose)) plan.answer.purpose = null;
  }
  if (plan.answer && !plan.answer.continuation && plan.answer.kind !== "policy" &&
      /\b(?:material|made (?:of|from)|fabric|composition)\b/i.test(message) && !plan.answer.topics.includes("material")) {
    plan.answer.topics.push("material");
  }
  if (plan.answer && !plan.answer.continuation && plan.answer.kind !== "policy") {
    for (const [pattern, topic] of [
      [/\b(?:wash|washable|care instructions|clean)\b/i, "care"],
      [/\b(?:waist|length|measurements?|construction)\b/i, "general"],
      [/\b(?:sizes? (?:listed|available)|is (?:XS|S|M|L|XL|[0-9]+) listed)\b/i, "sizes"],
    ] as const) if (pattern.test(message) && !plan.answer.topics.includes(topic)) plan.answer.topics.push(topic);
  }
  if (plan.action === "none" && plan.answer?.kind === "product" && !plan.answer.continuation && !/\b(?:compare|versus|difference)\b/i.test(message)) {
    const ordinal = message.match(/\b(first|second|third|fourth|fifth)\s+(dress(?:es)?|bags?|shoes?|necklaces?)\b/i);
    if (ordinal) {
      const position = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 }[ordinal[1].toLowerCase()]!;
      const resolved = resolveProductReference(request.context, { kind: "position", position, subcategory: ordinal[2] });
      const anchors = new Set(request.styling?.outfit.map(product => product.product_id));
      const onlyOwnedAnchors = plan.answer.topics.includes("recommendation") && !/\band\b/i.test(message) &&
        plan.answer.references.every(reference => {
          const product = resolveProductReference(request.context, reference);
          return product.status === "resolved" && (resolved.status === "resolved" && product.product_id === resolved.product_id || anchors.has(product.product_id));
        });
      if (resolved.status === "resolved" && (plan.answer.references.length <= 1 || onlyOwnedAnchors)) {
        plan.answer.references = [{ kind: "id", value: resolved.product_id }];
      }
    }
  }
  if (plan.answer?.kind === "product" && !plan.answer.continuation &&
      plan.answer.references.every(reference => reference.kind === "context")) {
    const roles = [...new Set([...message.matchAll(/\bthe\s+(dress|shoes?|bag|necklace)\b/gi)].map(match => match[1].toLowerCase()))];
    const matching = roles.length === 1 ? request.context.latest.filter(product => matchesRole(product, roles[0])) : [];
    if (matching.length === 1) plan.answer.references = [{ kind: "id", value: matching[0].product_id }];
  }
  const searching = ["new_search", "refine", "cheaper", "cross_sell", "upsell", "discover"].includes(plan.action);
  if (!searching) return plan;
  // Unknown physical requirements still need a label when the customer gives
  // browsing permission in the same sentence. Permission is not removal.
  for (const requirement of [
    { pattern: /\b(?:softness|soft|rough fabrics?)\b/i, label: "fabric softness", family: /soft|rough/i },
    { pattern: /\badjustable waist\b/i, label: "adjustable waist", family: /adjustable waist/i },
    { pattern: /\b(?:grass suitability|suit(?:ed to)? grass|shoes suited to grass)\b/i, label: "grass suitability", family: /grass/i },
  ]) {
    const match = message.match(requirement.pattern);
    if (!match) continue;
    const before = message.slice(0, match.index).split(/[.!?;]/).at(-1) ?? "";
    if (!/\b(?:show|browse|find|want|need|with|require|keep)\b[^.!?]{0,120}$/i.test(before) ||
        /\b(?:remove|drop|ignore|without|no longer)\b[^.!?]{0,60}$/i.test(before) ||
        /\b(?:is|does|whether)\b[^.!?]{0,35}$/i.test(before)) continue;
    const existing = [...request.scopes.unresolved_item, ...request.scopes.unresolved_shared,
      ...plan.changes.flatMap(change => change.field === "unresolved" && change.operation === "add" ? change.value : [])];
    if (!existing.some(label => requirement.family.test(label))) plan.changes.push({ scope: "item", field: "unresolved", operation: "add",
      value: [requirement.label], evidence: match[0] });
  }
  for (const [pattern, field] of [[/\b(?:any fit|drop (?:the )?fit restriction)\b/i, "fit"], [/\bany colou?r\b/i, "preferred_colours"]] as const) {
    const permission = message.match(pattern);
    if (!permission) continue;
    plan.changes = plan.changes.filter(change => !(change.scope === "item" && change.field === field));
    plan.changes.push(field === "fit" ? { scope: "item", field, operation: "set", value: null, evidence: permission[0] }
      : { scope: "item", field, operation: "set", value: [], evidence: permission[0] });
    if (plan.outfit_request) plan.outfit_request.items = plan.outfit_request.items.map(item => ({ ...item, [field]: field === "fit" ? null : [] }));
  }
  if (plan.action === "discover" && /\bweekends?\b/i.test(message)) {
    const evidence = message.match(/\bweekends?\b/i)![0];
    plan.changes = plan.changes.filter(change => change.field !== "occasion");
    plan.changes.push({ scope: "item", field: "occasion", operation: "set", value: "Casual", evidence });
  }
  const collection = explicitCollection(message, Boolean(request.collection?.checkpoint));
  if (request.collection?.checkpoint && collection && ["new_search", "refine", "discover"].includes(plan.action)) {
    // The saved scopes already contain the original brief. A collection answer
    // must not start a fresh item and erase that brief. A genuinely different
    // requested item can still take its ordinary new_search path below.
    const role = message.match(rolePattern);
    const differentItem = role && !/clothing|clothes/i.test(role[0]) &&
      !(/dress/i.test(role[0]) && request.scopes.item.subcategory === "Dresses");
    if (!differentItem) {
      const checkpoint = request.collection.checkpoint;
      plan.action = checkpoint.action === "discover" && !request.scopes.item.category ? "discover" : "refine";
      plan.discovery_intent = plan.action === "discover" ? plan.discovery_intent ?? checkpoint.discovery_intent ?? "browse" : null;
      plan.continuation = false; plan.question = null;
    }
  }
  const shoppingStart = message.search(/\b(?:show(?: me)?|find(?: me)?|i want|i need|let['’]s (?:try|start with)|browse)\b/i);
  const shoppingBrief = shoppingStart >= 0 ? message.slice(shoppingStart) : message;
  const occasion = shoppingBrief.match(/\bfor\s+(?:(?:a|an|the)\s+)?(beach wedding|wedding guest|formal(?:\s+(?:events?|occasions?))?|work|everyday wear)\b/i)
    ?? shoppingBrief.match(/\b(formal|work|office)\s+(?:dresses|shirts|clothes|clothing|wear)\b/i)
    ?? (plan.action === "discover" ? shoppingBrief.match(/\b(concert)\b/i) : null);
  if (occasion && !/\b(?:not|except)\s*$/i.test(shoppingBrief.slice(0, occasion.index))) {
    const label = /^formal/i.test(occasion[1]) ? "Formal" : /^(?:work|office)/i.test(occasion[1]) ? "Work"
      : /^concert/i.test(occasion[1]) ? "Concert" : /^everyday/i.test(occasion[1]) ? "Casual" : /^beach/i.test(occasion[1]) ? "Beach Wedding" : "Wedding Guest";
    const scope = /\b(?:all items|every item|all recommendations|globally)\b/i.test(message) ? "shared" : "item";
    plan.changes = plan.changes.filter(change => !(change.scope === scope && change.field === "occasion"));
    plan.changes.push({ scope, field: "occasion", operation: "set", value: label, evidence: occasion[1] });
  }
  // Component constraints are already explicit. Flattening a dress colour or
  // size onto the whole set would incorrectly filter its shoes as well.
  if (plan.outfit_request || request.styling?.outfit_request && plan.action === "refine") {
    if (plan.outfit_request && !request.pending) plan.continuation = false;
    const componentFields = new Set(["category", "subcategory", "product_type", "size", "material", "brand_line", "preferred_colours", "excluded_colours"]);
    if (plan.outfit_request) {
      const components = plan.outfit_request.items;
      // The same colour emitted in both the dress component and ordinary
      // changes would accidentally require blue shoes too. Keep the typed,
      // component-specific representation instead of broadening its scope.
      plan.changes = plan.changes.filter(change => !componentFields.has(change.field) ||
        change.field === "unresolved" || !components.some(component => {
          const value = component[change.field as keyof typeof component];
          return value !== null && (Array.isArray(value)
            ? Array.isArray(change.value) && change.operation !== "remove" && change.value.every(label => value.includes(label))
            : value === change.value);
        }));
      if (plan.action === "refine" && plan.styling_intent) {
        const products = [...request.context.latest, ...(request.context.previous?.flat() ?? [])];
        plan.styling_intent.outfit_changes = plan.styling_intent.outfit_changes.filter(change =>
          change.operation !== "keep" || /\b(?:first|second|third|fourth|fifth|[1-5])\b/i.test(change.evidence) ||
          products.some(product => change.evidence.toLowerCase().includes(product.product_name.toLowerCase())));
      }
    }
    if (!/\b(?:all items|every item|all recommendations|throughout|every search|globally)\b/i.test(message)) {
      const local = plan.changes.map(change => ({ ...change, scope: "item" as const }));
      plan.changes = [...new Map(local.map(change => [change.field, change])).values()];
    }
    return plan;
  }
  const featureNames: Record<string, NonNullable<Plan["styling_intent"]>["preferences"][number]["value"]> = {
    pockets: "pockets", lining: "lining", "adjustable strap": "adjustable_strap", "adjustable straps": "adjustable_strap",
    "zip closure": "zip_closure", "zipper closure": "zip_closure", "machine washable": "machine_washable", "machine wash care": "machine_washable",
  };
  const requirements = new Set(plan.styling_intent?.preferences.filter(change =>
    change.kind === "requirement" && change.operation === "add").map(change => change.value));
  // A typed supported requirement must not also be a blocking "unknown".
  // Retain unknown qualifiers such as "waterproof zip closure" and negations.
  plan.changes = plan.changes.flatMap(change => {
    if (change.field !== "unresolved" || change.operation !== "add") return [change];
    const value = change.value.filter(label => {
      const key = featureNames[label.toLowerCase().replace(/^an? /, "").trim()];
      return !key || !requirements.has(key);
    });
    return value.length ? [{ ...change, value }] : [];
  });

  // Exclude an owned item's description and discarded previous direction from
  // the target brief: "own a navy dress ... I want black shoes" filters shoes.
  const start = message.search(/\b(?:show(?: me)?|find(?: me)?|i want|i need|let['’]s (?:try|start with)|browse)\b/i);
  const brief = start >= 0 ? message.slice(start) : message;
  const clothing = savedAddition ? null : requestedClothing(message);
  const role = (savedAddition?.evidence ?? shoppingTarget(message)).match(rolePattern);
  const category = savedAddition?.category ?? clothing?.category ?? (role ? /dress|skirt|cloth|jacket|blazer|shirt|trouser|pant/i.test(role[1]) ? "Clothing"
    : /bag/i.test(role[1]) ? "Bags" : /shoe|flat/i.test(role[1]) ? "Shoes" : "Accessories" : null);
  const put = (change: Change) => {
    plan.changes = plan.changes.filter(old => old.scope !== change.scope || old.field !== change.field);
    plan.changes.push(change);
  };
  const material = brief.match(/\b(linen blend|cotton|polyester|viscose|linen|leather|wool|silk|nylon)\b/i);
  if (material && !rejectedReferences.length && (/\b(?:show|find|want|need|browse|looking for)\b/i.test(brief.slice(0, material.index)) ||
      material.index! < 15 && /\b(?:dress|shirt|trousers|is essential|is required|itself is essential)\b/i.test(brief.slice(material.index))) &&
      !/\b(?:no|not|without|avoid|exclude|excluding|don't want|do not want)(?:\s+any)?\s*$/i.test(brief.slice(0, material.index))) {
    put({ scope: "item", field: "material", operation: "set", value: material[1].replace(/\b\w/g, char => char.toUpperCase()), evidence: material[1] });
  }
  const scope = /\b(?:all items|every item|throughout|all recommendations)\b/i.test(brief) ? "shared" as const : "item" as const;

  // Same-role browsing/refinement retains unmentioned restrictions. A genuine
  // category change still starts a fresh item scope.
  if (plan.action === "new_search" && category && category === request.scopes.item.category &&
      !/\b(?:forget|start over|new search|reset)\b/i.test(message)) plan.action = "refine";
  if (plan.action === "new_search" && request.discovery && request.discovery.stage !== "complete" &&
      !request.scopes.item.category && !/\b(?:forget|start over|new search|reset)\b/i.test(message)) plan.action = "refine";
  const pairingStart = brief.search(/\b(?:to match|to go with|for my|for (?:this|that)|with my|accompany)\b/i);
  const explicitAddition = plan.action === "cross_sell" && role && (pairingStart < 0 || role.index! < pairingStart);
  if (category && (clothing || role) && (["new_search", "refine", "discover"].includes(plan.action) || explicitAddition)) {
    const evidence = clothing?.evidence ?? role![0];
    put({ scope: "item", field: "category", operation: "set", value: category, evidence });
    if (clothing?.subcategory && !/dress|skirt/i.test(clothing.evidence)) {
      put({ scope: "item", field: "subcategory", operation: "set", value: clothing.subcategory, evidence });
    }
    if (clothing?.subcategory === "Outerwear" && !plan.changes.some(change => change.field === "product_type")) {
      put({ scope: "item", field: "product_type", operation: "set", value: "Jacket", evidence });
    }
    const wideLeg = plan.changes.find(change => change.field === "fit" && typeof change.value === "string" && /wide[ -]?leg/i.test(change.value));
    if (wideLeg && clothing?.subcategory === "Bottoms") {
      plan.changes = plan.changes.filter(change => change !== wideLeg);
      put({ scope: "item", field: "product_type", operation: "set", value: "Wide-Leg Pants", evidence: wideLeg.evidence });
    }
    if (clothing && (clothing.subcategory === "Dresses" || /^skirts?$/i.test(clothing.evidence))) {
      put({ scope: "item", field: "subcategory", operation: "set", value: clothing.subcategory, evidence });
      plan.changes = plan.changes.filter(c => !(c.field === "product_type" && typeof c.value === "string" && /^dress(?:es)?$/i.test(c.value)));
      if (/^skirts?$/i.test(clothing.evidence) && !plan.changes.some(c => c.field === "product_type" && typeof c.value === "string" && /\bskirt\b/i.test(c.value))) {
        put({ scope: "item", field: "product_type", operation: "set", value: "Skirt", evidence });
      }
    }
    if (clothing && request.collection?.current?.source === "category_default" &&
        defaultCollectionCategory(request.scopes.item) !==
          (clothing.subcategory === "Dresses" ? "Dresses" : /^skirts?$/i.test(clothing.evidence) ? "Skirts" : null)) {
      // Switching away from a defaulted item cannot retain its old Dresses or
      // Skirts identity merely because both belong to Clothing.
      if (!plan.changes.some(c => c.scope === "item" && c.field === "subcategory")) {
        put({ scope: "item", field: "subcategory", operation: "set", value: null, evidence });
      }
      if (!plan.changes.some(c => c.scope === "item" && c.field === "product_type")) {
        put({ scope: "item", field: "product_type", operation: "set", value: null, evidence });
      }
    }
    if (role && /necklace/i.test(role[1])) {
      put({ scope: "item", field: "subcategory", operation: "set", value: "Jewellery", evidence: role[0] });
      put({ scope: "item", field: "product_type", operation: "set", value: "Necklace", evidence: role[0] });
    }
  }

  // Only positive colour constructions in the requested brief are repaired.
  // A colour in a question, exclusion, comparison anchor or owned description
  // must not become a new preference.
  const prefix = new RegExp(`\\b(${colours})\\s+(?:dresses?|bags?|shoes?|necklaces?|clothing)\\b`, "i");
  const edit = new RegExp(`\\b(?:try|keep|still|prefer)\\s+(${colours})\\b|\\b(${colours})\\s+instead of\\b`, "i");
  const match = brief.match(edit) ?? (plan.action === "upsell" ? null : brief.match(prefix));
  if (match && !/\b(?:no|not|without|exclude|avoid)\s*$/i.test(brief.slice(0, match.index))) {
    const value = match[1] ?? match[2];
    const canonical = value[0].toUpperCase() + value.slice(1).toLowerCase();
    put({ scope, field: "preferred_colours", operation: "set", value: [canonical], evidence: value });
    plan.changes = plan.changes.filter(c => !(["style", "material", "fit", "season"].includes(c.field) &&
      typeof c.value === "string" && new RegExp(`^(?:${colours})$`, "i").test(c.value)));
  }
  const size = explicitSizeEdit(message);
  if (size) {
    put({ scope: "item", field: "size", operation: "set", value: size.value, evidence: size.evidence });
  }
  const maximum = brief.match(/\b(?:under|below|up to|at or below|maximum(?: is(?: now)?)?|max(?:imum)?(?: of)?|budget(?: is)?)\s*(?:A?\$)\s*(\d+(?:\.\d{1,2})?)/i)
    ?? brief.match(/(?:A?\$)\s*(\d+(?:\.\d{1,2})?)\s+(?:limit|maximum)/i)
    ?? brief.match(/\b(?:under|below|up to|maximum(?: of)?|budget(?: is)?)\s+(\d+(?:\.\d{1,2})?)\s+(?:aud|australian dollars?)\b/i);
  const discardedCombinedSearch = taskReplacement(message) && requestedComponents(message).size === 1;
  if (maximum && (discardedCombinedSearch || !/\b(?:total|combined|whole outfit|complete outfit)\b/i.test(message))) {
    put({ scope, field: "max_price", operation: "set", value: Number(maximum[1]), evidence: maximum[0] });
  }
  return plan;
}
