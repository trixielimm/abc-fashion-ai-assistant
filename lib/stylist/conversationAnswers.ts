import type { CatalogueProduct } from "../recommendations/catalogue";
import { STORE_POLICY_COPY } from "../storePolicies";
import type { AnswerIntent } from "./answerPlan";
import type { ConversationPlanRequest } from "./conversationPlan";
import { isValueComparisonQuestion, resolveProductReference, valueQuestionProducts } from "./productReference";
import { scoreCompatibility } from "../search/stylingCompatibility";
import { compareBenefits } from "../search/productBenefits";
import { getProductSpecification, specificationDetails } from "./productSpecifications";
import { relatedLabel } from "../search/preferenceSearch";
import { reviewSelectedOutfit } from "./outfitReview";

const normalise = (value: string | null | undefined) => (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const label = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2");
const money = (value: number) => `A$${value.toFixed(2)}`;
const policyTopics = new Set(["delivery", "returns", "payment"]);

export function resolveAnswerProducts(turn: ConversationPlanRequest, intent: AnswerIntent) {
  if (intent.kind === "outfit_review") return { ids: (turn.styling?.outfit ?? []).map(piece => piece.product_id), question: null };
  if (intent.kind === "policy") return { ids: [] as string[], question: null };
  if (!intent.continuation) {
    const value = valueQuestionProducts(turn.context, turn.message);
    if (value) return value;
  }
  const references = intent.references.length ? intent.references : [{ kind: "context" } as const];
  const ids: string[] = [];
  for (const reference of references) {
    const result = resolveProductReference(turn.context, reference);
    if (result.status !== "resolved") return { ids: [], question: result.message };
    if (!ids.includes(result.product_id)) ids.push(result.product_id);
  }
  if (intent.continuation && turn.context.comparison &&
      isValueComparisonQuestion(turn.pending_answer?.question ?? "") && !ids.includes(turn.context.comparison.product_id)) {
    ids.unshift(turn.context.comparison.product_id);
  }
  return intent.kind === "compare" && ids.length < 2
    ? { ids: [], question: "Which two products would you like me to compare? Use their names or positions in the results." }
    : { ids, question: null };
}

function policyAnswer(intent: AnswerIntent, question: string) {
  const paragraphs: string[] = [];
  if (intent.topics.includes("delivery")) {
    const deadline = question.match(/\bby\s+(?:(?:next|this)\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|tomorrow|tonight)\b/i)?.[0];
    paragraphs.push(`${STORE_POLICY_COPY.delivery} I can't confirm arrival ${deadline ?? "on a requested date"}: I don't have live delivery estimates, dispatch cut-offs or carrier information. I also can't confirm other destinations, express delivery or shipping fees from the available policy. A postcode alone won't let me calculate an arrival date yet.`);
  }
  if (intent.topics.includes("returns")) {
    paragraphs.push(`${STORE_POLICY_COPY.returns} The published copy doesn't specify item eligibility, return postage, exchanges or refund processing times, so I can't confirm those details.`);
  }
  if (intent.topics.includes("payment")) paragraphs.push("I don't have verified payment-method, discount or promotion information, so I can't confirm those details.");
  if (intent.kind === "policy" && !paragraphs.length) paragraphs.push("I don't have published policy information that answers that question. The available store copy only covers standard delivery across Australia and a 30-day returns window after delivery.");
  return paragraphs;
}

function productAnswer(product: CatalogueProduct, turn: ConversationPlanRequest, intent: AnswerIntent, catalogue: readonly CatalogueProduct[]) {
  const lines: string[] = [];
  const topics = new Set(intent.topics);
  const question = intent.continuation ? turn.pending_answer!.question : turn.message;
  const specification = getProductSpecification(product);
  if (topics.has("recommendation")) {
    const snapshot = [turn.context.focused, turn.context.comparison, ...turn.context.latest, ...(turn.context.previous?.flat() ?? []), ...(turn.context.selected ?? [])].find(row => row?.product_id === product.product_id);
    const recommendation = snapshot?.recommendation_context;
    const anchorIds = recommendation?.anchor_ids ?? turn.styling?.outfit.map(piece => piece.product_id) ?? [];
    const anchors = catalogue.filter(row => row.product_id !== product.product_id && anchorIds.includes(row.product_id ?? ""));
    if (anchors.length || turn.styling?.external_items.length) {
      const evidence = scoreCompatibility(product, anchors, intent.purpose, turn.styling?.external_items).evidence;
      lines.push(...evidence.reasons.slice(0, 3), ...evidence.limitations.slice(0, 2));
      lines.push("These pairing reasons are styling suggestions from recorded attributes; visual compatibility has not been verified.");
    }
    const primary = recommendation?.primary_product_id ? catalogue.find(row => row.product_id === recommendation.primary_product_id) : null;
    if (primary) {
      const comparison = compareBenefits(primary, product, turn.styling?.priorities ?? []);
      lines.push(...comparison.benefits.map(benefit => `${benefit.label}: ${String(benefit.before)} → ${String(benefit.after)}, recorded in ${benefit.evidence_kind === "synthetic" ? "the prototype product specifications" : "reviewed product sources"}.`), ...comparison.tradeoffs);
      if (!comparison.benefits.length) lines.push("I can't establish an additional feature benefit over the original from the current product records.");
      if (primary.price_aud !== null && product.price_aud !== null) lines.push(`Original price: ${money(primary.price_aud)}; this option: ${money(product.price_aud)}. A higher price alone does not establish quality.`);
    }
    const purpose = intent.purpose ?? turn.scopes.item.occasion ?? turn.scopes.shared.occasion;
    if (purpose) {
      const matches = product.occasion && (normalise(product.occasion) === normalise(purpose) || relatedLabel(label(product.occasion), purpose));
      lines.push(matches
        ? `For ${purpose}, the strongest recorded reason is that the catalogue explicitly lists ${label(product.occasion!)} as this item's occasion.`
        : `For ${purpose}, the occasion match is uncertain: ${product.occasion ? `the catalogue lists ${label(product.occasion)}` : "the catalogue doesn't record an occasion"}. I wouldn't call it a confirmed match for that event.`);
    } else if (product.occasion) lines.push(`The catalogue lists this item for ${label(product.occasion)}.`);
    const details = [product.colour && `colour: ${label(product.colour)}`, product.style && `style: ${label(product.style)}`, product.season && `season: ${label(product.season)}`].filter(Boolean);
    if (details.length) lines.push(`Its recorded styling details are ${details.join(", ")}.`);
    const scopes = [turn.scopes.item, turn.scopes.shared];
    const budgets = scopes.map(scope => scope.max_price).filter((value): value is number => value !== null);
    if (product.price_aud !== null && Number.isFinite(product.price_aud) && budgets.length) {
      const budget = Math.min(...budgets);
      lines.push(product.price_aud <= budget
        ? `At ${money(product.price_aud)}, it is within your ${money(budget)} maximum.`
        : `At ${money(product.price_aud)}, it exceeds your saved ${money(budget)} maximum; that's a trade-off, not a full match.`);
    }
    const colours = scopes.flatMap(scope => scope.preferred_colours);
    if (colours.length && product.colour && colours.some(colour => normalise(colour) === normalise(product.colour))) lines.push("Its colour also matches your saved colour preference.");
    lines.push("Those are catalogue-based reasons; they don't establish comfort, fabric performance or how it will fit you.");
  }
  if (topics.has("material")) lines.push(product.material ? `The recorded material is ${label(product.material)}. A material label doesn't verify the full composition or certifications.` : "The material isn't recorded, so I can't verify its fabric or composition.");
  if (topics.has("fit")) lines.push(`${product.fit ? `The recorded fit is ${label(product.fit)}.` : "No fit information is recorded."} ${specification?.garment_length_cm ? `The sample garment length is ${specification.garment_length_cm} cm and varies by size. I don't have a verified size chart, so I can't confirm your size or guarantee fit.` : "I don't have garment measurements or a verified size chart, so I can't confirm your size, true-to-size fit or a fit guarantee."}`);
  if (topics.has("sizes")) lines.push(product.sizes_available?.length ? `Recorded sizes: ${product.sizes_available.join(", ")}. These are catalogue size labels; I can't convert them to body measurements or guarantee fit.` : "No sizes are recorded for this item.");
  if (topics.has("availability")) lines.push(product.is_available === true && product.stock_qty !== null && product.stock_qty > 0
    ? "The current catalogue marks this item as available. Stock isn't reserved, and I can't verify stock for an individual size."
    : product.is_available === false || product.stock_qty === 0 ? "The current catalogue marks this item as unavailable." : "I can't confirm availability from the current catalogue record.");
  if (topics.has("price")) lines.push(product.price_aud !== null && Number.isFinite(product.price_aud) ? `The recorded price is ${money(product.price_aud)}. Delivery charges and discounts aren't included in that figure.` : "No current price is recorded.");
  if (topics.has("care")) lines.push(specification ? `Care instructions: ${specification.care_instructions}` : "I don't have verified washing or care instructions for this item. Check its care label before choosing a cleaning method.");
  if (topics.has("quality")) lines.push("The catalogue doesn't verify comfort, breathability, durability, sustainability or manufacturing quality. I can't infer those claims from price, material or brand alone.");
  if (topics.has("general")) {
    if (specification) {
      const details = specificationDetails(specification);
      const patterns: Array<[RegExp, RegExp]> = [
        [/pockets?/i, /^Pockets:/], [/lin(?:ing|ed)/i, /^Lining:/], [/adjust|strap/i, /Adjustable straps:|Strap drop:/],
        [/zip|clos(?:ure|ing)|fasten/i, /Zip closure:|Fastening:/], [/capacity|litres?|liters?/i, /^Capacity:/],
        [/dimensions?|width|depth|height|large|big|measure|length/i, /Dimensions:|length:|height:/],
        [/heels?/i, /^Heel height:/], [/sole/i, /^Sole:/], [/compartments?/i, /^Compartments:/], [/hardware/i, /^Hardware:/],
      ];
      const wanted = patterns.filter(([pattern]) => pattern.test(question));
      const matching = details.filter(detail => wanted.some(([, pattern]) => pattern.test(detail)));
      if (wanted.length) lines.push(matching.length ? matching.join(" ") : "That detail is not specified for this product.");
      else if (/\b(?:tell me (?:more )?about|details|overview|difference|compare|construct)\b/i.test(question) || intent.kind === "compare") lines.push(specification.description, details.join(" "));
      else lines.push("The product specifications don't establish that detail. I can check construction, fastening, measurements, care or the listed features.");
    } else if (/\b(?:tell me (?:more )?about|details|overview|difference|compare)\b/i.test(question) || intent.kind === "compare") {
      const details = [product.product_type, product.colour, product.style, product.material, product.fit].filter((value): value is string => Boolean(value)).map(label);
      lines.push(details.length ? `Recorded details: ${details.join("; ")}.` : "No additional product details are recorded.");
    } else lines.push("I don't have verified catalogue information that answers that specific question. I can check the recorded price, material, fit, sizes, availability or occasion.");
  }
  return lines.length ? `${product.product_name}\n${lines.join(" ")}` : "";
}

// Answer text is assembled from authoritative records, never free-form model claims.
export function answerConversationQuestion(catalogue: readonly CatalogueProduct[], turn: ConversationPlanRequest, intent: AnswerIntent) {
  if (intent.kind === "outfit_review") return reviewSelectedOutfit(catalogue, turn, intent.purpose);
  const resolution = resolveAnswerProducts(turn, intent);
  const paragraphs = policyAnswer(intent, intent.continuation ? turn.pending_answer!.question : turn.message);
  const sources: Array<{ label: string; url: string }> = [];
  const pending = resolution.question ? {
    intent, question: intent.continuation ? turn.pending_answer!.question : turn.message,
    follow_up: intent.continuation ? turn.pending_answer?.follow_up ?? null : null,
  } : null;
  if (resolution.question) paragraphs.push(resolution.question);
  const products: CatalogueProduct[] = [];
  for (const id of resolution.ids) {
    const product = catalogue.find(row => row.product_id === id);
    const previous = [turn.context.focused, turn.context.comparison, ...turn.context.latest, ...(turn.context.previous?.flat() ?? []), ...(turn.context.selected ?? [])].find(row => row?.product_id === id);
    if (!product || !previous || normalise(product.product_name) !== normalise(previous.product_name) ||
        normalise(product.category) !== normalise(previous.category) || normalise(product.subcategory) !== normalise(previous.subcategory) ||
        normalise(product.product_type) !== normalise(previous.product_type)) {
      return {
        message: [...paragraphs, "I can't verify that product against the item you saw. Please refresh its product page or run the search again before relying on its details."].join("\n\n"),
        answer_sources: sources, answer_product_ids: [] as string[], pending_answer: null,
      };
    }
    products.push(product);
    sources.push({ label: `${product.product_name} — catalogue details`, url: `/products/${encodeURIComponent(id)}` });
  }
  for (const product of products) {
    const text = productAnswer(product, turn, intent, catalogue);
    if (text) paragraphs.push(text);
  }
  if (intent.kind === "compare" && products.length >= 2) {
    const [first, second] = products;
    if (first.price_aud !== null && second.price_aud !== null) {
      const difference = Math.abs(first.price_aud - second.price_aud);
      paragraphs.push(difference === 0 ? `Both are priced at ${money(first.price_aud)}.`
        : `${first.price_aud < second.price_aud ? first.product_name : second.product_name} costs ${money(difference)} less. A higher price alone doesn't establish better quality.`);
    }
    if (intent.topics.includes("general")) paragraphs.push("Choose using the recorded differences above and your occasion, budget and size needs. I can't establish a comfort or quality winner from these records.");
  }
  if (intent.topics.some(topic => policyTopics.has(topic))) {
    const source = turn.context.focused ?? turn.context.latest[0];
    if (source) sources.push({ label: "Published delivery and returns copy", url: `/products/${encodeURIComponent(source.product_id)}#delivery-returns` });
  }
  return {
    message: paragraphs.join("\n\n"), answer_sources: sources,
    answer_product_ids: products.map(product => product.product_id!),
    pending_answer: intent.kind === "policy" ? turn.pending_answer ?? null : pending,
  };
}
