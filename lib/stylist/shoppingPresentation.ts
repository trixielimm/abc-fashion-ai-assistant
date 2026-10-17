import type { CatalogueProduct } from "../recommendations/catalogue";
import type { CataloguePreferenceValues } from "../catalogue/preferenceValues";
import { ShoppingPreferencesSchema, type ShoppingPreferences } from "../ai/preferenceSchema";
import { relatedLabel } from "../search/preferenceSearch";
import { searchWithValidatedPreferences } from "../search/validatedPreferenceSearch";
import type { executeConversationSearch } from "./conversationSearch";
import { ChatProductSchema, type AlternativeProduct, type ChatProduct, type ConversationTurn } from "./conversationProtocol";
import { catalogueImageSource } from "./catalogueImages";
import { friendlyShoppingMessage } from "./friendlyShoppingMessage";
import { outfitDiscoveryQuestions } from "./discoveryQuestions";

type SearchResult = ReturnType<typeof executeConversationSearch>;
const money = (value: number) => `A$${value.toFixed(2)}`;
const same = (a: string | null, b: string | null) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

function contextDifferences(record: CatalogueProduct, preferences: ShoppingPreferences): string[] {
  return (["occasion", "style", "fit", "season"] as const).flatMap(field => {
    const requested = preferences[field];
    if (!requested || relatedLabel(record[field], requested)) return [];
    const label = field[0].toUpperCase() + field.slice(1);
    return [record[field]
      ? `${label}: ${record[field]}; you requested ${requested}.`
      : `${label} is not recorded; I cannot verify ${requested}.`];
  });
}

function clarificationText(result: SearchResult, turn: ConversationTurn): string {
  const scopes = result.proposed_scopes;
  const unknown = [...scopes.unresolved_shared, ...scopes.unresolved_item];
  if (unknown.length) {
    return `I can't verify or apply this requirement with the catalogue information available: ${unknown.join("; ")}. I haven't ignored it. Please change or remove that part before I recommend products.`;
  }
  // Preserve a genuine model question. Never invent details in its place.
  if (result.action === "clarify") return result.message;
  if (/which|identify|more than one/i.test(result.message) && turn.context.latest.length > 1) {
    const choices = turn.context.latest.map((p, index) => `${index + 1}. ${p.product_name}`).join("; ");
    return `Which item do you mean? ${choices}`;
  }
  if (/changed|unavailable|missing|inconsistent/i.test(result.message) && result.reference_product_ids.length) {
    return "I need to refresh the referenced product details before comparing them. Please reopen the item or run the search again.";
  }
  if (/conflicts with saved shared restrictions/i.test(result.message)) {
    return "That change conflicts with a restriction you asked me to keep for all items. Which restriction would you like to change?";
  }
  if (/not recognised|not recognized|not supported|not applied|clarify these preferences/i.test(result.message)) {
    return "I couldn't verify one of those product details in the catalogue. Please rephrase that detail; I haven't changed your restrictions.";
  }
  return result.message;
}

export function presentShoppingResult(
  catalogue: readonly CatalogueProduct[],
  turn: ConversationTurn,
  result: SearchResult,
  vocabulary: CataloguePreferenceValues
) {
  const applied = result.applied_preferences;
  const scopes = result.proposed_scopes;
  const preview = turn.preview_other_colours === true;
  const unresolved = scopes.unresolved_item.length + scopes.unresolved_shared.length;
  const previewEligible = Boolean(
    applied && applied.category && applied.preferred_colours.length &&
    !scopes.shared.preferred_colours.length && !unresolved &&
    ["new_search", "refine"].includes(result.action) &&
    ["matches", "partial", "no_match"].includes(result.status)
  );

  function decorate(product: SearchResult["products"][number]): ChatProduct {
    const record = catalogue.find(row => row.product_id === product.product_id);
    if (!record) throw new Error("A displayed product is not in the catalogue.");
    const target = record.cross_sell_category?.trim() || null;
    const targets = vocabulary.categories.filter(row => same(row.subcategory ?? row.category, target));
    const unique = new Set(targets.map(row => JSON.stringify(row)));
    let explanation = product.explanation;
    if (result.action === "upsell" && applied && !product.value_comparison) {
      const primary = catalogue.find(row => row.product_id === result.reference_product_ids[0]);
      if (primary && typeof primary.price_aud === "number") {
        const added = (["occasion", "style", "fit", "season"] as const).flatMap(field => {
          const requested = applied[field];
          return requested && !relatedLabel(primary[field], requested) && relatedLabel(record[field], requested)
            ? [`${requested} ${field}`] : [];
        });
        if (added.length && product.price_aud > primary.price_aud) {
          explanation = `${money(product.price_aud - primary.price_aud)} more than the original. It also matches your ${added.join(" and ")} preference${added.length > 1 ? "s" : ""}.`;
        }
      }
    }
    return ChatProductSchema.parse({
      ...product, explanation,
      image_src: catalogueImageSource(record),
      extra_target: target && unique.size === 1 ? target : null,
    });
  }

  // These cards are components of one complete set, not interchangeable options.
  // Retrieval already checked every component's context and the combined price.
  if (result.styling.outfit_request && ["new_search", "refine"].includes(result.action) &&
      result.status !== "needs_clarification") {
    const questions = outfitDiscoveryQuestions(result.outfit_choices?.groups ?? [])
      .filter(({ question }) => !turn.history.some(entry => entry.role === "assistant" && entry.content.includes(question)))
      .slice(0, 2).map(({ question }) => question);
    return {
    status: result.status, message: result.message,
    products: result.products.map(decorate), alternatives: [],
    alternatives_preferences: null, alternative_kind: null,
    optional_question: result.products.length && questions.length ? `${questions.join(" ")} You can also keep browsing these options.` : null,
    can_preview_other_colours: false,
    };
  }

  const meetsSharedContext = (record: CatalogueProduct) =>
    (["occasion", "style", "fit", "season"] as const).every(field =>
      scopes.shared[field] === null || relatedLabel(record[field], scopes.shared[field]!));

   const products: ChatProduct[] = [];
  let alternatives: AlternativeProduct[] = [];
  let alternativePreferences: ShoppingPreferences | null = null;
  let alternativeKind: "context_difference" | "colour_preview" | null = null;

  if (preview && previewEligible && applied) {
    // A one-turn preview after an explicit click. Saved scopes never change.
    const filters = ShoppingPreferencesSchema.parse({ ...applied, preferred_colours: [] });
    const otherColours = catalogue.filter(row => meetsSharedContext(row) && row.colour &&
      !applied.preferred_colours.some(colour => relatedLabel(row.colour, colour)));
    const searched = searchWithValidatedPreferences(otherColours, filters, vocabulary);
    if (!searched.validation.needs_clarification) {
      alternatives = searched.result.products.map(product => {
        const record = otherColours.find(row => row.product_id === product.product_id)!;
        return {
          ...decorate(product),
          differences: [
            `Colour: ${record.colour}; your original request was ${applied.preferred_colours.join(" or ")}.`,
            ...contextDifferences(record, applied),
          ],
        };
      });
      if (alternatives.length) {
        alternativePreferences = filters;
        alternativeKind = "colour_preview";
      }
    }
  } else if (!preview && applied) {
    // Split existing soft-context matches; do not relax required filters.
    for (const product of result.products) {
      const record = catalogue.find(row => row.product_id === product.product_id);
      if (!record) throw new Error("Missing displayed catalogue record.");
      if (!meetsSharedContext(record)) continue;
      const card = decorate(product);
      const differences = contextDifferences(record, applied);
      if (product.pairing_evidence?.level === "limited") differences.push("Outfit compatibility has limited catalogue evidence; this is an available alternative.");
      if (differences.length) alternatives.push({ ...card, differences });
      else products.push(card);
    }
    if (alternatives.length) {
      alternativePreferences = ShoppingPreferencesSchema.parse(applied);
      alternativeKind = "context_difference";
    }
  }

  let status: SearchResult["status"] | "alternatives" = result.status;
  let message = result.message;
  if (products.length) {
    status = "matches";
    message = products.length === 1
      ? `I found ${products[0].product_name} for ${money(products[0].price_aud)}.`
      : `Here are ${products.length} options to consider.`;
    if (result.action === "cross_sell") {
      const primary = catalogue.find(row => row.product_id === result.reference_product_ids[0]);
      message = primary
        ? `Here ${products.length === 1 ? "is an option" : "are some options"} to consider with ${primary.product_name}.`
        : message;
    }
    if (result.action === "cheaper") {
      const prices = result.reference_product_ids.map(id => catalogue.find(row => row.product_id === id)?.price_aud);
      if (prices.length && prices.every((price): price is number => typeof price === "number")) {
        message = `Here ${products.length === 1 ? "is a lower-priced option" : "are some lower-priced options"}, below ${money(Math.min(...prices))}.`;
      }
    }
    if (result.action === "upsell") message = "These replacement comparisons have a demonstrated benefit. Price differences, evidence and trade-offs are shown on each card.";
    if (alternatives.length) message += " I've also included clearly labelled alternatives below.";
  } else if (alternatives.length) {
    status = "alternatives";
    message = preview
      ? "Here are the other colours you chose to explore. They are alternatives, not exact matches. Your saved colour request and other restrictions are unchanged."
      : "I couldn't find a full match for the requested occasion, style, fit or season. These alternatives keep the required filters; their differences are listed on each card.";
  } else if (!preview && result.products.length > 0) {
    status = "no_match";
    message = "I couldn't find a result that also meets the preferences you asked me to keep for every item. Those shared restrictions are unchanged.";
  } else if (preview && result.status !== "needs_clarification") {
    status = "no_match";
    message = previewEligible
      ? "I couldn't find another colour within the other restrictions you've kept. I haven't changed your saved preferences."
      : "I can't preview other colours while a shared colour rule or another unresolved requirement is in place. Your restrictions are unchanged.";
  } else if (result.status === "no_match") {
    message = result.styling.required_features.length ? result.message : result.action === "cheaper"
      ? "I couldn't find a lower-priced option that meets the preferences you've kept. I haven't raised your budget or changed your restrictions."
      : "I couldn't find an available product that meets those details right now. Your stated limits and exclusions are unchanged.";
  } else if (result.status === "no_upsell") {
    message = result.message;
  } else if (result.status === "no_rule" || result.status === "rule_unavailable") {
    message = result.message;
  } else if (result.status === "primary_unavailable" || result.status === "primary_mismatch") {
    message = "The original item is unavailable or no longer fits this request. Please refresh the product results before comparing.";
  } else if (result.status === "needs_clarification") {
    message = clarificationText(result, turn);
  }

  const question = "What occasion are you shopping for? You can also keep browsing these options.";
  const optionalQuestion = !preview && (products.length + alternatives.length) > 0 &&
    ["new_search", "refine"].includes(result.action) && applied?.category === "Clothing" && !applied.occasion &&
    !turn.history.some(entry => entry.content.includes("What occasion are you shopping for?"))
      ? question : null;

   const canPreviewOtherColours =
    !preview && result.status === "no_match" && previewEligible;

  return {
    status,
    message: friendlyShoppingMessage({
      hasReplacementPriority: result.styling.priorities.length > 0,
      status,
      action: result.action,
      baseMessage: message,
      products,
      alternatives,
      preferences: applied,
      references: result.reference_product_ids.flatMap((id) => {
        const product = catalogue.find((row) => row.product_id === id);

        return product
          ? [{
              product_name: product.product_name,
              price_aud: product.price_aud,
            }]
          : [];
      }),
      alternativeKind,
      canPreviewOtherColours,
      unresolved: [
        ...scopes.unresolved_shared,
        ...scopes.unresolved_item,
      ],
      hasOptionalQuestion: optionalQuestion !== null,
    }),
    products,
    alternatives,
    alternatives_preferences: alternativePreferences,
    alternative_kind: alternativeKind,
    optional_question: optionalQuestion,
    can_preview_other_colours: canPreviewOtherColours,
  };
}
