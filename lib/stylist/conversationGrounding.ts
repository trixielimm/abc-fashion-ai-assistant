import type { z } from "zod";
import type { ConversationPlanRequest, ConversationPlanSchema } from "./conversationPlan";
import type { ConversationChangeSchema } from "./conversationChanges";
import { matchesRole, resolveProductReference } from "./productReference";

type Plan = z.infer<typeof ConversationPlanSchema>;
type Change = z.infer<typeof ConversationChangeSchema>;
const colours = "black|white|ivory|cream|blue|navy|red|pink|green|beige|brown|silver|gold|grey|gray|lavender|purple|yellow|orange|taupe";
const rolePattern = /\b(dresses|dress|bags|bag|shoes|shoe|necklaces|necklace|accessories|accessory|clothing)\b/i;

// Ground a few unambiguous shopping constraints in the customer's actual words.
// This is deliberately not a general language parser: unknown/compound requests
// still go through the interpreter and the existing fail-closed validation.
export function groundConversationPlan(request: ConversationPlanRequest, candidate: Plan): Plan {
  const plan = structuredClone(candidate);
  const message = request.message;
  const pause = message.match(/\b(?:no other items|no extras|no extra recommendations(?: after [^.]+)?|i only need (?:a |an )?(?:dress|shoes|necklace))\b/i);
  if (pause) {
    plan.styling_intent ??= { preferences: [], outfit_changes: [], owned_categories: [], offers: null };
    plan.styling_intent.offers = { paused: true, evidence: pause[0] };
  }
  if (request.styling?.external_items.length && /\b(?:work from|use (?:that|the|my))\b.{0,30}\bdescription\b/i.test(message)) {
    plan.action = "cross_sell"; plan.reference = null; plan.answer = null; plan.question = null;
    plan.changes = []; plan.continuation = false;
  }
  if (plan.action === "refine" && plan.reference?.kind === "context") plan.reference = null;
  if (plan.answer?.purpose && !plan.answer.continuation) {
    const purpose = plan.answer.purpose.match(/\b(?:beach wedding|wedding guest|smart casual|date night|everyday wear|wedding|work|casual|brunch|party|formal|travel)\b/i);
    if (purpose) plan.answer.purpose = purpose[0];
    else if (/^(?:extra cost|price difference|improve |gain |go with |match )/i.test(plan.answer.purpose)) plan.answer.purpose = null;
  }
  if (plan.answer && !plan.answer.continuation && plan.answer.kind !== "policy" &&
      /\b(?:material|made (?:of|from)|fabric|composition)\b/i.test(message) && !plan.answer.topics.includes("material")) {
    plan.answer.topics.push("material");
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
  const searching = ["new_search", "refine", "cheaper", "cross_sell", "upsell"].includes(plan.action);
  if (!searching) return plan;
  const shoppingStart = message.search(/\b(?:show(?: me)?|find(?: me)?|i want|i need|let['’]s (?:try|start with)|browse)\b/i);
  const shoppingBrief = shoppingStart >= 0 ? message.slice(shoppingStart) : message;
  const occasion = shoppingBrief.match(/\bfor\s+(?:(?:a|an|the)\s+)?(beach wedding|wedding guest|formal(?:\s+(?:events?|occasions?))?|work|everyday wear)\b/i);
  if (occasion && !/\b(?:not|except)\s*$/i.test(shoppingBrief.slice(0, occasion.index))) {
    const label = /^formal/i.test(occasion[1]) ? "Formal" : /^work/i.test(occasion[1]) ? "Work"
      : /^everyday/i.test(occasion[1]) ? "Casual" : /^beach/i.test(occasion[1]) ? "Beach Wedding" : "Wedding Guest";
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
  const role = brief.match(rolePattern);
  const category = role ? /dress|clothing/i.test(role[1]) ? "Clothing"
    : /bag/i.test(role[1]) ? "Bags" : /shoe/i.test(role[1]) ? "Shoes" : "Accessories" : null;
  const put = (change: Change) => {
    plan.changes = plan.changes.filter(old => old.scope !== change.scope || old.field !== change.field);
    plan.changes.push(change);
  };
  const scope = /\b(?:all items|every item|throughout|all recommendations)\b/i.test(brief) ? "shared" as const : "item" as const;

  // Same-role browsing/refinement retains unmentioned restrictions. A genuine
  // category change still starts a fresh item scope.
  if (plan.action === "new_search" && category && category === request.scopes.item.category &&
      !/\b(?:forget|start over|new search|reset)\b/i.test(message)) plan.action = "refine";
  const pairingStart = brief.search(/\b(?:to match|to go with|for my|for (?:this|that)|with my|accompany)\b/i);
  const explicitAddition = plan.action === "cross_sell" && role && (pairingStart < 0 || role.index! < pairingStart);
  if (category && role && (["new_search", "refine"].includes(plan.action) || explicitAddition)) {
    put({ scope: "item", field: "category", operation: "set", value: category, evidence: role[0] });
    if (/dress/i.test(role[1])) {
      put({ scope: "item", field: "subcategory", operation: "set", value: "Dresses", evidence: role[0] });
      plan.changes = plan.changes.filter(c => !(c.field === "product_type" && typeof c.value === "string" && /^dresses?$/i.test(c.value)));
    }
    if (/necklace/i.test(role[1])) {
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
  const size = brief.match(/\bsize\s+([\w./-]+)\b/i);
  if (size && !/^(?:yet|unknown|please|or|and)$/i.test(size[1])) {
    put({ scope: "item", field: "size", operation: "set", value: size[1], evidence: size[0] });
  }
  const maximum = brief.match(/\b(?:under|below|up to|at or below|maximum(?: is(?: now)?)?|max(?:imum)?(?: of)?|budget(?: is)?)\s*(?:A?\$)\s*(\d+(?:\.\d{1,2})?)/i)
    ?? brief.match(/(?:A?\$)\s*(\d+(?:\.\d{1,2})?)\s+(?:limit|maximum)/i);
  if (maximum && !/\b(?:total|combined|whole outfit|complete outfit)\b/i.test(message)) {
    put({ scope, field: "max_price", operation: "set", value: Number(maximum[1]), evidence: maximum[0] });
  }
  return plan;
}
