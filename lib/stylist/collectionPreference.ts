import { z } from "zod";
import { DiscoveryIntentSchema } from "./discovery";
import type { ShoppingPreferences } from "../ai/preferenceSchema";

export const CollectionChoiceSchema = z.enum(["Men", "Women", "Unisex", "All"]);
export const CollectionStateSchema = z.strictObject({
  choice: CollectionChoiceSchema.nullable(),
  // The current item's default must not become a session-wide preference.
  current: z.strictObject({
    choice: CollectionChoiceSchema,
    source: z.enum(["explicit", "category_default", "saved"]),
  }).nullable().optional(),
  checkpoint: z.strictObject({
    action: z.enum(["new_search", "refine", "discover"]),
    discovery_intent: DiscoveryIntentSchema.nullable(),
  }).nullable(),
});
export type CollectionState = z.infer<typeof CollectionStateSchema>;
export const emptyCollectionState = (): CollectionState => ({ choice: null, current: null, checkpoint: null });

export function shoppingTarget(message: string) {
  const starts = [...message.matchAll(/\b(?:show(?: me)?|find(?: me)?|i want|i need|looking for|browse|let['’]s (?:try|start with))\b/gi)]
    .filter(match => !/\bwhat(?: i(?:['’]m| am| was)?)?\s*$/i.test(message.slice(0, match.index)));
  // A trailing "show me options" is a call to act on the earlier brief, not
  // a new target that erases its collection, garment or recipient.
  const meaningful = starts.filter(match => !/^(?:show(?: me)?|find(?: me)?|browse)\s+(?:(?:some|any|the|a few|a few different) )?(?:options|ideas|matches|results)(?: (?:now|please|first))?[.!?\s]*$/i.test(message.slice(match.index)));
  return message.slice(meaningful.at(-1)?.index ?? 0)
    .split(/\b(?:to match|to go with|with my|for my|for (?:this|that)|accompany)\b/i)[0];
}

// An allowlist of product categories, not an inference about the customer.
// Keep this distinct from explicitCollection so defaults cannot acquire shared scope.
export const categoryCollectionDefaults = { Dresses: "Women", Skirts: "Women" } as const;
export function defaultCollectionCategory(preferences: ShoppingPreferences) {
  if (preferences.category !== "Clothing") return null;
  if (preferences.subcategory === "Dresses") return "Dresses" as const;
  if (preferences.subcategory === "Bottoms" && /\bskirt\b/i.test(preferences.product_type ?? "")) return "Skirts" as const;
  return null;
}
export function requestedClothing(message: string) {
  const target = shoppingTarget(message);
  const pattern = /\bdress[ -]+shirts?\b|\bdress[ -]+shoes?\b|\bdress(?:es)?\b|\bskirts?\b|\bshirts?\b|\b(?:trousers?|pants)\b|\bsuits?\b|\b(?:jackets?|blazers?)\b|\b(?:clothing|clothes)\b/gi;
  for (const match of target.matchAll(pattern)) {
    const before = target.slice(0, match.index);
    if (/\b(?:no|not|without|except|excluding|avoid|rather than|don['’]?t want|do not want)(?:\s+(?:a|an|any|more|red|blue|black|white|work|formal|casual|midi|maxi|mini|pleated)){0,4}\s*$/i.test(before)) continue;
    if (/\b(?:i|we|he|she|they)\s+(?:already\s+)?(?:own|owned|have|bought|wear)|\bmy\b.{0,25}\b(?:wears|owns)\b/i.test(before.replace(/\bhave no idea\b/gi, "")) &&
        !/\b(?:show|find|want|need|browse|looking for|try)\b/i.test(before)) continue;
    // A garment mentioned after the requested shoes/bag is an anchor, even
    // without the usual "to match my ..." wording.
    if (/\b(?:bags?|shoes?|necklaces?|accessories)\b/i.test(before)) return null;
    // Bare item phrases and tentative choices are searches. Questions about
    // an item and a dress used as a styling anchor are not target requests.
    const request = /\b(?:show|find|want|need|browse|looking for|try|start with|maybe|perhaps|buying|shopping)\b/i.test(before) ||
      /^(?:(?:a|an|some|the|new|work|formal|casual|midi|maxi|mini|pleated|black|blue|red|men['’]?s|women['’]?s|unisex)\s+)*$/i.test(before.trimStart());
    if (!request) continue;
    const word = match[0];
    const after = target.slice(match.index! + word.length);
    if (/^dress[ -]+shoes?/i.test(word)) return { category: "Shoes" as const, subcategory: null, evidence: word, target };
    if (/^dress(?:es)?$/i.test(word) && /^\s+(?:code|me|us|you|him|her|them|up|down|like)\b/i.test(after)) continue;
    const subcategory = /^dress[ -]+shirt|^shirts?/i.test(word) ? "Tops"
      : /^dress/i.test(word) ? "Dresses" : /^(?:skirt|trouser|pant)/i.test(word) ? "Bottoms"
      : /^suit/i.test(word) ? "Sets" : /^(?:jacket|blazer)/i.test(word) ? "Outerwear" : null;
    return { category: "Clothing" as const, subcategory, evidence: word, target };
  }
  return null;
}

export function categoryCollectionDefault(message: string, preferences: ShoppingPreferences, refining: boolean) {
  const item = requestedClothing(message);
  const family = defaultCollectionCategory(preferences);
  if (!item || !family || item.subcategory !== preferences.subcategory ||
      family === "Skirts" && !/^skirts?$/i.test(item.evidence)) return null;
  // "More dresses" refines the current collection; a new full dress request
  // (including a repeated one after no_match) establishes the category default.
  if (refining && /\b(?:more|other|similar|cheaper|lower[ -]priced|replacement|same)\b/i.test(item.target)) return null;
  return { choice: categoryCollectionDefaults[family], subcategory: family, evidence: item.evidence };
}

export function resolveCollection(input: {
  message: string; previous: CollectionState | undefined; before: ShoppingPreferences;
  preferences: ShoppingPreferences; newItem: boolean; allowDefault: boolean;
}) {
  const state = CollectionStateSchema.parse(input.previous ?? emptyCollectionState());
  if (state.current && (state.current.choice === "All" ? null : state.current.choice) !== input.before.gender) {
    // Cancellation can restore earlier scopes; never reuse provenance from
    // the cancelled item with that restored request.
    state.current = null;
  }
  const explicit = explicitCollection(input.message, Boolean(state.checkpoint));
  const sameItem = !input.newItem && (["category", "subcategory", "product_type"] as const)
    .every(field => input.before[field] === input.preferences[field]);
  const categoryDefault = input.allowDefault ? categoryCollectionDefault(input.message, input.preferences, sameItem) : null;
  if (explicit) state.choice = explicit.choice;
  // Migrate older sessions without promoting an item-level category default.
  else if (!state.choice && !state.current) state.choice = input.before.gender;
  state.current = explicit ? { choice: explicit.choice, source: "explicit" }
    : categoryDefault ? { choice: categoryDefault.choice, source: "category_default" }
    : sameItem && state.current ? state.current
    : state.choice ? { choice: state.choice, source: "saved" } : null;
  return { state, explicit, categoryDefault, choice: state.current?.choice ?? null };
}

// These words identify a requested collection, not the customer's identity.
// Bare "both"/"skip" only mean collections when answering our own question.
export function explicitCollection(message: string, answering = false): { choice: z.infer<typeof CollectionChoiceSchema>; evidence: string } | null {
  // A checkpoint reply may have its own clause before a new shopping verb.
  // Resolve that clause before shoppingTarget removes earlier clauses.
  if (answering) {
    const prefix = message.trim().match(/^(?:(?:I'd like|I would like|let['’]s browse)\s+)?((?:women|men)(?:['’]s|s)?(?:\s+(?:clothing|clothes|collection))?|ladies|unisex|both(?:\s+collections)?|all collections|either|no preference)(?=\s*(?:[,;.!?]|$)|\s+(?:are fine|is fine|please)\b)/i);
    if (prefix) return { choice: /both|all|either|no preference/i.test(prefix[1]) ? "All" as const
      : /women|ladies/i.test(prefix[1]) ? "Women" as const : /unisex/i.test(prefix[1]) ? "Unisex" as const : "Men" as const,
      evidence: prefix[0] };
    const firstClause = message.split(/[.!?;\n]/, 1)[0];
    if (!/\b(?:owned|own|owns|wear|wears|wife|husband|already have)\b/i.test(firstClause)) {
      const choice = explicitCollection(firstClause, false);
      if (choice) return choice;
    }
  }
  // Resolve the requested products, excluding an owned/matching garment or an
  // earlier direction. A product mentioned as an anchor is not a new filter.
  const target = shoppingTarget(message);
  const text = target.replace(/[’']/g, "");
  const positive = (pattern: RegExp) => [...target.matchAll(pattern)].filter(match =>
    !/\b(?:not|no|except|excluding|avoid|rather than|don['’]?t want|do not want)\s*$/i.test(target.slice(0, match.index)));
  const men = positive(/\b(?:men(?:['’]s|s)?(?:wear)?|male(?=\s+(?:clothing|clothes|wear)))\b/gi);
  const women = positive(/\b(?:women(?:['’]s|s)?(?:wear)?|female(?=\s+(?:clothing|clothes|wear))|ladies(?:wear)?)\b/gi);
  const unisex = positive(/\bunisex\b/gi);
  const all = text.match(/\b(?:both|all|any|either)\s+(?:(?:mens? and womens?|womens? and mens?)\s+)?(?:collections?|clothing|clothes|menswear and womenswear)\b|\bno (?:collection|gender) preference\b|\b(?:dresses|skirts)\s+from\s+(?:both|all|either)\s+collections\b/i)
    ?? (answering ? message.match(/^(?:both(?: collections)?|either|all|no preference)(?:[.!?;,]\s|$)/i) : null)
    ?? (answering ? text.match(/^(?:(?:id like|i want|show me|lets browse)\s+)?(?:both(?:\s*\/\s*no preference)?|either|all|any|anything|no preference|skip(?: this question)?|just (?:browsing|show me (?:some )?(?:ideas|options))|show me (?:a few different |some )?ideas|surprise me|i (?:dont|do not) (?:mind|know(?: what i (?:want|am looking for))?)|i have no idea(?: what i want)?|help me (?:choose|decide)|(?:im |i am )?(?:still )?not sure(?: what i want)?)(?:[.!?\s]*$|[,;])/i) : null);
  if (all || men.length && women.length) return { choice: "All" as const, evidence: target.slice(0, 250) };
  const found = women[0] ?? men[0] ?? unisex[0];
  if (!found) return null;
  return { choice: women.length ? "Women" as const : men.length ? "Men" as const : "Unisex" as const,
    evidence: found[0] };
}

export const collectionPresentation = {
  message: "Sure. Would you like men's clothing, women's clothing, or both?",
  suggestions: [
    { label: "Men's", message: "Men's, please." },
    { label: "Women's", message: "Women's, please." },
    { label: "Both / no preference", message: "Both collections, please." },
  ],
};
