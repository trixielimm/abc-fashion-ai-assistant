import { z } from "zod";
import type { CatalogueProduct } from "../recommendations/catalogue";
import type { ConversationPlanRequest } from "./conversationPlan";
import { dressCodes, meetsDressCode } from "./dressCode";
import { priceCents } from "./outfitBudgetSchema";
import { relatedLabel } from "../search/preferenceSearch";

export const OutfitReviewSchema = z.strictObject({
  works: z.string().min(1).max(4000),
  considerations: z.string().min(1).max(4000),
  limitations: z.string().min(1).max(4000),
});
export type OutfitReview = z.infer<typeof OutfitReviewSchema>;
export const outfitReviewSections = [
  { key: "works", title: "1. Things that work" },
  { key: "considerations", title: "2. Things to consider" },
  { key: "limitations", title: "3. Things I can’t assess" },
] as const;

// Exact, whole-message shortcuts for common review questions. Extra requests
// and event qualifiers go to the interpreter instead of being discarded.
export function isOutfitReviewQuestion(message: string) {
  const text = message.trim().toLowerCase().replace(/[()]/g, "").replace(/[?!.]+$/, "").trim();
  const outfit = "(?:(?:my|this|the) (?:(?:current|selected|saved) )?outfits?|my (?:current |selected )?(?:look|pieces|items))";
  return new RegExp(`^(?:is|are|does|do) ${outfit} (?:(?:a )?good(?: (?:combination|match))?|(?:look|looking) good|(?:go|work|look)(?: well| good)? together)$`).test(text) ||
    new RegExp(`^(?:(?:can|could|would) you (?:please )?)?(?:review|assess|rate|check) ${outfit}(?: please)?$`).test(text) ||
    new RegExp(`^what do you think (?:of|about) ${outfit}$`).test(text) ||
    /^(?:do|would) (?:the |my )?selected (?:outfit pieces|pieces|items) (?:go|work)(?: well)? together$/.test(text);
}

const norm = (value: string | null | undefined) => (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const human = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2");
const list = (values: string[]) => new Intl.ListFormat("en-AU", { style: "long", type: "conjunction" }).format(values);
const money = (cents: number) => `A$${(cents / 100).toFixed(2)}`;
const neutral = (value: string) => /^(black|white|cream|ivory|beige|nude|grey|gray|silver|gold|navy|taupe)$/i.test(value);
const paletteFamilies = [
  ["blue", "navy", "lavender", "purple", "lilac", "sage", "green", "silver"],
  ["pink", "blush", "rose", "red", "burgundy"],
  ["brown", "tan", "camel", "beige", "gold"],
];

export function reviewSelectedOutfit(catalogue: readonly CatalogueProduct[], turn: ConversationPlanRequest, purpose: string | null) {
  const selected = turn.styling?.outfit ?? [];
  const external = turn.styling?.external_items ?? [];
  if (!selected.length && !external.length) return {
    message: "Select the pieces you want me to review using ‘Select for outfit’, or describe the items you already own. I’ll then tell you what works, what to consider and what I can’t assess.",
    outfit_review: null, answer_sources: [], answer_product_ids: [], pending_answer: turn.pending_answer ?? null,
  };

  // A stored choice identifies the piece; only a current, matching catalogue
  // record supplies its facts. Never substitute unselected search results.
  const verified = selected.flatMap(piece => {
    const record = catalogue.find(row => row.product_id === piece.product_id);
    return record && (["product_name", "category", "subcategory", "product_type"] as const).every(key =>
      norm(record[key]) === norm(piece[key]))
      ? [{ piece, record }] : [];
  });
  const missing = selected.filter(piece => !verified.some(item => item.piece.product_id === piece.product_id));
  const pieces = [
    ...verified.map(({ record }) => ({ name: record.product_name!, category: record.category, subcategory: record.subcategory,
      product_type: record.product_type, colour: record.colour, occasion: record.occasion, style: record.style })),
    ...external.map(piece => ({ name: piece.description, category: piece.category, subcategory: piece.category === "Clothing" && /dress/i.test(piece.product_type ?? "") ? "Dresses" : null,
      product_type: piece.product_type, colour: piece.colour, occasion: piece.occasion, style: null })),
  ];
  const positives: string[] = [];
  const considerations: string[] = [];
  const names = list([...selected.map(piece => piece.product_name), ...external.map(piece => piece.description)]);
  const colours = pieces.map(piece => piece.colour);
  if (pieces.length >= 2 && colours.every((colour): colour is string => Boolean(colour))) {
    const labels = [...new Set(colours.map(human))];
    const matching = new Set(colours.map(norm)).size === 1;
    if (matching) positives.push(`The ${labels[0]} colour labels give the pieces a tonal direction, which I’d treat as a cohesive starting point.`);
    else if (colours.some(neutral)) positives.push(`The ${list(labels)} palette includes a neutral, which can help balance the other colours.`);
    else if (paletteFamilies.some(family => colours.every(colour => family.includes(colour.toLowerCase())))) {
      positives.push(`The recorded ${list(labels)} colours sit in a related palette; I’d see that as a promising combination.`);
    } else considerations.push(`The ${list(labels)} palette has stronger colour contrast. Decide whether you want that contrast or a more tonal finish.`);
  }
  const occasions = pieces.map(piece => piece.occasion);
  if (pieces.length >= 2 && occasions.every((occasion): occasion is string => Boolean(occasion))) {
    if (occasions.every(occasion => relatedLabel(human(occasion), human(occasions[0])))) {
      positives.push(`The pieces share the recorded ${human(occasions[0])} occasion, so their intended setting is consistent.`);
    } else considerations.push(`Their recorded occasions differ (${list([...new Set(occasions.map(human))])}); check that the whole look suits your event.`);
  }
  const dress = pieces.find(piece => piece.category === "Clothing" && /dress/i.test(piece.subcategory ?? piece.product_type ?? ""));
  const shoes = pieces.filter(piece => piece.category === "Shoes");
  if (dress && /maxi|gown/i.test(dress.product_type ?? "") && shoes.some(piece => /heel|pump|court/i.test(piece.product_type ?? ""))) {
    positives.push("The long dress silhouette and heels give the outfit a dressier direction.");
  }
  const event = purpose ?? turn.scopes.item.occasion ?? turn.scopes.shared.occasion;
  if (event) {
    const mismatches = pieces.filter(piece => piece.occasion && !relatedLabel(human(piece.occasion), event));
    if (mismatches.length) considerations.push(`${list(mismatches.map(piece => piece.name))} is not recorded for ${event}; I’d check the dress code before relying on that match.`);
  }
  const code = dressCodes.find(code => code.value === turn.styling?.dress_code);
  const outsideCode = code ? pieces.filter(piece => !meetsDressCode(piece, code.value)) : [];
  if (outsideCode.length) considerations.unshift(`${list(outsideCode.map(piece => piece.name))} falls outside the current ${code!.label} filter. Consider a different piece or dress code.`);
  const styles = [...new Set(pieces.flatMap(piece => piece.style ? [human(piece.style)] : []))];
  if (styles.length > 1) considerations.push(`The style labels differ (${list(styles)}). Mixing them can be intentional, but check the overall balance when you try the pieces together.`);
  if (shoes.some(piece => /heel/i.test(piece.product_type ?? ""))) considerations.push("Think about how much standing or walking the event involves before committing to the heels.");

  const toBuy = selected.filter(piece => piece.ownership === "selected");
  const priced = verified.filter(({ piece, record }) => piece.ownership === "selected" && typeof record.price_aud === "number" && Number.isFinite(record.price_aud));
  const total = priced.reduce((sum, { record }) => sum + priceCents(record.price_aud!), 0);
  const budget = turn.styling?.outfit_request?.total_budget_aud;
  if (toBuy.length && priced.length === toBuy.length && budget !== undefined) {
    const remaining = priceCents(budget) - total;
    if (remaining >= 0) positives.push(`The items to buy total ${money(total)}, leaving ${money(remaining)} of your ${money(priceCents(budget))} combined budget.`);
    else considerations.unshift(`The items to buy total ${money(total)}, which is ${money(-remaining)} over your ${money(priceCents(budget))} combined budget.`);
  } else if (priced.length !== toBuy.length) considerations.push("I can’t verify the full purchase total because some current prices are unavailable.");
  const unavailable = verified.filter(({ piece, record }) => piece.ownership === "selected" && (record.is_available === false || record.stock_qty === 0));
  if (priced.some(({ piece, record }) => piece.price_aud !== undefined && priceCents(piece.price_aud) !== priceCents(record.price_aud!))) {
    considerations.unshift("Some prices have changed since you selected these pieces; the budget check uses the current catalogue prices.");
  }
  if (unavailable.length) considerations.unshift(`${list(unavailable.map(({ piece }) => piece.product_name))} is currently marked unavailable; it may need replacing if you haven’t bought it.`);
  if (missing.length) considerations.unshift(`I couldn’t verify the current details of ${list(missing.map(piece => piece.product_name))}. Refresh those product details before relying on a full combination review.`);
  const count = selected.length + external.length;
  if (count < 2) {
    positives.unshift("Only one specific piece is selected, so I can’t assess a combination yet.");
    considerations.unshift("Select or describe at least one more piece so I can consider how the outfit works together.");
  }
  if (!positives.length) positives.push("I don’t have enough recorded detail to identify a clear strength in the combination yet; that doesn’t mean the pieces won’t work together.");
  if (!considerations.length) considerations.push("I don’t see an obvious conflict in the recorded details. Try the pieces together to check the exact shades, proportions and the event’s dress code.");

  const review = OutfitReviewSchema.parse({
    works: `Looking at your selected ${names}: ${missing.length ? "I can only assess the pieces whose details I could verify. " : ""}${positives.slice(0, 4).join(" ")}`,
    considerations: considerations.slice(0, 3).join(" "),
    limitations: "I can’t assess the weather or temperature at your event, your measurements and actual fit, comfort, or the exact shades and drape of these pieces together. Catalogue colour and season labels don’t establish those details." +
      (external.length ? " For the items you described, I’m relying on your description rather than verified product records." : "") +
      (missing.length ? " Some selected product details could not be verified, so this review is incomplete." : ""),
  });
  return {
    message: outfitReviewSections.map(section => `${section.title}\n${review[section.key]}`).join("\n\n"),
    outfit_review: review,
    answer_sources: verified.map(({ record }) => ({ label: `${record.product_name}: catalogue details`, url: `/products/${encodeURIComponent(record.product_id!)}` })),
    answer_product_ids: selected.map(piece => piece.product_id),
    pending_answer: turn.pending_answer ?? null,
  };
}
