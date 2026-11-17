import { formatAud } from "../format-price";
import type { ShoppingPreferences } from "../ai/preferenceSchema";
import type { CatalogueProduct } from "../recommendations/catalogue";
import { relatedLabel, searchByPreferences, type PreferenceSearchOptions } from "./preferenceSearch";

export function shoppingRequestLabel(preferences: ShoppingPreferences) {
  return [preferences.preferred_colours.join(" or "),
    preferences.product_type ? `${preferences.product_type} options` : preferences.subcategory ?? preferences.category ?? "items"]
    .filter(Boolean).join(" ").toLowerCase();
}

// Counterfactual searches explain a failed request only. They never update
// preferences or display products outside the customer's saved restrictions.
export function explainNoMatch(
  catalogue: readonly CatalogueProduct[],
  preferences: ShoppingPreferences,
  options: PreferenceSearchOptions,
  allowColourPreview: boolean,
) {
  const label = shoppingRequestLabel(preferences);
  const probe = (patch: Partial<ShoppingPreferences>, records = catalogue) => searchByPreferences(
    records, { ...preferences, ...patch },
    { ...options, compare: (a, b) => (a.price_aud ?? Infinity) - (b.price_aud ?? Infinity), limit: records.length },
  ).products;
  const otherColours = allowColourPreview && preferences.preferred_colours.length
    ? catalogue.filter(product => product.colour && !preferences.preferred_colours.some(colour => relatedLabel(product.colour, colour))) : [];
  const colourPreviewProducts = otherColours.length
    ? searchByPreferences(otherColours, { ...preferences, preferred_colours: [] }, options).products : [];
  let message = `I couldn't find available ${label} that meet all your saved requirements.`;

  const aboveBudget = preferences.max_price !== null ? probe({ max_price: null }) : [];
  const belowBudget = preferences.min_price !== null ? probe({ min_price: null }) : [];
  const otherSizes = preferences.size ? probe({ size: null }) : [];
  if (aboveBudget.length) {
    const lowest = Math.min(...aboveBudget.map(product => product.price_aud));
    message = `I found ${label}, but none within your ${formatAud(preferences.max_price!)} limit and other requirements. The lowest-priced matching option is ${formatAud(lowest)}. Your budget is still saved. Would you like to change it?`;
  } else if (belowBudget.length) {
    message = `Available ${label} that meet your other requirements fall below your ${formatAud(preferences.min_price!)} minimum price. That limit is still saved. Would you like to change it?`;
  } else if (otherSizes.length) {
    message = `I found ${label} that meet your other requirements, but none list your requested size, ${preferences.size}. Your size is still saved. Would you like to choose another size?`;
  } else if (colourPreviewProducts.length) {
    message = `I couldn't find available ${label} within your other requirements. There are options in other colours if you'd like to explore them. Your original colour request is still saved.`;
  }
  return { message, colourPreviewProducts };
}
