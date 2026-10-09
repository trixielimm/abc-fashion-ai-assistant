import type { ShoppingPreferences } from "../ai/preferenceSchema";
import { validatePreferences } from "../ai/validatePreferences";
import type { CataloguePreferenceValues } from "../catalogue/preferenceValues";
import type { CatalogueProduct } from "../recommendations/catalogue";
import {
  searchByPreferences,
  type PreferenceSearchResult,
} from "./preferenceSearch";

export function searchWithValidatedPreferences(
  catalogue: readonly CatalogueProduct[],
  preferences: ShoppingPreferences,
  vocabulary: CataloguePreferenceValues
): {
  validation: ReturnType<typeof validatePreferences>;
  result: PreferenceSearchResult;
} {
  const validation = validatePreferences(preferences, vocabulary);

  // Never search while a required preference needs clarification.
  if (validation.needs_clarification) {
    const details = validation.issues
      .filter((issue) => issue.blocking)
      .map((issue) =>
        `${issue.field.replaceAll("_", " ")} (${issue.value}): ${issue.reason}`
      )
      .join(" ");

    return {
      validation,
      result: {
        status: "needs_more_detail",
        message: `Please clarify these preferences. ${details}`,
        products: [],
      },
    };
  }

  // Use the validated and normalised preferences, not the raw input.
  const result = searchByPreferences(catalogue, validation.preferences);

  // Preserve warnings about unrecognised ranking preferences.
  if (validation.issues.length > 0) {
    const labels = validation.issues
      .map((issue) => `${issue.field.replaceAll("_", " ")}: ${issue.value}`)
      .join("; ");

    result.message =
      `Some preferences were not recognised as exact catalogue labels (${labels}). ` +
      result.message;
  }

  return { validation, result };
}