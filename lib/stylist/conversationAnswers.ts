import { formatAud } from "@/lib/format-price";
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
import { CombinationSummarySchema } from "./answerPlan";
import { priceCents } from "./outfitBudgetSchema";
import { OutfitPieceSchema } from "./commerceSchema";

const normalise = (value: string | null | undefined) => (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const label = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2");
const policyTopics = new Set(["delivery", "returns", "payment"]);

export function resolveAnswerProducts(turn: ConversationPlanRequest, intent: AnswerIntent) {
  if (intent.kind === "outfit_review") return { ids: (turn.styling?.outfit ?? []).map(piece => piece.product_id), question: null };
  if (intent.kind === "policy" || intent.kind === "guidance") return { ids: [] as string[], question: null };
  if (!intent.continuation && intent.kind !== "combination") {
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
      if (primary.price_aud !== null && product.price_aud !== null) lines.push(`Original price: ${formatAud(primary.price_aud)}; this option: ${formatAud(product.price_aud)}. A higher price alone does not establish quality.`);
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
        ? `At ${formatAud(product.price_aud)}, it is within your ${formatAud(budget)} maximum.`
        : `At ${formatAud(product.price_aud)}, it exceeds your saved ${formatAud(budget)} maximum; that's a trade-off, not a full match.`);
    }
    const colours = scopes.flatMap(scope => scope.preferred_colours);
    if (colours.length && product.colour && colours.some(colour => normalise(colour) === normalise(product.colour))) lines.push("Its colour also matches your saved colour preference.");
    lines.push("Those are catalogue-based reasons; they don't establish comfort, fabric performance or how it will fit you.");
  }
  if (topics.has("material")) lines.push(product.material ? `The recorded material is ${label(product.material)}. A material label doesn't verify the full composition or certifications.` : "The material isn't recorded, so I can't verify its fabric or composition.");
  if (topics.has("fit")) lines.push(`${product.fit ? `The recorded fit is ${label(product.fit)}.` : "No fit information is recorded."} ${specification?.garment_length_cm ? "I don't have a verified size chart, so I can't confirm your size or guarantee fit." : "I don't have garment measurements or a verified size chart, so I can't confirm your size or guarantee fit."}`);
  if (/\b(?:waist|waistband)\b/i.test(question) && /stretch|elastic/i.test(question)) lines.push("Waist stretch or elasticated-waist construction is not recorded, so I can't confirm that detail.");
  if (topics.has("sizes")) lines.push(product.sizes_available?.length ? `Recorded sizes: ${product.sizes_available.join(", ")}. These are catalogue size labels; I can't convert them to body measurements or guarantee fit.` : "No sizes are recorded for this item.");
  if (topics.has("availability")) lines.push(product.is_available === true && product.stock_qty !== null && product.stock_qty > 0
    ? "The current catalogue marks this item as available. Stock isn't reserved, and I can't verify stock for an individual size."
    : product.is_available === false || product.stock_qty === 0 ? "The current catalogue marks this item as unavailable." : "I can't confirm availability from the current catalogue record.");
  if (topics.has("price")) lines.push(product.price_aud !== null && Number.isFinite(product.price_aud) ? `The recorded price is ${formatAud(product.price_aud)}. Delivery charges and discounts aren't included in that figure.` : "No current price is recorded.");
  if (topics.has("care")) lines.push(specification ? `Care instructions: ${specification.care_instructions}` : "I don't have verified washing or care instructions for this item. Check its care label before choosing a cleaning method.");
  if (topics.has("quality")) lines.push("The catalogue doesn't verify comfort, breathability, durability, sustainability or manufacturing quality. I can't infer those claims from price, material or brand alone.");
  if (topics.has("general")) {
    if (/\bwaterproof(?:ing)?\b/i.test(question)) lines.push("Waterproofing is not established by the available product records.");
    if (/\blaptop\b/i.test(question)) lines.push("Laptop fit is unverified. External bag dimensions do not establish usable internal space or whether your laptop fits.");
    if (specification) {
      const details = specificationDetails(specification).filter(detail => !/^Sample garment length:/.test(detail));
      const patterns: Array<[RegExp, RegExp, string]> = [
        [/pockets?/i, /^Pockets:/, "Pockets"], [/lin(?:ing|ed)/i, /^Lining:/, "Lining"], [/adjust|strap/i, /Adjustable straps:|Strap drop:/, "Strap details"],
        [/zip|clos(?:ure|ing)|fasten/i, /Zip closure:|Fastening:/, "Fastening"], [/capacity|litres?|liters?/i, /^Capacity:/, "Capacity"],
        [/dimensions?|width|depth|height|large|big|measure|length/i, /Dimensions:|length:|height:/, "Measurements"],
        [/heels?/i, /^Heel height:/, "Heel height"], [/sole/i, /^Sole:/, "Sole"], [/compartments?/i, /^Compartments:/, "Compartments"], [/hardware/i, /^Hardware:/, "Hardware"],
      ];
      const wanted = patterns.filter(([pattern]) => pattern.test(question));
      if (wanted.length) for (const [, pattern, name] of wanted) {
        const matching = details.filter(detail => pattern.test(detail));
        if (name === "Measurements" && specification.garment_length_cm !== null) continue;
        lines.push(matching.length ? matching.join(" ") : `${name}: not specified for this product.`);
      }
      else if (/\b(?:tell me (?:more )?about|details|overview|difference|compare|construct)\b/i.test(question) || intent.kind === "compare") lines.push(specification.description, details.join(" "));
      else lines.push("The product specifications don't establish that detail. I can check construction, fastening, measurements, care or the listed features.");
    } else if (/\b(?:tell me (?:more )?about|details|overview|difference|compare)\b/i.test(question) || intent.kind === "compare") {
      const details = [product.product_type, product.colour, product.style, product.material, product.fit].filter((value): value is string => Boolean(value)).map(label);
      lines.push(details.length ? `Recorded details: ${details.join("; ")}.` : "No additional product details are recorded.");
    } else lines.push("I don't have verified catalogue information that answers that specific question. I can check the recorded price, material, fit, sizes, availability or occasion.");
  }
  if (specification?.garment_length_cm && (topics.has("fit") || /length|measure|tall/i.test(question) || topics.has("general"))) {
    lines.push(`The sample garment length is ${specification.garment_length_cm} cm (varies by size).`);
  } else if (/\blength\b/i.test(question) && product.category === "Clothing") lines.push("Garment length is not recorded.");
  if (specification && (topics.has("care") || topics.has("general") || topics.has("fit") || /length|measure/i.test(question))) {
    lines.push("These construction, measurement or care details are synthetic prototype specifications, not manufacturer-verified facts. Check the real garment's label and measurements before relying on them.");
  }
  return lines.length ? `${product.product_name}\n${[...new Set(lines)].join(" ")}` : "";
}

// Answer text is assembled from authoritative records, never free-form model claims.
export function answerConversationQuestion(catalogue: readonly CatalogueProduct[], turn: ConversationPlanRequest, intent: AnswerIntent) {
  if (intent.kind === "guidance") return {
    message: "Fit labels describe a garment's cut, not how it will fit your body. I can show recorded fit and size labels, but they don't verify stretch, an adjustable waist, softness or future fit. Your size can remain unknown while you browse; unverified construction requirements stay labelled and need your permission for provisional browsing.",
    answer_sources: [], answer_product_ids: [], pending_answer: null,
  };
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
    sources.push({ label: `${product.product_name}: catalogue details`, url: `/products/${encodeURIComponent(id)}` });
  }
  if (intent.kind === "combination" && !pending) {
    const question = intent.continuation ? turn.pending_answer!.question : turn.message;
    const numberWords: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
      nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
      eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80,
      ninety: 90, hundred: 100, thousand: 1000, dozen: 12 };
    const numbers = Object.keys(numberWords).join("|");
    const items = products.map(product => {
      const escaped = product.product_name!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const quantity = question.match(new RegExp(`\\b(\\d+|${numbers})(?:[ -](${numbers}))?\\s+(?:(?:pairs? of |units? of |of )(?:the )?)?${escaped}`, "i"));
      const count = quantity ? (numberWords[quantity[1].toLowerCase()] ?? Number(quantity[1])) + (quantity[2] ? numberWords[quantity[2].toLowerCase()] : 0) : 1;
      return { product_id: product.product_id!, quantity: count, unit_price_aud: product.price_aud,
        owned: turn.styling?.outfit.some(piece => piece.product_id === product.product_id && piece.ownership === "owned") ?? false };
    });
    if (items.some(item => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) return {
      message: "Please choose a quantity between 1 and 20 for each named piece.", answer_sources: sources,
      answer_product_ids: products.map(product => product.product_id!), pending_answer: null,
    };
    const known = items.every(item => item.owned || typeof item.unit_price_aud === "number" && Number.isFinite(item.unit_price_aud));
    const total = known ? items.reduce((sum, item) => sum + (item.owned ? 0 : priceCents(item.unit_price_aud!) * item.quantity), 0) / 100 : null;
    const limit = turn.styling?.outfit_request?.total_budget_aud ?? turn.styling?.purchase_budget?.limit_aud ?? null;
    const summary = CombinationSummarySchema.parse({ items, purchase_total_aud: total, limit_aud: limit,
      remaining_aud: limit !== null && total !== null ? (priceCents(limit) - priceCents(total)) / 100 : null });
    const lines: string[] = [];
    if (intent.topics.includes("total_price") || intent.topics.includes("price")) {
      lines.push(...products.map((product, index) => `${product.product_name}${items[index].quantity > 1 ? ` × ${items[index].quantity}` : ""}: ${items[index].owned ? "already owned, A$0.00 new purchase cost" : product.price_aud === null ? "current price unavailable" : formatAud(product.price_aud * items[index].quantity)}`));
      lines.push(total === null ? "I can't verify the full purchase total because a current price is missing."
        : `The new purchase total is ${formatAud(total)}.${summary.remaining_aud === null ? "" : summary.remaining_aud >= 0
          ? ` That leaves ${formatAud(summary.remaining_aud)} of your ${formatAud(limit!)} combined budget.`
          : ` That is ${formatAud(-summary.remaining_aud)} over your ${formatAud(limit!)} combined budget.`} Delivery and discounts are not included.`);
      if (products.some(product => product.is_available === false || product.stock_qty === 0)) lines.push("At least one named piece is currently unavailable; the total does not establish availability.");
    }
    if (intent.topics.includes("recommendation")) {
      const external = (turn.styling?.external_items ?? []).filter(item => question.toLowerCase().includes(item.description.toLowerCase()) ||
        item.product_type && question.toLowerCase().includes(item.product_type.toLowerCase()));
      const review = reviewSelectedOutfit(catalogue, { ...turn, styling: { ...turn.styling!, external_items: external,
        outfit: products.map(product => OutfitPieceSchema.parse({ product_id: product.product_id!, product_name: product.product_name!, category: product.category,
          subcategory: product.subcategory, product_type: product.product_type, price_aud: product.price_aud ?? undefined,
          ownership: items.find(item => item.product_id === product.product_id)!.owned ? "owned" : "selected" })) } }, intent.purpose);
      lines.push(review.message.replace("Looking at your selected", "Looking at the named"));
    }
    return { message: lines.join("\n\n"), combination_summary: summary, answer_sources: sources,
      answer_product_ids: products.map(product => product.product_id!), pending_answer: null };
  }
  for (const product of products) {
    const text = productAnswer(product, turn, intent, catalogue);
    if (text) paragraphs.push(text);
  }
  if (intent.kind === "compare" && products.length >= 2) {
    const [first, second] = products;
    if (first.price_aud !== null && second.price_aud !== null) {
      const difference = Math.abs(first.price_aud - second.price_aud);
      paragraphs.push(difference === 0 ? `Both are priced at ${formatAud(first.price_aud)}.`
        : `${first.price_aud < second.price_aud ? first.product_name : second.product_name} costs ${formatAud(difference)} less. A higher price alone doesn't establish better quality.`);
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
