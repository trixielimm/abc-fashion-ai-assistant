import type { ShoppingPreferences } from "../ai/preferenceSchema";
import type { ChatProduct } from "./conversationProtocol";
import { automaticCartSize } from "./productActions";

const normalise = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

export function preferredCardSize(product: ChatProduct, preferences: ShoppingPreferences | null): string {
  const automatic = automaticCartSize(product.sizes_available);
  if (automatic) return automatic;
  if (preferences?.category !== product.category || !preferences.size) return "";
  return product.sizes_available.find(size => normalise(size) === normalise(preferences.size!)) ?? "";
}

// Derive a short reason from supplied facts. Long explanations stay in the card disclosure.
export function productCardReason(product: ChatProduct, preferences: ShoppingPreferences | null): string | null {
  const explanation = product.explanation?.trim();
  if (explanation && explanation.length <= 110) return explanation;
  const size = preferredCardSize(product, preferences);
  if (size && !automaticCartSize(product.sizes_available)) return `Size ${size} is listed.`;
  if (preferences?.occasion && product.occasion && normalise(preferences.occasion) === normalise(product.occasion)) {
    return `Listed for ${product.occasion.toLowerCase()} occasions.`;
  }
  if (preferences?.max_price !== null && preferences?.max_price !== undefined && product.price_aud <= preferences.max_price) {
    return `Within your A$${preferences.max_price.toFixed(2)} limit.`;
  }
  return null;
}
